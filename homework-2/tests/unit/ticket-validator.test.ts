import {
  validateCreateTicket,
  validateUpdateTicket,
  validateEmail,
  validateStringLength,
  ValidationError,
} from '../../src/validators/ticket-validator';
import { Category, Priority, Status, Source, DeviceType, Ticket } from '../../src/models/ticket';

const validPayload = {
  customer_id: 'cust-001',
  customer_email: 'john@example.com',
  customer_name: 'John Doe',
  subject: 'Login not working',
  description: 'I cannot log into my account after password reset.',
  category: Category.AccountAccess,
  priority: Priority.High,
  status: Status.New,
};

const stubTicket: Ticket = {
  id: 'ticket-uuid-1',
  ...validPayload,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('validateCreateTicket', () => {
  it('accepts a valid ticket payload', () => {
    const result = validateCreateTicket(validPayload);
    expect(result.customer_id).toBe('cust-001');
    expect(result.category).toBe(Category.AccountAccess);
  });

  it('defaults status to undefined when omitted', () => {
    const { status: _s, ...withoutStatus } = validPayload;
    const result = validateCreateTicket(withoutStatus);
    expect(result.status).toBeUndefined();
  });

  it('rejects an invalid email', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, customer_email: 'not-an-email' })
    ).toThrow(ValidationError);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      validateCreateTicket({ customer_email: 'a@b.com' })
    ).toThrow(ValidationError);
  });

  it('rejects subject exceeding 200 characters', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, subject: 'x'.repeat(201) })
    ).toThrow(ValidationError);
  });

  it('rejects description shorter than 10 characters', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, description: 'short' })
    ).toThrow(ValidationError);
  });

  it('rejects description exceeding 2000 characters', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, description: 'x'.repeat(2001) })
    ).toThrow(ValidationError);
  });

  it('rejects an invalid category enum', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, category: 'invalid_category' })
    ).toThrow(ValidationError);
  });

  it('rejects an invalid priority enum', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, priority: 'critical' })
    ).toThrow(ValidationError);
  });

  it('rejects an invalid status enum', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, status: 'open' })
    ).toThrow(ValidationError);
  });

  it('includes detailed error messages', () => {
    try {
      validateCreateTicket({ ...validPayload, customer_email: 'bad', priority: 'nope' });
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.details.length).toBeGreaterThanOrEqual(2);
      const fields = ve.details.map(d => d.field);
      expect(fields).toContain('customer_email');
    }
  });

  it('accepts optional fields: assigned_to, tags, metadata', () => {
    const result = validateCreateTicket({
      ...validPayload,
      assigned_to: 'agent-007',
      tags: ['vip', 'urgent'],
      metadata: {
        source: Source.WebForm,
        browser: 'Chrome',
        device_type: DeviceType.Desktop,
      },
    });
    expect(result.assigned_to).toBe('agent-007');
    expect(result.tags).toEqual(['vip', 'urgent']);
    expect(result.metadata?.source).toBe(Source.WebForm);
  });

  it('rejects an invalid metadata source enum', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, metadata: { source: 'fax' } })
    ).toThrow(ValidationError);
  });

  it('rejects an invalid metadata device_type enum', () => {
    expect(() =>
      validateCreateTicket({ ...validPayload, metadata: { device_type: 'smartwatch' } })
    ).toThrow(ValidationError);
  });
});

describe('validateUpdateTicket', () => {
  it('accepts a partial update with one valid field', () => {
    const result = validateUpdateTicket({ subject: 'Updated subject line' }, stubTicket);
    expect(result.subject).toBe('Updated subject line');
  });

  it('accepts a status-only update', () => {
    const result = validateUpdateTicket({ status: Status.Resolved }, stubTicket);
    expect(result.status).toBe(Status.Resolved);
  });

  it('rejects an invalid email in update', () => {
    expect(() =>
      validateUpdateTicket({ customer_email: 'not-email' }, stubTicket)
    ).toThrow(ValidationError);
  });

  it('rejects an empty object (no fields provided)', () => {
    expect(() =>
      validateUpdateTicket({}, stubTicket)
    ).toThrow(ValidationError);
  });

  it('rejects an invalid category in update', () => {
    expect(() =>
      validateUpdateTicket({ category: 'unknown' }, stubTicket)
    ).toThrow(ValidationError);
  });

  it('accepts a multi-field update', () => {
    const result = validateUpdateTicket(
      { priority: Priority.Urgent, assigned_to: 'supervisor' },
      stubTicket
    );
    expect(result.priority).toBe(Priority.Urgent);
    expect(result.assigned_to).toBe('supervisor');
  });
});

describe('validateEmail', () => {
  it('returns true for a valid email', () => {
    expect(validateEmail('user@domain.com')).toBe(true);
  });

  it('returns true for an email with subdomains', () => {
    expect(validateEmail('user@mail.domain.co.uk')).toBe(true);
  });

  it('returns false for missing @', () => {
    expect(validateEmail('userdomain.com')).toBe(false);
  });

  it('returns false for missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(validateEmail('not-an-email')).toBe(false);
  });
});

describe('validateStringLength', () => {
  it('returns true when string length is within range', () => {
    expect(validateStringLength('hello', 1, 10)).toBe(true);
  });

  it('returns true at the minimum boundary', () => {
    expect(validateStringLength('a', 1, 5)).toBe(true);
  });

  it('returns true at the maximum boundary', () => {
    expect(validateStringLength('hello', 1, 5)).toBe(true);
  });

  it('returns false when string is too short', () => {
    expect(validateStringLength('', 1, 5)).toBe(false);
  });

  it('returns false when string is too long', () => {
    expect(validateStringLength('toolong', 1, 5)).toBe(false);
  });

  it('returns true for exact min == max', () => {
    expect(validateStringLength('abc', 3, 3)).toBe(true);
  });

  it('returns false for string longer than exact boundary', () => {
    expect(validateStringLength('abcd', 3, 3)).toBe(false);
  });
});
