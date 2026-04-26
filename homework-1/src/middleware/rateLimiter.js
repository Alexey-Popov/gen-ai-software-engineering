import { rateLimit } from 'express-rate-limit';

// Defaults: 100 requests per minute per IP. Both knobs are env-overridable
// so the limit can be lowered to easily demonstrate the 429 response.
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const max = Number(process.env.RATE_LIMIT_MAX) || 100;

export const rateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${max} requests per ${Math.round(windowMs / 1000)}s per IP.`,
    });
  },
});
