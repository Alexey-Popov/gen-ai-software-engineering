// Feature: banking-transactions-api, Property 14: Rate limiter sliding window enforcement
// **Validates: Requirements 9.1, 9.2, 9.3**

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import { check, record, reset } from "@/lib/rate-limiter";

describe("Property 14: Rate limiter sliding window enforcement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to 100 requests and rejects subsequent ones within the sliding window", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 0, max: 150 }),
        (ip, requestCount) => {
          reset();

          // Record requestCount requests for the IP
          for (let i = 0; i < requestCount; i++) {
            record(ip);
          }

          const result = check(ip);

          if (requestCount <= 100) {
            // Should still be allowed (check doesn't record, so count is requestCount)
            // After recording requestCount requests, remaining = 100 - requestCount
            expect(result.allowed).toBe(requestCount < 100);
            expect(result.remaining).toBe(Math.max(0, 100 - requestCount));
          } else {
            // Should be rejected - more than 100 requests recorded
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("after recording exactly 100 requests, the next check returns allowed: false", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        reset();

        // Record exactly 100 requests
        for (let i = 0; i < 100; i++) {
          record(ip);
        }

        const result = check(ip);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("IPs are independent: recording requests for one IP does not affect another", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.ipV4(),
        fc.integer({ min: 0, max: 150 }),
        fc.integer({ min: 0, max: 150 }),
        (ip1, ip2, count1, count2) => {
          // Skip if IPs are the same - independence test requires distinct IPs
          fc.pre(ip1 !== ip2);

          reset();

          // Record count1 requests for ip1
          for (let i = 0; i < count1; i++) {
            record(ip1);
          }

          // Record count2 requests for ip2
          for (let i = 0; i < count2; i++) {
            record(ip2);
          }

          // Check each IP independently
          const result1 = check(ip1);
          const result2 = check(ip2);

          // ip1's limit is evaluated based only on its own requests
          if (count1 < 100) {
            expect(result1.allowed).toBe(true);
            expect(result1.remaining).toBe(100 - count1);
          } else {
            expect(result1.allowed).toBe(false);
            expect(result1.remaining).toBe(0);
          }

          // ip2's limit is evaluated based only on its own requests
          if (count2 < 100) {
            expect(result2.allowed).toBe(true);
            expect(result2.remaining).toBe(100 - count2);
          } else {
            expect(result2.allowed).toBe(false);
            expect(result2.remaining).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("after requests age past the 1-minute window, new requests are allowed again", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 100, max: 150 }),
        (ip, requestCount) => {
          reset();

          // Fill up the rate limit
          for (let i = 0; i < requestCount; i++) {
            record(ip);
          }

          // Should be rejected
          expect(check(ip).allowed).toBe(false);

          // Advance time past the 60-second window so all requests expire
          vi.advanceTimersByTime(60_000);

          // Should be allowed again - all old timestamps pruned
          const result = check(ip);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});
