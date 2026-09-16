import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("createApp", () => {
  it("creates an Express application", () => {
    const app = createApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe("function");
  });
});
