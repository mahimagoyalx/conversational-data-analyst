import type { ChatMessage } from "../types";
import { analyticsToDelimitedTable } from "../tableExport";
import CopyButton from "./CopyButton";
import KpiCard from "./KpiCard";
import ResultChart from "./ResultChart";
import ResultTable from "./ResultTable";

type MessageProps = {
  message: ChatMessage;
};

export default function Message({ message }: MessageProps) {
  const result = message.result;
  const visualization = result?.visualization;
  const valueLabel =
    result?.columns.find((column) => column.key === "value")?.label ?? "Value";

  return (
    <article
      className={`message message--${message.role}${message.errorCode ? " message--error" : ""}`}
    >
      <p className="message__role">{message.role === "user" ? "You" : "Analyst"}</p>
      <p className="message__text">{message.text}</p>
      {result && visualization?.type === "kpi" && (
        <KpiCard
          title={visualization.title}
          value={result.rows[0]?.value ?? null}
          valueLabel={valueLabel}
        />
      )}
      {result && visualization?.type === "table" && (
        <ResultTable columns={result.columns} rows={result.rows} />
      )}
      {result && (visualization?.type === "bar" || visualization?.type === "line") && (
        <>
          <ResultChart
            type={visualization.type}
            title={visualization.title}
            rows={result.rows}
            columns={result.columns}
          />
          <ResultTable columns={result.columns} rows={result.rows} />
        </>
      )}
      {result && (
        <div className="message__actions">
          <CopyButton label="Copy Answer" text={result.answer} />
          <CopyButton
            label="Copy Data"
            text={analyticsToDelimitedTable(result.columns, result.rows)}
          />
        </div>
      )}
    </article>
  );
}
