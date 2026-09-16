import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./components/CopyButton";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", {
    clipboard: { writeText },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("copies text and shows a Copied state", async () => {
    render(<CopyButton label="Copy Answer" text="There are 5 branches." />);

    fireEvent.click(screen.getByRole("button", { name: "Copy Answer" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("There are 5 branches.");
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });

  it("shows Copy failed when the clipboard write is rejected", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(false),
    });
    render(<CopyButton label="Copy Data" text="Branch\tCount" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy Data" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument();
    });
  });
});
