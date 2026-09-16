import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetricValue } from "../format";
import type { AnalyticsColumn, AnalyticsRow, VisualizationType } from "../types";

type ResultChartProps = {
  type: Extract<VisualizationType, "bar" | "line">;
  title: string;
  rows: AnalyticsRow[];
  columns: AnalyticsColumn[];
};

export default function ResultChart({
  type,
  title,
  rows,
  columns,
}: ResultChartProps) {
  const valueLabel =
    columns.find((column) => column.key === "value")?.label ?? "Value";
  const data = rows.map((row) => ({
    label: row.label ?? "",
    value: row.value ?? 0,
  }));

  const tickFormatter = (value: number) => formatMetricValue(value, valueLabel);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="chart-card__plot">
        <ResponsiveContainer width="100%" height={280}>
          {type === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={tickFormatter} width={80} />
              <Tooltip
                formatter={(value) =>
                  formatMetricValue(typeof value === "number" ? value : Number(value), valueLabel)
                }
              />
              <Line type="monotone" dataKey="value" stroke="#1f4e79" strokeWidth={2} dot />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={tickFormatter} width={80} />
              <Tooltip
                formatter={(value) =>
                  formatMetricValue(typeof value === "number" ? value : Number(value), valueLabel)
                }
              />
              <Bar dataKey="value" fill="#1f4e79" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
