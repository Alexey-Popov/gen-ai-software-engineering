import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

describe("Property-Based Testing Setup", () => {
  it("should have fast-check configured correctly", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(typeof n).toBe("number");
      }),
      { numRuns: 10 }
    );
  });
});
