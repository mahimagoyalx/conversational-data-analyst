import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseQueryPlan, QueryPlanSchema } from "../src/schemas/queryPlan.js";

function expectInvalid(input: unknown, messagePart?: string) {
  const result = QueryPlanSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (messagePart && !result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join("\n");
    expect(messages).toContain(messagePart);
  }
}

describe("QueryPlan contract", () => {
  describe("valid plans", () => {
    it("represents retail onboarding count with segment filter", () => {
      expect(
        parseQueryPlan({
          dataset: "onboarding",
          metric: "count",
          filters: { segments: ["Retail"] },
        }),
      ).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Retail"] },
      });
    });

    it("represents onboarding volume by segment", () => {
      expect(
        parseQueryPlan({
          dataset: "onboarding",
          metric: "count",
          groupBy: ["segment"],
        }),
      ).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
      });
    });

    it("represents Retail vs SME onboarding comparison", () => {
      expect(
        parseQueryPlan({
          dataset: "onboarding",
          metric: "count",
          groupBy: ["segment"],
          filters: { segments: ["Retail", "SME"] },
        }),
      ).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
        filters: { segments: ["Retail", "SME"] },
      });
    });

    it("represents average transaction value", () => {
      expect(
        parseQueryPlan({
          dataset: "transactions",
          metric: "average",
        }),
      ).toEqual({
        dataset: "transactions",
        metric: "average",
      });
    });

    it("represents top five customers by transaction value", () => {
      expect(
        parseQueryPlan({
          dataset: "transactions",
          metric: "sum",
          groupBy: ["customer"],
          limit: 5,
        }),
      ).toEqual({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 5,
      });
    });

    it("allows onboarding rejection rate by branch", () => {
      expect(
        parseQueryPlan({
          dataset: "onboarding",
          metric: "rejection_rate",
          groupBy: ["branch"],
          filters: { statuses: ["Rejected", "Approved"] },
          dateRange: { from: "2025-01-01", to: "2025-06-30" },
        }),
      ).toMatchObject({
        dataset: "onboarding",
        metric: "rejection_rate",
        groupBy: ["branch"],
      });
    });

    it("allows onboarding count grouped by month", () => {
      expect(
        parseQueryPlan({
          dataset: "onboarding",
          metric: "count",
          dateGroupBy: "month",
          dateRange: { from: "2025-03-01" },
        }),
      ).toMatchObject({
        dataset: "onboarding",
        metric: "count",
        dateGroupBy: "month",
      });
    });

    it("allows branch and customer inventory counts", () => {
      expect(parseQueryPlan({ dataset: "branches", metric: "count" })).toEqual({
        dataset: "branches",
        metric: "count",
      });
      expect(
        parseQueryPlan({
          dataset: "customers",
          metric: "count",
          filters: { segments: ["Retail"] },
        }),
      ).toEqual({
        dataset: "customers",
        metric: "count",
        filters: { segments: ["Retail"] },
      });
    });

    it("allows aggregate transaction sum without grouping", () => {
      expect(
        parseQueryPlan({
          dataset: "transactions",
          metric: "sum",
          dateRange: { to: "2025-12-31" },
        }),
      ).toEqual({
        dataset: "transactions",
        metric: "sum",
        dateRange: { to: "2025-12-31" },
      });
    });
  });

  describe("invalid datasets", () => {
    it("rejects values outside the dataset enum", () => {
      expectInvalid({ dataset: "accounts", metric: "count" });
      expectInvalid({ dataset: "onboarding_applications", metric: "count" });
      expectInvalid({ dataset: "customers; DROP TABLE customers", metric: "count" });
    });
  });

  describe("invalid metrics", () => {
    it("rejects values outside the metric enum", () => {
      expectInvalid({ dataset: "onboarding", metric: "median" });
      expectInvalid({ dataset: "transactions", metric: "min" });
      expectInvalid({ dataset: "onboarding", metric: "SELECT COUNT(*)" });
    });
  });

  describe("invalid dataset/metric combinations", () => {
    it("rejects sum on onboarding", () => {
      expectInvalid(
        { dataset: "onboarding", metric: "sum" },
        'Metric "sum" only applies to the transactions dataset',
      );
    });

    it("rejects average on onboarding", () => {
      expectInvalid(
        { dataset: "onboarding", metric: "average" },
        'Metric "average" only applies to the transactions dataset',
      );
    });

    it("rejects count on transactions", () => {
      expectInvalid(
        { dataset: "transactions", metric: "count" },
        'Metric "count" only applies to the onboarding, branches, or customers datasets',
      );
    });

    it("rejects rejection_rate on transactions", () => {
      expectInvalid(
        { dataset: "transactions", metric: "rejection_rate" },
        'Metric "rejection_rate" only applies to the onboarding dataset',
      );
    });

    it("rejects incompatible inventory metrics", () => {
      expectInvalid(
        { dataset: "branches", metric: "sum" },
        "The branches dataset only supports the count metric",
      );
      expectInvalid(
        { dataset: "customers", metric: "average" },
        "The customers dataset only supports the count metric",
      );
      expectInvalid(
        { dataset: "customers", metric: "rejection_rate" },
        'Metric "rejection_rate" only applies to the onboarding dataset',
      );
    });
  });

  describe("invalid filters", () => {
    it("rejects segment filters on transactions", () => {
      expectInvalid(
        {
          dataset: "transactions",
          metric: "average",
          filters: { segments: ["Retail"] },
        },
        "Segment filters only apply to the onboarding or customers datasets",
      );
    });

    it("rejects status filters on transactions", () => {
      expectInvalid(
        {
          dataset: "transactions",
          metric: "sum",
          filters: { statuses: ["Approved"] },
        },
        "Status filters only apply to the onboarding dataset",
      );
    });

    it("rejects unknown segment values", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Platinum"] },
      });
    });

    it("rejects empty segment filter arrays", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: [] },
      });
    });

    it("rejects unknown status values and extra filter keys", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        filters: { statuses: ["Cancelled"] },
      });
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Retail"], city: "Mumbai" },
      });
    });

    it("rejects status filters on customers", () => {
      expectInvalid(
        {
          dataset: "customers",
          metric: "count",
          filters: { statuses: ["Approved"] },
        },
        "Status filters only apply to the onboarding dataset",
      );
    });
  });

  describe("invalid grouping", () => {
    it("rejects customer grouping on onboarding", () => {
      expectInvalid(
        {
          dataset: "onboarding",
          metric: "count",
          groupBy: ["customer"],
        },
        "Customer grouping only applies to the transactions dataset",
      );
    });

    it("rejects branch grouping on transactions", () => {
      expectInvalid(
        {
          dataset: "transactions",
          metric: "sum",
          groupBy: ["branch"],
        },
        "Branch grouping only applies to onboarding or customers",
      );
    });

    it("rejects segment grouping on transactions", () => {
      expectInvalid(
        {
          dataset: "transactions",
          metric: "sum",
          groupBy: ["segment"],
        },
        "Segment grouping only applies to onboarding or customers",
      );
    });

    it("rejects grouping on average transaction KPI", () => {
      expectInvalid(
        {
          dataset: "transactions",
          metric: "average",
          groupBy: ["customer"],
        },
        "Average is an aggregate transaction KPI and does not support grouping",
      );
    });

    it("rejects duplicate groupBy dimensions", () => {
      expectInvalid(
        {
          dataset: "onboarding",
          metric: "count",
          groupBy: ["segment", "segment"],
        },
        "`groupBy` must not contain duplicate dimensions",
      );
    });

    it("rejects empty or unknown groupBy dimensions", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        groupBy: [],
      });
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["city"],
      });
    });

    it("rejects grouping on branch inventory", () => {
      expectInvalid(
        {
          dataset: "branches",
          metric: "count",
          groupBy: ["branch"],
        },
        "Branch count is an aggregate KPI and does not support grouping or filters",
      );
    });

    it("rejects customer grouping other than segment or branch", () => {
      expectInvalid(
        {
          dataset: "customers",
          metric: "count",
          groupBy: ["customer"],
        },
        "Customer count grouping only supports segment or branch",
      );
    });

    it("rejects date grouping outside onboarding count queries", () => {
      expectInvalid(
        {
          dataset: "onboarding",
          metric: "rejection_rate",
          dateGroupBy: "month",
        },
        "Date grouping only applies to onboarding count queries",
      );

      expectInvalid(
        {
          dataset: "transactions",
          metric: "sum",
          dateGroupBy: "month",
        },
        "Date grouping only applies to onboarding count queries",
      );
    });
  });

  describe("invalid limits", () => {
    it("rejects limit outside 1..10", () => {
      expectInvalid({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 0,
      });
      expectInvalid({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 11,
      });
      expectInvalid({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 2.5,
      });
      expectInvalid({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: "5",
      });
    });

    it("rejects limit unless top customers by transaction value", () => {
      expectInvalid(
        {
          dataset: "onboarding",
          metric: "count",
          groupBy: ["segment"],
          limit: 5,
        },
        "Limit only applies to top customers by transaction value",
      );

      expectInvalid(
        {
          dataset: "transactions",
          metric: "sum",
          limit: 5,
        },
        "Limit only applies to top customers by transaction value",
      );

      expectInvalid(
        {
          dataset: "transactions",
          metric: "average",
          limit: 5,
        },
        "Average is an aggregate transaction KPI and does not support limit",
      );
    });
  });

  describe("invalid date ranges", () => {
    it("rejects malformed dates", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        dateRange: { from: "2025-13-01" },
      });
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        dateRange: { to: "not-a-date" },
      });
    });

    it("rejects from after to", () => {
      expectInvalid(
        {
          dataset: "onboarding",
          metric: "count",
          dateRange: { from: "2025-06-01", to: "2025-01-01" },
        },
        "`dateRange.from` must not be after `dateRange.to`",
      );
    });

    it("rejects extra dateRange keys and date grouping on inventory datasets", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        dateRange: { from: "2025-01-01", sql: "1=1" },
      });
      expectInvalid({
        dataset: "customers",
        metric: "count",
        dateRange: { from: "2025-01-01" },
      });
      expectInvalid({
        dataset: "branches",
        metric: "count",
        dateRange: { to: "2025-12-31" },
      });
    });
  });

  describe("invalid plans / shape", () => {
    it("rejects SQL fields on the plan", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        sql: "SELECT * FROM customers",
      });
    });

    it("rejects unknown keys", () => {
      expectInvalid({
        dataset: "onboarding",
        metric: "count",
        orderBy: "segment",
      });
    });

    it("throws ZodError from parseQueryPlan", () => {
      expect(() =>
        parseQueryPlan({ dataset: "onboarding", metric: "sum" }),
      ).toThrow(ZodError);
    });
  });
});
