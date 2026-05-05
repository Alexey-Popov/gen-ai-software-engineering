/**
 * Custom error classes for validation and not found errors
 */

export class ValidationError extends Error {
  constructor(details = []) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.details = Array.isArray(details) ? details : [details];
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
