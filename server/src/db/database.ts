import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const sqlDirCandidates = [
  path.dirname(fileURLToPath(import.meta.url)),
  path.resolve(process.cwd(), "src/db"),
];

export type RowCounts = {
  branches: number;
  customers: number;
  onboarding_applications: number;
  transactions: number;
};

export function getSqlDirectory(): string {
  for (const candidate of sqlDirCandidates) {
    if (fs.existsSync(path.join(candidate, "schema.sql"))) {
      return candidate;
    }
  }

  throw new Error("Could not locate schema.sql next to the database module.");
}

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }

  return path.resolve(getSqlDirectory(), "../../data/bank.db");
}

export function openDatabase(dbPath = getDatabasePath()): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  if (dbPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  return db;
}

export function readSqlFile(filename: string): string {
  return fs.readFileSync(path.join(getSqlDirectory(), filename), "utf8");
}

export function setupDatabase(dbPath = getDatabasePath()): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const suffix of ["", "-wal", "-shm"]) {
      const filePath = `${dbPath}${suffix}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  const db = openDatabase(dbPath);
  db.exec(readSqlFile("schema.sql"));
  db.exec(readSqlFile("seed.sql"));
  return db;
}

export function getRowCounts(db: Database.Database): RowCounts {
  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { count: number };
    return row.count;
  };

  return {
    branches: count("SELECT COUNT(*) AS count FROM branches"),
    customers: count("SELECT COUNT(*) AS count FROM customers"),
    onboarding_applications: count(
      "SELECT COUNT(*) AS count FROM onboarding_applications",
    ),
    transactions: count("SELECT COUNT(*) AS count FROM transactions"),
  };
}

export function getBreakdowns(db: Database.Database) {
  const customersBySegment = db
    .prepare(
      `SELECT segment AS label, COUNT(*) AS count
       FROM customers
       GROUP BY segment
       ORDER BY segment`,
    )
    .all() as Array<{ label: string; count: number }>;

  const customersByBranch = db
    .prepare(
      `SELECT b.name AS label, COUNT(*) AS count
       FROM customers c
       JOIN branches b ON b.id = c.branch_id
       GROUP BY b.id
       ORDER BY b.id`,
    )
    .all() as Array<{ label: string; count: number }>;

  const applicationsByStatus = db
    .prepare(
      `SELECT status AS label, COUNT(*) AS count
       FROM onboarding_applications
       GROUP BY status
       ORDER BY status`,
    )
    .all() as Array<{ label: string; count: number }>;

  return {
    customersBySegment,
    customersByBranch,
    applicationsByStatus,
  };
}
