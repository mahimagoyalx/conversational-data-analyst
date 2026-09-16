import type { QueryPlan } from "../schemas/queryPlan.js";

export type VisualizationType = "kpi" | "table" | "bar" | "line";

export type Visualization = {
  type: VisualizationType;
  title: string;
};

export type AnalyticsColumn = {
  key: string;
  label: string;
};

export type AnalyticsRow = {
  label?: string;
  value: number | null;
};

export type AnalyticsResult = {
  answer: string;
  visualization: Visualization;
  columns: AnalyticsColumn[];
  rows: AnalyticsRow[];
};

type SqliteRow = {
  label?: string | number;
  value?: number | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatValue(plan: QueryPlan, value: number): string {
  if (plan.metric === "rejection_rate") {
    return formatRate(value);
  }
  if (plan.metric === "sum" || plan.metric === "average") {
    return formatMoney(value);
  }
  return formatCount(value);
}

function valueColumnLabel(plan: QueryPlan): string {
  if (plan.dataset === "branches") {
    return "Branch count";
  }
  if (plan.dataset === "customers") {
    return "Customer count";
  }
  if (plan.metric === "rejection_rate") {
    return "Rejection rate";
  }
  if (plan.metric === "average") {
    return "Average transaction value";
  }
  if (plan.metric === "sum") {
    return "Transaction value";
  }
  return "Onboarding count";
}

function labelColumn(plan: QueryPlan): AnalyticsColumn {
  if (plan.dateGroupBy === "month") {
    return { key: "label", label: "Month" };
  }
  if (plan.groupBy?.[0] === "branch") {
    return { key: "label", label: "Branch" };
  }
  if (plan.groupBy?.[0] === "customer") {
    return { key: "label", label: "Customer" };
  }
  return { key: "label", label: "Segment" };
}

export function chooseVisualization(plan: QueryPlan): Visualization {
  if (plan.dateGroupBy === "month") {
    return { type: "line", title: "Monthly onboarding volume" };
  }

  if (plan.groupBy?.[0] === "customer" && plan.limit === undefined) {
    return { type: "table", title: "Transaction value by customer" };
  }

  if (plan.groupBy?.[0] === "customer") {
    return {
      type: "bar",
      title: `Top ${plan.limit} customers by transaction value`,
    };
  }

  if (plan.groupBy?.[0] === "branch") {
    return {
      type: "bar",
      title:
        plan.metric === "rejection_rate"
          ? "Rejection rate by branch"
          : plan.dataset === "customers"
            ? "Customers by branch"
            : "Onboarding by branch",
    };
  }

  if (plan.groupBy?.[0] === "segment") {
    return {
      type: "bar",
      title:
        plan.dataset === "customers"
          ? "Customers by segment"
          : "Onboarding by segment",
    };
  }

  if (plan.dataset === "branches") {
    return { type: "kpi", title: "Number of branches" };
  }
  if (plan.dataset === "customers") {
    return { type: "kpi", title: "Number of customers" };
  }

  if (plan.metric === "rejection_rate") {
    return { type: "kpi", title: "Rejection rate" };
  }
  if (plan.metric === "average") {
    return { type: "kpi", title: "Average transaction value" };
  }
  if (plan.metric === "sum") {
    return { type: "kpi", title: "Total transaction value" };
  }
  return { type: "kpi", title: "Onboarding count" };
}

export function toAnalyticsRows(rawRows: unknown[]): AnalyticsRow[] {
  return (rawRows as SqliteRow[]).map((row) => {
    const value = toNumber(row.value);
    if (row.label !== undefined) {
      return { label: String(row.label), value };
    }
    return { value };
  });
}

export function buildColumns(plan: QueryPlan): AnalyticsColumn[] {
  if (plan.groupBy || plan.dateGroupBy) {
    return [labelColumn(plan), { key: "value", label: valueColumnLabel(plan) }];
  }
  return [{ key: "value", label: valueColumnLabel(plan) }];
}

export function buildAnswer(plan: QueryPlan, rows: AnalyticsRow[]): string {
  if (rows.length === 0 || rows.every((row) => row.value === null)) {
    return "No matching records were found.";
  }

  if (!plan.groupBy && !plan.dateGroupBy) {
    const value = rows[0]?.value;
    if (value === null || value === undefined) {
      return "No matching records were found.";
    }
    if (plan.metric === "rejection_rate") {
      return `The onboarding rejection rate is ${formatRate(value)}.`;
    }
    if (plan.metric === "average") {
      return `The average transaction value is ${formatMoney(value)}.`;
    }
    if (plan.metric === "sum") {
      return `Total transaction value is ${formatMoney(value)}.`;
    }
    if (plan.dataset === "branches") {
      return `There are ${formatCount(value)} branches.`;
    }
    if (plan.dataset === "customers") {
      const segment =
        plan.filters?.segments?.length === 1 ? plan.filters.segments[0] : undefined;
      if (segment) {
        return `There are ${formatCount(value)} ${segment} customers.`;
      }
      return `There are ${formatCount(value)} customers.`;
    }
    const segment = plan.filters?.segments?.length === 1 ? plan.filters.segments[0] : undefined;
    const status = plan.filters?.statuses?.length === 1 ? plan.filters.statuses[0].toLowerCase() : undefined;
    if (segment && status) {
      return `There were ${formatCount(value)} ${status} ${segment} onboarding applications.`;
    }
    if (segment) {
      return `There were ${formatCount(value)} ${segment} onboarding applications.`;
    }
    if (status) {
      return `There were ${formatCount(value)} ${status} onboarding applications.`;
    }
    return `There were ${formatCount(value)} onboarding applications.`;
  }

  const parts = rows
    .filter((row) => row.label !== undefined && row.value !== null)
    .map((row) => `${row.label} ${formatValue(plan, row.value as number)}`);

  if (parts.length === 0) {
    return "No matching records were found.";
  }

  if (plan.dateGroupBy === "month") {
    const peak = rows.reduce((best, row) =>
      (row.value ?? -Infinity) > (best.value ?? -Infinity) ? row : best,
    );
    return `Monthly onboarding volume: ${parts.join(", ")}. Highest month: ${peak.label} with ${formatCount(peak.value as number)} applications.`;
  }

  if (plan.groupBy?.[0] === "customer" && plan.limit === undefined) {
    const top = rows[0];
    return `Transaction value by customer. Highest is ${top.label} at ${formatMoney(top.value as number)}.`;
  }

  if (plan.groupBy?.[0] === "branch" && plan.metric === "rejection_rate") {
    const peak = rows.reduce((best, row) =>
      (row.value ?? -Infinity) > (best.value ?? -Infinity) ? row : best,
    );
    return `${peak.label} has the highest rejection rate at ${formatRate(peak.value as number)}. Rejection rate by branch: ${parts.join(", ")}.`;
  }

  return `${chooseVisualization(plan).title}: ${parts.join(", ")}.`;
}

export function presentAnalytics(plan: QueryPlan, rawRows: unknown[]): AnalyticsResult {
  const rows = toAnalyticsRows(rawRows);
  return {
    answer: buildAnswer(plan, rows),
    visualization: chooseVisualization(plan),
    columns: buildColumns(plan),
    rows,
  };
}
