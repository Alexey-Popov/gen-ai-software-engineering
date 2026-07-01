import { describe, it, expect } from "vitest";

describe("Project Setup", () => {
  it("should have vitest configured correctly", () => {
    expect(true).toBe(true);
  });

  it("should resolve path aliases", async () => {
    // This will be useful once we have modules to import
    expect(typeof import.meta.url).toBe("string");
  });
});
