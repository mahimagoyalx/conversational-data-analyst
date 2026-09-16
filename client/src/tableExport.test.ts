import { describe, expect, it } from "vitest";
import { analyticsToDelimitedTable } from "./tableExport";

describe("analyticsToDelimitedTable", () => {
  it("exports tab-separated headers and rows by default", () => {
    const table = analyticsToDelimitedTable(
      [
        { key: "label", label: "Branch" },
        { key: "value", label: "Rejection rate" },
      ],
      [
        { label: "Campus", value: 0.364 },
        { label: "Downtown", value: 0.2 },
      ],
    );

    expect(table).toBe("Branch\tRejection rate\nCampus\t36.4%\nDowntown\t20.0%");
  });

  it("quotes CSV cells that contain commas or quotes", () => {
    const table = analyticsToDelimitedTable(
      [
        { key: "label", label: "Segment, name" },
        { key: "value", label: "Onboarding count" },
      ],
      [{ label: 'Retail "core"', value: 53 }],
      ",",
    );

    expect(table).toBe('"Segment, name",Onboarding count\n"Retail ""core""",53');
  });
});
