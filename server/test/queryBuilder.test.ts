import { describe, expect, it } from "vitest";
import { setupDatabase } from "../src/db/database.js";
import {
  buildQuery,
  QueryBuilderError,
  SQL_TEMPLATES,
} from "../src/services/queryBuilder.js";
import { parseQueryPlan } from "../src/schemas/queryPlan.js";

function tableNames(db: ReturnType<typeof setupDatabase>): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

describe("QueryBuilder", () => {
  describe("valid plans map to trusted queries", () => {
    it("builds overall onboarding count", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
      });
      expect(built.sql).toBe(SQL_TEMPLATES.onboardingCountOverall);
      expect(built.params).toHaveLength(6);
    });

    it("builds onboarding count by segment", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
      });
      expect(built.sql).toBe(SQL_TEMPLATES.onboardingCountBySegment);
    });

    it("builds onboarding count by branch", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["branch"],
      });
      expect(built.sql).toBe(SQL_TEMPLATES.onboardingCountByBranch);
    });

    it("builds monthly onboarding count", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        dateGroupBy: "month",
      });
      expect(built.sql).toBe(SQL_TEMPLATES.onboardingCountMonthly);
    });

    it("builds onboarding count with segment and status filters", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        filters: {
          segments: ["Retail"],
          statuses: ["Approved"],
        },
      });
      expect(built.sql).toBe(SQL_TEMPLATES.onboardingCountOverall);
    });

    it("builds rejection rate queries", () => {
      expect(
        buildQuery({ dataset: "onboarding", metric: "rejection_rate" }).sql,
      ).toBe(SQL_TEMPLATES.onboardingRejectionRate);
      expect(
        buildQuery({
          dataset: "onboarding",
          metric: "rejection_rate",
          groupBy: ["branch"],
        }).sql,
      ).toBe(SQL_TEMPLATES.onboardingRejectionRateByBranch);
    });

    it("builds transaction value queries", () => {
      expect(
        buildQuery({ dataset: "transactions", metric: "sum" }).sql,
      ).toBe(SQL_TEMPLATES.transactionsTotalValue);
      expect(
        buildQuery({ dataset: "transactions", metric: "average" }).sql,
      ).toBe(SQL_TEMPLATES.transactionsAverageValue);
      expect(
        buildQuery({
          dataset: "transactions",
          metric: "sum",
          groupBy: ["customer"],
        }).sql,
      ).toBe(SQL_TEMPLATES.transactionsValueByCustomer);
      expect(
        buildQuery({
          dataset: "transactions",
          metric: "sum",
          groupBy: ["customer"],
          limit: 5,
        }).sql,
      ).toBe(SQL_TEMPLATES.transactionsTopCustomers);
    });

    it("builds branch and customer inventory counts", () => {
      expect(buildQuery({ dataset: "branches", metric: "count" })).toEqual({
        sql: SQL_TEMPLATES.branchCount,
        params: [],
      });
      expect(
        buildQuery({
          dataset: "customers",
          metric: "count",
          filters: { segments: ["Retail"] },
        }).sql,
      ).toBe(SQL_TEMPLATES.customerCountOverall);
    });
  });

  describe("dynamic values are parameterized", () => {
    it("puts segment and status filters in params, not SQL", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        filters: {
          segments: ["Retail", "SME"],
          statuses: ["Rejected"],
        },
      });
      expect(built.sql).not.toContain("Retail");
      expect(built.sql).not.toContain("SME");
      expect(built.sql).not.toContain("Rejected");
      expect(built.sql).toContain("json_each(?)");
      expect(built.params[0]).toBe(JSON.stringify(["Retail", "SME"]));
      expect(built.params[1]).toBe(JSON.stringify(["Rejected"]));
    });

    it("puts date range values in params, not SQL", () => {
      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        dateRange: { from: "2025-01-01", to: "2025-06-30" },
      });
      expect(built.sql).not.toContain("2025-01-01");
      expect(built.sql).not.toContain("2025-06-30");
      expect(built.params).toEqual(
        expect.arrayContaining(["2025-01-01", "2025-06-30"]),
      );
    });

    it("puts top-N limit in params, not SQL", () => {
      const built = buildQuery({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 5,
      });
      expect(built.sql).toMatch(/LIMIT \?$/);
      expect(built.sql).not.toContain("LIMIT 5");
      expect(built.params.at(-1)).toBe(5);
    });
  });

  describe("unsupported plans are rejected", () => {
    it("rejects monthly onboarding with extra grouping", () => {
      expect(() =>
        buildQuery(
          parseQueryPlan({
            dataset: "onboarding",
            metric: "count",
            dateGroupBy: "month",
            groupBy: ["segment"],
          }),
        ),
      ).toThrow(QueryBuilderError);
    });

    it("rejects rejection rate grouped by segment", () => {
      expect(() =>
        buildQuery({
          dataset: "onboarding",
          metric: "rejection_rate",
          groupBy: ["segment"],
        }),
      ).toThrow(/Unsupported rejection rate grouping/);
    });

    it("rejects onboarding count by branch with filters", () => {
      expect(() =>
        buildQuery({
          dataset: "onboarding",
          metric: "count",
          groupBy: ["branch"],
          filters: { segments: ["Retail"] },
        }),
      ).toThrow(QueryBuilderError);
    });
  });

  describe("security boundary", () => {
    it("never accepts arbitrary SQL as a plan", () => {
      expect(() => buildQuery("SELECT * FROM customers")).toThrow(
        QueryBuilderError,
      );
      expect(() =>
        buildQuery({
          dataset: "onboarding",
          metric: "count",
          sql: "SELECT * FROM customers",
        }),
      ).toThrow(QueryBuilderError);
    });

    it("does not let destructive SQL through the builder", () => {
      expect(() => buildQuery("DROP TABLE customers")).toThrow(QueryBuilderError);
      expect(() =>
        buildQuery({
          dataset: "onboarding",
          metric: "count",
          sql: "DROP TABLE customers; DELETE FROM transactions",
        }),
      ).toThrow(QueryBuilderError);

      for (const sql of Object.values(SQL_TEMPLATES)) {
        expect(sql.toUpperCase().startsWith("SELECT")).toBe(true);
        expect(sql).not.toMatch(/\bDROP\b/i);
        expect(sql).not.toMatch(/\bDELETE\b/i);
        expect(sql).not.toMatch(/\bINSERT\b/i);
        expect(sql).not.toMatch(/\bUPDATE\b/i);
        expect(sql).not.toContain(";");
      }
    });

    it("cannot turn SQL injection-style input into SQL", () => {
      expect(() =>
        buildQuery({
          dataset: "onboarding",
          metric: "count",
          filters: { segments: ["Retail'; DROP TABLE customers;--"] },
        }),
      ).toThrow(QueryBuilderError);

      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Retail"] },
      });
      expect(built.sql).not.toMatch(/DROP|DELETE|;|--/i);
      expect(built.params.join(" ")).toContain("Retail");
      expect(built.sql).not.toContain("Retail");
    });

    it("executes trusted SELECT queries without changing the database", () => {
      const db = setupDatabase(":memory:");
      const before = tableNames(db);
      const customerCount = (
        db.prepare("SELECT COUNT(*) AS count FROM customers").get() as {
          count: number;
        }
      ).count;

      const built = buildQuery({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Retail"] },
      });
      const row = db.prepare(built.sql).get(...built.params) as { value: number };
      expect(row.value).toBeGreaterThan(0);

      const top = buildQuery({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 3,
      });
      const rows = db.prepare(top.sql).all(...top.params);
      expect(rows).toHaveLength(3);

      expect(tableNames(db)).toEqual(before);
      expect(
        (db.prepare("SELECT COUNT(*) AS count FROM customers").get() as { count: number })
          .count,
      ).toBe(customerCount);
      db.close();
    });
  });
});
