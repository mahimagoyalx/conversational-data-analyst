import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { setupDatabase } from "../src/db/database.js";

describe("createApp", () => {
  it("creates an Express application", () => {
    const db = setupDatabase(":memory:");
    const app = createApp({ db });
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe("function");
    db.close();
  });
});
