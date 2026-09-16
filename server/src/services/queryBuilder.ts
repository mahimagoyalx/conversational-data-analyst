import {
  parseQueryPlan,
  type QueryPlan,
} from "../schemas/queryPlan.js";

export type BuiltQuery = {
  sql: string;
  params: unknown[];
};

export class QueryBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryBuilderError";
  }
}

const ALL_SEGMENTS = ["Corporate", "Retail", "SME"] as const;
const ALL_STATUSES = ["Approved", "Pending", "Rejected"] as const;

const DATE_RANGE_APPLICATION = `
  AND (? IS NULL OR oa.application_date >= ?)
  AND (? IS NULL OR oa.application_date <= ?)`;

const DATE_RANGE_TRANSACTION = `
  AND (? IS NULL OR t.transaction_date >= ?)
  AND (? IS NULL OR t.transaction_date <= ?)`;

export const SQL_TEMPLATES = {
  onboardingCountOverall: `
SELECT COUNT(*) AS value
FROM onboarding_applications AS oa
JOIN customers AS c ON c.id = oa.customer_id
WHERE c.segment IN (SELECT value FROM json_each(?))
  AND oa.status IN (SELECT value FROM json_each(?))
  ${DATE_RANGE_APPLICATION}`.trim(),

  onboardingCountBySegment: `
SELECT c.segment AS label, COUNT(*) AS value
FROM onboarding_applications AS oa
JOIN customers AS c ON c.id = oa.customer_id
WHERE c.segment IN (SELECT value FROM json_each(?))
  AND oa.status IN (SELECT value FROM json_each(?))
  ${DATE_RANGE_APPLICATION}
GROUP BY c.segment
ORDER BY c.segment`.trim(),

  onboardingCountByBranch: `
SELECT b.name AS label, COUNT(*) AS value
FROM onboarding_applications AS oa
JOIN branches AS b ON b.id = oa.branch_id
WHERE 1 = 1
  ${DATE_RANGE_APPLICATION}
GROUP BY b.id, b.name
ORDER BY b.name`.trim(),

  onboardingCountMonthly: `
SELECT substr(oa.application_date, 1, 7) AS label, COUNT(*) AS value
FROM onboarding_applications AS oa
WHERE 1 = 1
  ${DATE_RANGE_APPLICATION}
GROUP BY substr(oa.application_date, 1, 7)
ORDER BY label`.trim(),

  onboardingRejectionRate: `
SELECT CAST(SUM(CASE WHEN oa.status = 'Rejected' THEN 1 ELSE 0 END) AS REAL)
  / COUNT(*) AS value
FROM onboarding_applications AS oa
WHERE 1 = 1
  ${DATE_RANGE_APPLICATION}`.trim(),

  onboardingRejectionRateByBranch: `
SELECT b.name AS label,
  CAST(SUM(CASE WHEN oa.status = 'Rejected' THEN 1 ELSE 0 END) AS REAL)
    / COUNT(*) AS value
FROM onboarding_applications AS oa
JOIN branches AS b ON b.id = oa.branch_id
WHERE 1 = 1
  ${DATE_RANGE_APPLICATION}
GROUP BY b.id, b.name
ORDER BY value DESC, b.name`.trim(),

  transactionsTotalValue: `
SELECT SUM(t.amount) AS value
FROM transactions AS t
WHERE 1 = 1
  ${DATE_RANGE_TRANSACTION}`.trim(),

  transactionsAverageValue: `
SELECT AVG(t.amount) AS value
FROM transactions AS t
WHERE 1 = 1
  ${DATE_RANGE_TRANSACTION}`.trim(),

  transactionsValueByCustomer: `
SELECT c.name AS label, SUM(t.amount) AS value
FROM transactions AS t
JOIN customers AS c ON c.id = t.customer_id
WHERE 1 = 1
  ${DATE_RANGE_TRANSACTION}
GROUP BY c.id, c.name
ORDER BY value DESC, c.name`.trim(),

  transactionsTopCustomers: `
SELECT c.name AS label, SUM(t.amount) AS value
FROM transactions AS t
JOIN customers AS c ON c.id = t.customer_id
WHERE 1 = 1
  ${DATE_RANGE_TRANSACTION}
GROUP BY c.id, c.name
ORDER BY value DESC, c.name
LIMIT ?`.trim(),

  branchCount: `
SELECT COUNT(*) AS value
FROM branches`.trim(),

  customerCountOverall: `
SELECT COUNT(*) AS value
FROM customers AS c
WHERE c.segment IN (SELECT value FROM json_each(?))`.trim(),

  customerCountBySegment: `
SELECT c.segment AS label, COUNT(*) AS value
FROM customers AS c
WHERE c.segment IN (SELECT value FROM json_each(?))
GROUP BY c.segment
ORDER BY c.segment`.trim(),

  customerCountByBranch: `
SELECT b.name AS label, COUNT(*) AS value
FROM customers AS c
JOIN branches AS b ON b.id = c.branch_id
WHERE c.segment IN (SELECT value FROM json_each(?))
GROUP BY b.id, b.name
ORDER BY b.name`.trim(),
} as const;

const TRUSTED_SQL = new Set<string>(Object.values(SQL_TEMPLATES));

function sameGroupBy(plan: QueryPlan, dimension: "segment" | "branch" | "customer"): boolean {
  return Boolean(plan.groupBy?.length === 1 && plan.groupBy[0] === dimension);
}

function dateParams(from?: string, to?: string): unknown[] {
  return [from ?? null, from ?? null, to ?? null, to ?? null];
}

function jsonList(values: readonly string[]): string {
  return JSON.stringify(values);
}

