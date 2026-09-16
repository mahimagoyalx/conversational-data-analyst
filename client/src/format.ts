export function formatMetricValue(
  value: number | null | undefined,
  columnLabel: string,
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const label = columnLabel.toLowerCase();
  if (label.includes("rejection")) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (label.includes("transaction") || label.includes("value")) {
    return `₹${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
