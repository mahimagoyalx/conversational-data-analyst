import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { setupDatabase } from "../src/db/database.js";
import type { QueryPlanner } from "../src/planner/queryPlanner.js";
import type { QueryPlan } from "../src/schemas/queryPlan.js";

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

function seededApp(planner?: QueryPlanner) {
  const db = setupDatabase(":memory:");
  databases.push(db);
  return createApp({ db, planner });
}

async function postChat(baseUrl: string, body: unknown) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

describe("API", () => {
  it("reports health", async () => {
    const baseUrl = await listen(seededApp());
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });

  it("answers a valid onboarding question", async () => {
    const baseUrl = await listen(seededApp());
    const { status, body } = await postChat(baseUrl, {
      question: "How many Retail customers were onboarded?",
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as {
      answer: string;
      visualization: { type: string; title: string };
      columns: unknown[];
      rows: Array<{ value: number }>;
    };
    expect(data.visualization.type).toBe("kpi");
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].value).toBeGreaterThan(0);
    expect(data.answer).toContain(String(data.rows[0].value));
    expect(data.answer.toLowerCase()).toContain("retail");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("select");
    expect(body).not.toHaveProperty("sql");
  });

  it("returns a structured analytics result for a comparison question", async () => {
    const baseUrl = await listen(seededApp());
    const { status, body } = await postChat(baseUrl, {
      question: "Show onboarding volume by segment.",
    });

    expect(status).toBe(200);
    const data = body.data as {
      visualization: { type: string };
      columns: Array<{ key: string }>;
      rows: Array<{ label: string; value: number }>;
      answer: string;
    };
    expect(data.visualization.type).toBe("bar");
    expect(data.columns.map((column) => column.key)).toEqual(["label", "value"]);
    expect(data.rows.length).toBeGreaterThan(1);
    expect(data.rows.every((row) => typeof row.label === "string")).toBe(true);
    expect(data.answer.length).toBeGreaterThan(0);
    for (const row of data.rows) {
      expect(data.answer).toContain(row.label);
    }
  });

  it("rejects an empty question", async () => {
    const baseUrl = await listen(seededApp());
    const empty = await postChat(baseUrl, { question: "   " });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      success: false,
      error: {
        code: "invalid_request",
        message: "Request body must be a JSON object with a non-empty question.",
      },
    });

    const missing = await postChat(baseUrl, {});
    expect(missing.status).toBe(400);
    expect(missing.body.success).toBe(false);
  });

  it("returns a client-safe error for unsupported questions", async () => {
    const baseUrl = await listen(seededApp());
    const { status, body } = await postChat(baseUrl, {
      question: "What's the weather in Mumbai?",
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    const error = body.error as { code: string; message: string };
    expect(error.code).toBe("unsupported_question");
    expect(error.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toMatch(/SELECT|stack|bank\.db|DATABASE_PATH/i);
  });

  it("does not accept SQL from the client", async () => {
    const baseUrl = await listen(seededApp());
    const { status, body } = await postChat(baseUrl, {
      question: "How many Retail customers were onboarded?",
      sql: "DROP TABLE customers",
    });
    expect(status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: { code: "invalid_request" },
    });
  });

  it("maps a database error to a client-safe failure", async () => {
    const db = setupDatabase(":memory:");
    databases.push(db);
    db.close();
    const baseUrl = await listen(createApp({ db }));
    const { status, body } = await postChat(baseUrl, {
      question: "What's the average transaction value?",
    });

    expect(status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: "database_error",
        message: "I couldn't retrieve analytics right now.",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/sqlite|ENOENT|prepare|stack/i);
  });

  it("maps malformed planner output to a client-safe failure", async () => {
    const planner: QueryPlanner = {
      plan(): PlannerResult {
        return {
          ok: true,
          plan: {
            dataset: "onboarding",
            sql: "SELECT * FROM customers",
          } as QueryPlan,
        };
      },
    };
    const baseUrl = await listen(seededApp(planner));
    const { status, body } = await postChat(baseUrl, {
      question: "How many customers were onboarded?",
    });

    expect(status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: "invalid_plan",
        message: "I couldn't interpret that question.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("SELECT");
  });
});