function assertSafeSelect(sql: string): void {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (!compact.toUpperCase().startsWith("SELECT ")) {
    throw new QueryBuilderError("Trusted queries must be SELECT-only.");
  }
  if (compact.includes(";")) {
    throw new QueryBuilderError("Trusted queries must be a single SELECT statement.");
  }
  if (
    /\b(DROP|DELETE|UPDATE|INSERT|ALTER|ATTACH|DETACH|PRAGMA|REPLACE|CREATE|TRUNCATE)\b/i.test(
      compact,
    )
  ) {
    throw new QueryBuilderError("Trusted queries must be SELECT-only.");
  }
}

function selectTemplate(plan: QueryPlan): BuiltQuery {
  const from = plan.dateRange?.from;
  const to = plan.dateRange?.to;

  if (plan.dataset === "branches" && plan.metric === "count") {
    return {
      sql: SQL_TEMPLATES.branchCount,
      params: [],
    };
  }

  if (plan.dataset === "customers" && plan.metric === "count") {
    const segments = jsonList(plan.filters?.segments ?? ALL_SEGMENTS);
    if (!plan.groupBy) {
      return {
        sql: SQL_TEMPLATES.customerCountOverall,
        params: [segments],
      };
    }
    if (sameGroupBy(plan, "segment")) {
      return {
        sql: SQL_TEMPLATES.customerCountBySegment,
        params: [segments],
      };
    }
    if (sameGroupBy(plan, "branch")) {
      return {
        sql: SQL_TEMPLATES.customerCountByBranch,
        params: [segments],
      };
    }
    throw new QueryBuilderError("Unsupported customer count grouping.");
  }

  if (plan.dataset === "onboarding" && plan.metric === "count") {
    if (plan.dateGroupBy === "month") {
      if (plan.groupBy || plan.filters) {
        throw new QueryBuilderError(
          "Monthly onboarding count does not support grouping or filters.",
        );
      }
      return {
        sql: SQL_TEMPLATES.onboardingCountMonthly,
        params: dateParams(from, to),
      };
    }

    if (plan.dateGroupBy) {
      throw new QueryBuilderError("Unsupported onboarding date grouping.");
    }

    const segments = jsonList(plan.filters?.segments ?? ALL_SEGMENTS);
    const statuses = jsonList(plan.filters?.statuses ?? ALL_STATUSES);

    if (!plan.groupBy) {
      return {
        sql: SQL_TEMPLATES.onboardingCountOverall,
        params: [segments, statuses, ...dateParams(from, to)],
      };
    }

    if (sameGroupBy(plan, "segment")) {
      return {
        sql: SQL_TEMPLATES.onboardingCountBySegment,
        params: [segments, statuses, ...dateParams(from, to)],
      };
    }

    if (sameGroupBy(plan, "branch")) {
      if (plan.filters) {
        throw new QueryBuilderError(
          "Onboarding count by branch does not support segment or status filters.",
        );
      }
      return {
        sql: SQL_TEMPLATES.onboardingCountByBranch,
        params: dateParams(from, to),
      };
    }

    throw new QueryBuilderError("Unsupported onboarding count grouping.");
  }

  if (plan.dataset === "onboarding" && plan.metric === "rejection_rate") {
    if (plan.filters || plan.dateGroupBy) {
      throw new QueryBuilderError(
        "Rejection rate does not support filters or date grouping.",
      );
    }
    if (!plan.groupBy) {
      return {
        sql: SQL_TEMPLATES.onboardingRejectionRate,
        params: dateParams(from, to),
      };
    }
    if (sameGroupBy(plan, "branch")) {
      return {
        sql: SQL_TEMPLATES.onboardingRejectionRateByBranch,
        params: dateParams(from, to),
      };
    }
    throw new QueryBuilderError("Unsupported rejection rate grouping.");
  }

  if (plan.dataset === "transactions" && plan.metric === "sum") {
    if (plan.filters || plan.dateGroupBy) {
      throw new QueryBuilderError(
        "Transaction value queries do not support filters or date grouping.",
      );
    }
    if (!plan.groupBy) {
      if (plan.limit !== undefined) {
        throw new QueryBuilderError("Total transaction value does not support limit.");
      }
      return {
        sql: SQL_TEMPLATES.transactionsTotalValue,
        params: dateParams(from, to),
      };
    }
    if (sameGroupBy(plan, "customer")) {
      if (plan.limit === undefined) {
        return {
          sql: SQL_TEMPLATES.transactionsValueByCustomer,
          params: dateParams(from, to),
        };
      }
      return {
        sql: SQL_TEMPLATES.transactionsTopCustomers,
        params: [...dateParams(from, to), plan.limit],
      };
    }
    throw new QueryBuilderError("Unsupported transaction grouping.");
  }

  if (plan.dataset === "transactions" && plan.metric === "average") {
    if (plan.filters || plan.groupBy || plan.dateGroupBy || plan.limit !== undefined) {
      throw new QueryBuilderError(
        "Average transaction value is an aggregate KPI and does not support grouping, filters, or limit.",
      );
    }
    return {
      sql: SQL_TEMPLATES.transactionsAverageValue,
      params: dateParams(from, to),
    };
  }

  throw new QueryBuilderError("Unsupported QueryPlan combination.");
}

export function buildQuery(input: unknown): BuiltQuery {
  let plan: QueryPlan;
  try {
    plan = parseQueryPlan(input);
  } catch {
    throw new QueryBuilderError(
      "QueryBuilder only accepts a validated QueryPlan; raw SQL is not allowed.",
    );
  }

  const built = selectTemplate(plan);

  if (!TRUSTED_SQL.has(built.sql)) {
    throw new QueryBuilderError("Refusing to execute SQL that is not a trusted template.");
  }

  assertSafeSelect(built.sql);
  return built;
}
