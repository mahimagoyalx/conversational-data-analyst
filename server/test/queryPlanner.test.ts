import { describe, expect, it } from "vitest";
import { MockQueryPlanner } from "../src/planner/queryPlanner.js";
import type { QueryPlan } from "../src/schemas/queryPlan.js";

const planner = new MockQueryPlanner();

function planOf(question: string): QueryPlan {
  const result = planner.plan(question);
  expect(result.ok, `expected a plan for: ${question}`).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.plan;
}

function expectEquivalent(questions: string[]) {
  const [first, ...rest] = questions;
  const expected = planOf(first);
  for (const question of rest) {
    expect(planOf(question), question).toEqual(expected);
  }
}

function expectUnsupported(question: string) {
  const result = planner.plan(question);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errorType).toBe("unsupported_question");
    expect(result.message.length).toBeGreaterThan(0);
  }
}

describe("MockQueryPlanner", () => {
  describe("supported questions", () => {
    it("plans overall onboarding count", () => {
      expect(planOf("How many customers were onboarded?")).toEqual({
        dataset: "onboarding",
        metric: "count",
      });
    });

    it("plans onboarding count by segment", () => {
      expect(planOf("Show onboarding volume by segment.")).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
      });
    });

    it("plans onboarding count by branch", () => {
      expect(planOf("Show onboarding count by branch.")).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["branch"],
      });
    });

    it("plans monthly onboarding volume", () => {
      expect(planOf("Show monthly onboarding volume.")).toEqual({
        dataset: "onboarding",
        metric: "count",
        dateGroupBy: "month",
      });
    });

    it("plans rejection rate", () => {
      expect(planOf("What's the rejection rate?")).toEqual({
        dataset: "onboarding",
        metric: "rejection_rate",
      });
    });

    it("plans rejection rate by branch", () => {
      expect(planOf("Show rejection rate by branch.")).toEqual({
        dataset: "onboarding",
        metric: "rejection_rate",
        groupBy: ["branch"],
      });
    });

    it("plans total transaction value", () => {
      expect(planOf("What's the total transaction value?")).toEqual({
        dataset: "transactions",
        metric: "sum",
      });
    });

    it("plans average transaction value", () => {
      expect(planOf("What's the average transaction value?")).toEqual({
        dataset: "transactions",
        metric: "average",
      });
    });

    it("plans transaction value by customer", () => {
      expect(planOf("Show transaction value by customer.")).toEqual({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
      });
    });
  });

  describe("natural-language variations", () => {
    it("maps Retail onboarding phrasings to the same plan", () => {
      expectEquivalent([
        "How many Retail customers were onboarded?",
        "What's the Retail onboarding volume?",
        "Give me the number of Retail onboarding applications.",
        "How many applications came from Retail customers?",
        "Tell me the Retail onboarding count.",
      ]);

      expect(planOf("How many Retail customers were onboarded?")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Retail"] },
      });
    });

    it("maps segment breakdown phrasings to the same plan", () => {
      expectEquivalent([
        "Show onboarding volume by segment.",
        "Give me a segment-wise breakdown of onboarding.",
        "How many customers were onboarded in each segment?",
      ]);
    });

    it("maps monthly volume phrasings to the same plan", () => {
      expectEquivalent([
        "Show monthly onboarding volume.",
        "Give me onboarding month by month.",
        "How many applications were there each month?",
      ]);
    });

    it("maps average transaction phrasings to the same plan", () => {
      expectEquivalent([
        "What's the average transaction value?",
        "Give me the average transaction amount.",
        "What is the mean transaction value?",
      ]);
    });
  });

  describe("Retail/SME/Corporate filters", () => {
    it("filters a single segment", () => {
      expect(planOf("How many SME customers were onboarded?")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["SME"] },
      });
      expect(planOf("Corporate onboarding count")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { segments: ["Corporate"] },
      });
    });

    it("compares named segments", () => {
      expect(planOf("Compare Retail and SME onboarding.")).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
        filters: { segments: ["Retail", "SME"] },
      });
      expect(planOf("Retail vs Corporate onboarding volume")).toEqual({
        dataset: "onboarding",
        metric: "count",
        groupBy: ["segment"],
        filters: { segments: ["Retail", "Corporate"] },
      });
    });
  });

  describe("status filters", () => {
    it("filters approved, rejected, and pending applications", () => {
      expect(planOf("How many applications were approved?")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { statuses: ["Approved"] },
      });
      expect(planOf("Give me the number of rejected applications.")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { statuses: ["Rejected"] },
      });
      expect(planOf("How many pending onboarding applications are there?")).toEqual({
        dataset: "onboarding",
        metric: "count",
        filters: { statuses: ["Pending"] },
      });
    });

    it("does not treat rejection rate as a rejected-status count", () => {
      expect(planOf("What's the onboarding rejection rate?")).toEqual({
        dataset: "onboarding",
        metric: "rejection_rate",
      });
    });
  });

  describe("top-N values", () => {
    it("recognizes numeric and word limits", () => {
      expect(planOf("Show the top 3 customers by transaction value.")).toEqual({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 3,
      });
      expect(planOf("Show the top five customers by transaction value.")).toEqual({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 5,
      });
      expect(planOf("Top ten customers by transaction amount")).toEqual({
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
        limit: 10,
      });
    });

    it("treats equivalent top-five phrasings as the same plan", () => {
      expectEquivalent([
        "Show the top five customers by transaction value.",
        "Show the top 5 customers by transaction value.",
        "Give me the top 5 customers by transaction amount.",
      ]);
    });
  });

  describe("unsupported questions", () => {
    it("rejects questions outside the supported analytics", () => {
      expectUnsupported("What's the weather in Mumbai?");
      expectUnsupported("Show onboarding by city.");
      expectUnsupported("What's the average onboarding time?");
      expectUnsupported("How many transactions were there?");
      expectUnsupported("SELECT * FROM customers");
    });

    it("rejects empty questions", () => {
      expectUnsupported("");
      expectUnsupported("   ");
      expectUnsupported("???");
    });
  });

  it("never puts SQL on a successful plan", () => {
    const plan = planOf("How many Retail customers were onboarded?");
    expect(JSON.stringify(plan).toLowerCase()).not.toContain("select");
    expect(plan).not.toHaveProperty("sql");
  });
});
