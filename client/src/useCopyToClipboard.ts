import { useEffect, useRef, useState } from "react";
import { copyText } from "./clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

export function useCopyToClipboard(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copy(text: string) {
    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
    }

    try {
      await copyText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    timeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
    }, resetMs);
  }

  return { status, copy };
}
