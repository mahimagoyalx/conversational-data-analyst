import { formatMetricValue } from "../format";
import type { AnalyticsColumn, AnalyticsRow } from "../types";

type ResultTableProps = {
  columns: AnalyticsColumn[];
  rows: AnalyticsRow[];
};

export default function ResultTable({ columns, rows }: ResultTableProps) {
  const valueLabel =
    columns.find((column) => column.key === "value")?.label ?? "Value";

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label ?? "row"}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.key === "value"
                    ? formatMetricValue(row.value, valueLabel)
                    : (row.label ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
