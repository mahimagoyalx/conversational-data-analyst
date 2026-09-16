import { formatMetricValue } from "./format";
import type { AnalyticsColumn, AnalyticsRow } from "./types";

function escapeCell(value: string, delimiter: string): string {
  if (delimiter === "\t") {
    return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function analyticsToDelimitedTable(
  columns: AnalyticsColumn[],
  rows: AnalyticsRow[],
  delimiter = "\t",
): string {
  const valueLabel =
    columns.find((column) => column.key === "value")?.label ?? "Value";
  const header = columns
    .map((column) => escapeCell(column.label, delimiter))
    .join(delimiter);
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const cell =
            column.key === "value"
              ? formatMetricValue(row.value, valueLabel)
              : (row.label ?? "");
          return escapeCell(cell, delimiter);
        })
        .join(delimiter),
    )
    .join("\n");
  return body.length > 0 ? `${header}\n${body}` : header;
}
