import {
  validateCreateTicket,
  validateEmail,
  validateStringLength,
  ValidationError,
} from '../src/validators/ticket-validator';
import { Category, Priority } from '../src/models/ticket';
import {
  NotFoundError,
  ValidationError as HandlerValidationError,
  ConflictError,
  ServerError,
  generateRequestId,
  requestIdMiddleware,
  errorMiddleware,
} from '../src/utils/error-handler';

const basePayload = {
  customer_id: 'cust-001',
  customer_email: 'john@example.com',
  customer_name: 'John Doe',
  subject: 'Login not working',
  description: 'I cannot log into my account after the recent password reset.',
  category: Category.AccountAccess,
  priority: Priority.High,
  status: 'new' as const,
};

// Test 1
it('valid ticket payload passes Zod schema without errors', () => {
  const result = validateCreateTicket(basePayload);
  expect(result.customer_id).toBe('cust-001');
  expect(result.category).toBe(Category.AccountAccess);
  expect(result.priority).toBe(Priority.High);
});

// Test 2
it('missing customer_email is rejected with ValidationError', () => {
  const { customer_email: _e, ...withoutEmail } = basePayload;
  expect(() => validateCreateTicket(withoutEmail)).toThrow(ValidationError);
});

// Test 3
it('invalid email format is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, customer_email: 'not-an-email' })
  ).toThrow(ValidationError);
});

// Test 4
it('empty subject (shorter than 1 char) is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, subject: '' })
  ).toThrow(ValidationError);
});

// Test 5
it('subject longer than 200 chars is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, subject: 'x'.repeat(201) })
  ).toThrow(ValidationError);
});

// Test 6
it('description shorter than 10 chars is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, description: 'short' })
  ).toThrow(ValidationError);
});

// Test 7
it('unknown category enum value is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, category: 'invalid_category' })
  ).toThrow(ValidationError);
});

// Test 8
it('unknown priority enum value is rejected', () => {
  expect(() =>
    validateCreateTicket({ ...basePayload, priority: 'critical' })
  ).toThrow(ValidationError);
});

// Test 9
it('optional fields (tags, metadata) are accepted when omitted', () => {
  const { category: _c, priority: _p, ...minimal } = basePayload;
  const result = validateCreateTicket(minimal);
  expect(result.category).toBeUndefined();
  expect(result.priority).toBeUndefined();
  expect(result.tags).toBeUndefined();
  expect(result.metadata).toBeUndefined();
});

// ─── Error handler classes ──────────────────────────────────────────────────

// Test 10
it('NotFoundError has statusCode 404 and correct name', () => {
  const err = new NotFoundError('resource missing');
  expect(err.statusCode).toBe(404);
  expect(err.name).toBe('NotFoundError');
  expect(err.message).toBe('resource missing');
});

// Test 11
it('HandlerValidationError has statusCode 400 and details array', () => {
  const details = [{ field: 'email', message: 'Invalid' }];
  const err = new HandlerValidationError('bad input', details);
  expect(err.statusCode).toBe(400);
  expect(err.details).toEqual(details);
});

// Test 12
it('ConflictError has statusCode 409', () => {
  const err = new ConflictError('duplicate');
  expect(err.statusCode).toBe(409);
  expect(err.name).toBe('ConflictError');
});

// Test 13
it('ServerError has statusCode 500', () => {
  const err = new ServerError('unexpected');
  expect(err.statusCode).toBe(500);
  expect(err.name).toBe('ServerError');
});

// Test 14
it('generateRequestId returns incrementing req-N strings', () => {
  const id1 = generateRequestId();
  const id2 = generateRequestId();
  expect(id1).toMatch(/^req-\d+$/);
  expect(id2).toMatch(/^req-\d+$/);
  expect(id1).not.toBe(id2);
});

// Test 15
it('requestIdMiddleware attaches a requestId to the request object', () => {
  const req: any = {};
  const res: any = {};
  const next = jest.fn();
  requestIdMiddleware(req, res, next);
  expect(req.requestId).toMatch(/^req-\d+$/);
  expect(next).toHaveBeenCalled();
});

// Test 16
it('errorMiddleware maps statusCode to HTTP response', () => {
  const err = new NotFoundError('not found');
  const req: any = { requestId: 'req-test' };
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res: any = { status };
  const next: any = jest.fn();
  errorMiddleware(err, req, res, next);
  expect(status).toHaveBeenCalledWith(404);
  expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not found' }));
});

// Test 17: errorMiddleware without requestId on req falls back to generated id
it('errorMiddleware generates a requestId when req lacks one', () => {
  const err = new ServerError('oops');
  const req: any = {};
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res: any = { status };
  errorMiddleware(err, req, res, jest.fn());
  expect(status).toHaveBeenCalledWith(500);
  const payload = json.mock.calls[0][0];
  expect(payload.requestId).toMatch(/^req-\d+$/);
});

// Test 18: error class default messages
it('error classes use default messages when none provided', () => {
  expect(new NotFoundError().message).toBe('Not found');
  expect(new ConflictError().message).toBe('Conflict');
  expect(new ServerError().message).toBe('Internal server error');
  // Default details array branch (no second argument)
  expect(new HandlerValidationError('bad').details).toHaveLength(0);
});

// Test 23: errorMiddleware falls back to 500 and default message for plain Error
it('errorMiddleware uses 500 and default message for a plain Error', () => {
  const err = new Error('unexpected');
  const req: any = { requestId: 'req-x' };
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res: any = { status };
  errorMiddleware(err, req, res, jest.fn());
  expect(status).toHaveBeenCalledWith(500);
  expect(json.mock.calls[0][0].error).toBe('unexpected');
});

// Test 24: errorMiddleware uses 'Internal Server Error' when err has no message
it('errorMiddleware uses default message when err has no message', () => {
  const err: any = { statusCode: 503 };
  const req: any = { requestId: 'req-y' };
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res: any = { status };
  errorMiddleware(err, req, res, jest.fn());
  expect(status).toHaveBeenCalledWith(503);
  expect(json.mock.calls[0][0].error).toBe('Internal Server Error');
});

// ─── validateEmail and validateStringLength helpers ─────────────────────────

// Test 19
it('validateEmail returns true for a valid email address', () => {
  expect(validateEmail('user@domain.com')).toBe(true);
  expect(validateEmail('user@mail.domain.co.uk')).toBe(true);
});

// Test 20
it('validateEmail returns false for invalid email strings', () => {
  expect(validateEmail('not-an-email')).toBe(false);
  expect(validateEmail('user@')).toBe(false);
  expect(validateEmail('')).toBe(false);
});

// Test 21
it('validateStringLength returns true when length is within bounds', () => {
  expect(validateStringLength('hello', 1, 10)).toBe(true);
  expect(validateStringLength('a', 1, 5)).toBe(true);
  expect(validateStringLength('hello', 1, 5)).toBe(true);
});

// Test 22
it('validateStringLength returns false when outside bounds', () => {
  expect(validateStringLength('', 1, 5)).toBe(false);
  expect(validateStringLength('toolong', 1, 5)).toBe(false);
});
