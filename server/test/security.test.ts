import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { getRowCounts, setupDatabase } from "../src/db/database.js";
import { MockQueryPlanner } from "../src/planner/queryPlanner.js";
import { buildQuery, QueryBuilderError, SQL_TEMPLATES } from "../src/services/queryBuilder.js";

const DESTRUCTIVE_QUESTIONS = [
  "DROP TABLE customers",
  "DELETE FROM customers",
  "UPDATE customers SET segment='Corporate'",
  "SELECT * FROM customers",
  "Show onboarding; DROP TABLE customers",
  "DROP TABLE transactions",
] as const;

const databases: Database.Database[] = [];
const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        }),
    ),
  );
  for (const db of databases.splice(0)) {
    db.close();
  }
});

async function listen(app: ReturnType<typeof createApp>): Promise<string> {
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

function tableNames(db: Database.Database): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

describe("SQL safety boundary", () => {
  it("refuses destructive questions in the planner, builder, and API", async () => {
    const planner = new MockQueryPlanner();
    const db = setupDatabase(":memory:");
    databases.push(db);
    const before = getRowCounts(db);
    const tablesBefore = tableNames(db);
    const baseUrl = await listen(createApp({ db, planner }));

    for (const question of DESTRUCTIVE_QUESTIONS) {
      const planned = planner.plan(question);
      expect(planned.ok, question).toBe(false);
      if (!planned.ok) {
        expect(planned.errorType).toBe("unsupported_question");
      }

      expect(() => buildQuery(question)).toThrow(QueryBuilderError);

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await response.json()) as {
        success: boolean;
        error?: { code: string; message: string };
        data?: unknown;
      };

      expect(response.status, question).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("unsupported_question");
      expect(body).not.toHaveProperty("sql");
      expect(JSON.stringify(body)).not.toMatch(
        /DROP TABLE|DELETE FROM|UPDATE customers|SELECT \*|bank\.db|sqlite/i,
      );
    }

    expect(getRowCounts(db)).toEqual(before);
    expect(tableNames(db)).toEqual(tablesBefore);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM customers").get() as { count: number })
        .count,
    ).toBe(before.customers);
  });

  it("executes only trusted SELECT templates for valid analytics questions", () => {
    const planner = new MockQueryPlanner();
    const db = setupDatabase(":memory:");
    databases.push(db);
    const before = getRowCounts(db);

    const questions = [
      "How many Retail customers were onboarded?",
      "Show onboarding volume by segment.",
      "Compare Retail and SME onboarding.",
      "Which branches have the highest rejection rate?",
      "How many applications were rejected?",
      "What is the total transaction value?",
      "What's the average transaction value?",
      "Show the top five customers by transaction value.",
      "Show the top 3 customers by transaction value.",
    ];

    for (const question of questions) {
      const planned = planner.plan(question);
      expect(planned.ok, question).toBe(true);
      if (!planned.ok) {
        continue;
      }

      const built = buildQuery(planned.plan);
      expect(Object.values(SQL_TEMPLATES)).toContain(built.sql);
      expect(built.sql).not.toContain(question);
      expect(built.sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
      expect(built.sql).not.toContain(";");

      db.prepare(built.sql).all(...built.params);
    }

    expect(getRowCounts(db)).toEqual(before);
  });
});
