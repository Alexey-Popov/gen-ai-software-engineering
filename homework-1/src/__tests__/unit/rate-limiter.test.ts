import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { check, record, reset } from "@/lib/rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const result = check("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });

  it("decrements remaining count after recording", () => {
    record("192.168.1.1");
    const result = check("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("rejects requests when limit of 100 is reached", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 100; i++) {
      record(ip);
    }

    const result = check(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";

    for (let i = 0; i < 100; i++) {
      record(ip1);
    }

    const result1 = check(ip1);
    const result2 = check(ip2);

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(100);
  });

  it("allows requests again after the 60-second window expires", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 100; i++) {
      record(ip);
    }

    // Should be rejected now
    expect(check(ip).allowed).toBe(false);

    // Advance time past the 60-second window
    vi.advanceTimersByTime(60_000);

    // Should be allowed again
    const result = check(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });

  it("uses a sliding window - partial expiry frees up capacity", () => {
    const ip = "10.0.0.1";

    // Record 50 requests at time 0
    for (let i = 0; i < 50; i++) {
      record(ip);
    }

    // Advance 30 seconds, record 50 more
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 50; i++) {
      record(ip);
    }

    // All 100 requests are within window - should be rejected
    expect(check(ip).allowed).toBe(false);

    // Advance another 30 seconds - the first 50 expire (they're now 60s old)
    vi.advanceTimersByTime(30_000);

    const result = check(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });

  it("returns a valid resetAt timestamp", () => {
    const ip = "10.0.0.1";
    const now = Date.now();

    record(ip);
    const result = check(ip);

    // resetAt should be approximately now + 60 seconds (the first request expiry)
    expect(result.resetAt).toBe(now + 60_000);
  });

  it("returns resetAt as now + 60s when no prior requests", () => {
    const ip = "10.0.0.1";
    const now = Date.now();

    const result = check(ip);
    expect(result.resetAt).toBe(now + 60_000);
  });

  it("reset() clears all state", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 100; i++) {
      record(ip);
    }
    expect(check(ip).allowed).toBe(false);

    reset();

    expect(check(ip).allowed).toBe(true);
    expect(check(ip).remaining).toBe(100);
  });
});
