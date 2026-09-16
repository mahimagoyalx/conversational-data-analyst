import { formatMetricValue } from "../format";

type KpiCardProps = {
  title: string;
  value: number | null;
  valueLabel: string;
};

export default function KpiCard({ title, value, valueLabel }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <p className="kpi-card__label">{title}</p>
      <p className="kpi-card__value">{formatMetricValue(value, valueLabel)}</p>
    </div>
  );
}
