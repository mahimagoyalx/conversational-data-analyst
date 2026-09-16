import { z } from "zod";

/**
 * Structured analytical intent extracted from natural language.
 * IMPORTANT: A QueryPlan must NEVER contain SQL.
 */

export const DatasetSchema = z.enum(["onboarding", "transactions"]);
export type Dataset = z.infer<typeof DatasetSchema>;

export const MetricSchema = z.enum([
  "count",
  "sum",
  "average",
  "rejection_rate",
]);
export type Metric = z.infer<typeof MetricSchema>;

export const GroupByDimensionSchema = z.enum([
  "segment",
  "branch",
  "customer",
]);
export type GroupByDimension = z.infer<typeof GroupByDimensionSchema>;

export const DateGroupBySchema = z.enum(["month"]);
export type DateGroupBy = z.infer<typeof DateGroupBySchema>;

export const CustomerSegmentSchema = z.enum(["Retail", "SME", "Corporate"]);
export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;

export const OnboardingStatusSchema = z.enum([
  "Approved",
  "Rejected",
  "Pending",
]);
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;

export const DateRangeSchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .superRefine((range, ctx) => {
    if (range.from && range.to && range.from > range.to) {
      ctx.addIssue({
        code: "custom",
        message: "`dateRange.from` must not be after `dateRange.to`",
        path: ["from"],
      });
    }
  });
export type DateRange = z.infer<typeof DateRangeSchema>;

export const QueryPlanFiltersSchema = z
  .object({
    segments: z.array(CustomerSegmentSchema).min(1).optional(),
    statuses: z.array(OnboardingStatusSchema).min(1).optional(),
  })
  .strict();
export type QueryPlanFilters = z.infer<typeof QueryPlanFiltersSchema>;

const QueryPlanBaseSchema = z
  .object({
    dataset: DatasetSchema,
    metric: MetricSchema,
    groupBy: z.array(GroupByDimensionSchema).min(1).optional(),
    dateGroupBy: DateGroupBySchema.optional(),
    filters: QueryPlanFiltersSchema.optional(),
    dateRange: DateRangeSchema.optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

function hasFilter(
  filters: QueryPlanFilters | undefined,
  key: keyof QueryPlanFilters,
): boolean {
  return Boolean(filters?.[key]?.length);
}

function uniqueDimensions(groupBy: GroupByDimension[] | undefined): boolean {
  if (!groupBy) {
    return true;
  }
  return new Set(groupBy).size === groupBy.length;
}

export const QueryPlanSchema = QueryPlanBaseSchema.superRefine((plan, ctx) => {
  const { dataset, metric, groupBy, dateGroupBy, filters, limit } = plan;

  if (!uniqueDimensions(groupBy)) {
    ctx.addIssue({
      code: "custom",
      message: "`groupBy` must not contain duplicate dimensions",
      path: ["groupBy"],
    });
  }

  const isOnboarding = dataset === "onboarding";
  const isTransactions = dataset === "transactions";

  // Dataset / metric combinations
  if (metric === "count" || metric === "rejection_rate") {
    if (!isOnboarding) {
      ctx.addIssue({
        code: "custom",
        message: `Metric "${metric}" only applies to the onboarding dataset`,
        path: ["metric"],
      });
    }
  }

  if (metric === "sum" || metric === "average") {
    if (!isTransactions) {
      ctx.addIssue({
        code: "custom",
        message: `Metric "${metric}" only applies to the transactions dataset`,
        path: ["metric"],
      });
    }
  }

  // Grouping rules
  if (groupBy?.includes("customer") && !isTransactions) {
    ctx.addIssue({
      code: "custom",
      message: "Customer grouping only applies to the transactions dataset",
      path: ["groupBy"],
    });
  }

  if (groupBy?.includes("branch") && !isOnboarding) {
    ctx.addIssue({
      code: "custom",
      message: "Branch grouping only applies to the onboarding dataset",
      path: ["groupBy"],
    });
  }

  if (groupBy?.includes("segment") && !isOnboarding) {
    ctx.addIssue({
      code: "custom",
      message: "Segment grouping only applies to the onboarding dataset",
      path: ["groupBy"],
    });
  }

  // Filter rules
  if (hasFilter(filters, "segments") && !isOnboarding) {
    ctx.addIssue({
      code: "custom",
      message: "Segment filters only apply to the onboarding dataset",
      path: ["filters", "segments"],
    });
  }

  if (hasFilter(filters, "statuses") && !isOnboarding) {
    ctx.addIssue({
      code: "custom",
      message: "Status filters only apply to the onboarding dataset",
      path: ["filters", "statuses"],
    });
  }

  // Date grouping: only supported onboarding count queries
  if (dateGroupBy !== undefined) {
    if (!(isOnboarding && metric === "count")) {
      ctx.addIssue({
        code: "custom",
        message:
          "Date grouping only applies to onboarding count queries",
        path: ["dateGroupBy"],
      });
    }
  }

  // Average is an aggregate transaction KPI (no grouping / limit)
  if (metric === "average") {
    if (groupBy) {
      ctx.addIssue({
        code: "custom",
        message:
          "Average is an aggregate transaction KPI and does not support grouping",
        path: ["groupBy"],
      });
    }
    if (limit !== undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "Average is an aggregate transaction KPI and does not support limit",
        path: ["limit"],
      });
    }
  }

  // Limit only applies to top customers by transaction value
  const isTopCustomersByValue =
    isTransactions &&
    metric === "sum" &&
    Boolean(groupBy?.length === 1 && groupBy[0] === "customer");

  if (limit !== undefined && !isTopCustomersByValue) {
    ctx.addIssue({
      code: "custom",
      message:
        "Limit only applies to top customers by transaction value (transactions + sum + groupBy customer)",
      path: ["limit"],
    });
  }

  // Transaction sum may only group by customer (when grouped)
  if (isTransactions && metric === "sum" && groupBy) {
    const invalid = groupBy.filter((dimension) => dimension !== "customer");
    if (invalid.length > 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "Transaction sum grouping only supports the customer dimension",
        path: ["groupBy"],
      });
    }
  }

  // Rejection rate may group by segment/branch only (already enforced by dataset rules)
  if (metric === "rejection_rate" && groupBy?.includes("customer")) {
    ctx.addIssue({
      code: "custom",
      message: "Rejection rate does not support customer grouping",
      path: ["groupBy"],
    });
  }
});

export type QueryPlan = z.infer<typeof QueryPlanSchema>;

export function parseQueryPlan(input: unknown): QueryPlan {
  return QueryPlanSchema.parse(input);
}
