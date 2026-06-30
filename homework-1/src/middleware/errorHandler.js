'use strict';

/**
 * Lightweight HTTP error with an associated status code.
 * Thrown by routes/services and rendered by `errorHandler`.
 */
class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {Array<{field: string, message: string}>} [details]
   */
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** 404 fallback for unmatched routes. */
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', message: `No route for ${req.method} ${req.path}` });
}

/* eslint-disable no-unused-vars */
/**
 * Centralized error renderer. Maps HttpError -> its status/shape; everything
 * else -> 500. Validation errors carry a `details[]` array.
 */
function errorHandler(err, req, res, next) {
  // Malformed JSON body (thrown by express.json()).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (err instanceof HttpError) {
    const payload = { error: err.message };
    if (err.details) payload.details = err.details;
    return res.status(err.status).json(payload);
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
/* eslint-enable no-unused-vars */

module.exports = { HttpError, notFoundHandler, errorHandler };
