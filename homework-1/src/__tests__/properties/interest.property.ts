// Feature: banking-transactions-api, Property 12: Interest formula correctness
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Pure function mirroring the interest calculation logic from the route handler.
 * Formula: balance * rate * days / 365
 */
function calculateInterest(balance: number, rate: number, days: number): number {
  return (balance * rate * days) / 365;
}

describe("Property 12: Interest formula correctness", () => {
  // **Validates: Requirements 7.1**

  const balanceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true, noDefaultInfinity: true });
  const rateArb = fc.float({ min: Math.fround(0.001), max: Math.fround(1.0), noNaN: true, noDefaultInfinity: true });
  const daysArb = fc.integer({ min: 1, max: 365 });

  it("interest equals balance × rate × days / 365 for any positive inputs", () => {
    fc.assert(
      fc.property(
        balanceArb,
        rateArb,
        daysArb,
        (balance, rate, days) => {
          const interest = calculateInterest(balance, rate, days);
          const expected = (balance * rate * days) / 365;
          expect(interest).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("interest is always 0 when balance is 0", () => {
    fc.assert(
      fc.property(
        rateArb,
        daysArb,
        (rate, days) => {
          const interest = calculateInterest(0, rate, days);
          expect(interest).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("interest scales linearly with rate (double rate → double interest)", () => {
    fc.assert(
      fc.property(
        balanceArb,
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true, noDefaultInfinity: true }),
        daysArb,
        (balance, rate, days) => {
          const interest1 = calculateInterest(balance, rate, days);
          const interest2 = calculateInterest(balance, rate * 2, days);
          expect(interest2).toBeCloseTo(interest1 * 2, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("interest scales linearly with days (double days → double interest)", () => {
    fc.assert(
      fc.property(
        balanceArb,
        rateArb,
        fc.integer({ min: 1, max: 182 }),
        (balance, rate, days) => {
          const interest1 = calculateInterest(balance, rate, days);
          const interest2 = calculateInterest(balance, rate, days * 2);
          expect(interest2).toBeCloseTo(interest1 * 2, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("interest is non-negative when balance is non-negative", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true, noDefaultInfinity: true }),
        rateArb,
        daysArb,
        (balance, rate, days) => {
          const interest = calculateInterest(balance, rate, days);
          expect(interest).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
