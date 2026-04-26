import { ValidationError, NotFoundError } from '../utils/errors.js';

export function notFoundHandler(_req, res, _next) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      details: err.details,
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
