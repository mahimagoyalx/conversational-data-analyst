import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { SUGGESTED_QUESTIONS } from "./components/Chat";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the application title and suggested questions", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /conversational data analyst/i }),
    ).toBeInTheDocument();
    for (const question of SUGGESTED_QUESTIONS) {
      expect(screen.getByRole("button", { name: question })).toBeInTheDocument();
    }
  });

  it("shows an error when submitting an empty question", () => {
    render(<App />);
    fireEvent.submit(screen.getByRole("button", { name: /ask/i }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /enter a question before asking/i,
    );
  });

  it("calls POST /api/chat and renders the analytics answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          answer: "There were 53 Retail onboarding applications.",
          visualization: { type: "kpi", title: "Onboarding count" },
          columns: [{ key: "value", label: "Onboarding count" }],
          rows: [{ value: 53 }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: "How many Retail customers were onboarded?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(
        screen.getByText("There were 53 Retail onboarding applications."),
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "How many Retail customers were onboarded?",
        }),
      }),
    );
    expect(screen.getByText("Onboarding count")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Data" })).toBeInTheDocument();

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy Answer" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "There were 53 Retail onboarding applications.",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy Data" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Onboarding count\n53");
    });
  });
});
