/**
 * Global error handler middleware
 * Catches all errors and returns appropriate HTTP status codes
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // NotFoundError
  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: err.message });
  }

  // ValidationError
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || [err.message],
    });
  }

  // Default 500
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
};
