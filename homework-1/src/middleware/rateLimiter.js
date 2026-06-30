'use strict';

/**
 * Fixed-window in-memory rate limiter: at most `max` requests per `windowMs`
 * per client IP. Returns 429 with a Retry-After header when exceeded.
 *
 * In-memory only (single process) — adequate for this assignment; a real
 * deployment would use a shared store (e.g. Redis).
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000]
 * @param {number} [options.max=100]
 * @returns {import('express').RequestHandler}
 */
function rateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 100;

  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Too Many Requests', retryAfter });
    }

    return next();
  };
}

module.exports = { rateLimiter };
