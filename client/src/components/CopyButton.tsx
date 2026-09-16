import { useCopyToClipboard } from "../useCopyToClipboard";

type CopyButtonProps = {
  label: string;
  text: string;
  copiedLabel?: string;
  failedLabel?: string;
};

export default function CopyButton({
  label,
  text,
  copiedLabel = "Copied",
  failedLabel = "Copy failed",
}: CopyButtonProps) {
  const { status, copy } = useCopyToClipboard();

  const display =
    status === "copied" ? copiedLabel : status === "failed" ? failedLabel : label;

  return (
    <button
      type="button"
      className={`copy-button${status === "failed" ? " copy-button--failed" : ""}`}
      onClick={() => {
        void copy(text);
      }}
    >
      {display}
    </button>
  );
}
