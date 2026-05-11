import { ValidationError, NotFoundError } from '../utils/errors.js';

/**
 * Global error handler middleware
 * Catches all errors and returns appropriate HTTP status codes
 * Collects all validation errors in details[] array (no fail-fast)
 */
export const errorHandler = (err, req, res, next) => {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || [err.message],
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
};
