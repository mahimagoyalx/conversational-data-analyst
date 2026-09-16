import { afterEach, describe, expect, it } from "vitest";
import {
  getRowCounts,
  openDatabase,
  readSqlFile,
  setupDatabase,
} from "../src/db/database.js";

const databases: Array<ReturnType<typeof openDatabase>> = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

describe("database setup", () => {
  it("loads schema and seed with the expected row counts", () => {
    const db = setupDatabase(":memory:");
    databases.push(db);

    expect(getRowCounts(db)).toEqual({
      branches: 5,
      customers: 50,
      onboarding_applications: 150,
      transactions: 200,
    });
  });

  it("includes every segment, status, and multiple months", () => {
    const db = setupDatabase(":memory:");
    databases.push(db);

    const segments = db
      .prepare("SELECT DISTINCT segment FROM customers ORDER BY segment")
      .all() as Array<{ segment: string }>;
    const statuses = db
      .prepare(
        "SELECT DISTINCT status FROM onboarding_applications ORDER BY status",
      )
      .all() as Array<{ status: string }>;
    const applicationMonths = db
      .prepare(
        "SELECT DISTINCT substr(application_date, 1, 7) AS month FROM onboarding_applications",
      )
      .all() as Array<{ month: string }>;

    expect(segments.map((row) => row.segment)).toEqual([
      "Corporate",
      "Retail",
      "SME",
    ]);
    expect(statuses.map((row) => row.status)).toEqual([
      "Approved",
      "Pending",
      "Rejected",
    ]);
    expect(applicationMonths.length).toBeGreaterThan(1);
  });

  it("keeps rejection reasons aligned with application status", () => {
    const db = setupDatabase(":memory:");
    databases.push(db);

    const invalid = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM onboarding_applications
         WHERE (status = 'Rejected' AND rejection_reason IS NULL)
            OR (status != 'Rejected' AND rejection_reason IS NOT NULL)`,
      )
      .get() as { count: number };

    expect(invalid.count).toBe(0);
  });

  it("rejects invalid segments and missing foreign keys", () => {
    const db = openDatabase(":memory:");
    databases.push(db);
    db.exec(readSqlFile("schema.sql"));

    db.exec(
      "INSERT INTO branches (id, name, city) VALUES (1, 'Test Branch', 'Mumbai')",
    );

    expect(() =>
      db.prepare(
        "INSERT INTO customers (id, name, segment, branch_id) VALUES (1, 'Test', 'Platinum', 1)",
      ).run(),
    ).toThrow();

    expect(() =>
      db.prepare(
        "INSERT INTO customers (id, name, segment, branch_id) VALUES (1, 'Test', 'Retail', 99)",
      ).run(),
    ).toThrow();
  });
});
