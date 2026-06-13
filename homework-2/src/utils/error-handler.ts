import { Request, Response, NextFunction } from 'express';

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly details: Array<{ field: string; message: string }>;
  constructor(
    message: string,
    details: Array<{ field: string; message: string }> = []
  ) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ServerError extends Error {
  readonly statusCode = 500;
  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'ServerError';
  }
}

let requestCounter = 0;

export function generateRequestId(): string {
  return `req-${++requestCounter}`;
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as any).requestId = generateRequestId();
  next();
}

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || generateRequestId();
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    details: err.details || [],
    requestId,
  });
}
