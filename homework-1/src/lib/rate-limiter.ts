/**
 * Rate Limiter - sliding window counter implementation per IP address.
 *
 * Tracks requests per IP using a Map of IP → timestamp arrays.
 * Allows up to 100 requests per 60-second sliding window.
 */

const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 100;

const requestLog: Map<string, number[]> = new Map();

/**
 * Prune timestamps older than the sliding window from the given array.
 */
function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((ts) => now - ts < WINDOW_MS);
}

/**
 * Check whether the given IP is allowed to make a request.
 * Returns whether the request is allowed, how many requests remain, and
 * when the earliest tracked request will expire (resetAt).
 */
export function check(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const timestamps = prune(requestLog.get(ip) ?? [], now);

  // Update the stored timestamps after pruning
  requestLog.set(ip, timestamps);

  const count = timestamps.length;
  const allowed = count < MAX_REQUESTS;
  const remaining = Math.max(0, MAX_REQUESTS - count);

  // resetAt: the time when the earliest request in the window expires
  const resetAt =
    timestamps.length > 0 ? timestamps[0] + WINDOW_MS : now + WINDOW_MS;

  return { allowed, remaining, resetAt };
}

/**
 * Record a request from the given IP address.
 */
export function record(ip: string): void {
  const now = Date.now();
  const timestamps = prune(requestLog.get(ip) ?? [], now);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
}

/**
 * Reset the rate limiter state. Used for testing purposes.
 */
export function reset(): void {
  requestLog.clear();
}
