import { describe, it, expect } from 'vitest';
import { validateQueryFilters } from '../../src/validators/queryValidator.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('validateQueryFilters', () => {
  it('returns empty criteria for empty query', () => {
    expect(validateQueryFilters({})).toEqual({});
  });

  it('passes through valid enum filters', () => {
    const out = validateQueryFilters({
      category: 'technical_issue',
      priority: 'high',
      status: 'new',
    });
    expect(out).toEqual({
      category: 'technical_issue',
      priority: 'high',
      status: 'new',
    });
  });

  it('throws on invalid enum value (collects all errors)', () => {
    try {
      validateQueryFilters({ category: 'bad', priority: 'critical', status: 'pending' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toHaveLength(3);
      expect(err.details.some((e) => e.includes('category'))).toBe(true);
      expect(err.details.some((e) => e.includes('priority'))).toBe(true);
      expect(err.details.some((e) => e.includes('status'))).toBe(true);
    }
  });

  it('parses date-only strings into bound dates (UTC)', () => {
    const out = validateQueryFilters({ from: '2026-01-01', to: '2026-12-31' });
    expect(out.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(out.to.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('accepts full ISO 8601 dates', () => {
    const out = validateQueryFilters({ from: '2026-05-04T10:30:00Z' });
    expect(out.from.toISOString()).toBe('2026-05-04T10:30:00.000Z');
  });

  it('rejects malformed date strings', () => {
    try {
      validateQueryFilters({ from: 'not-a-date' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details[0]).toMatch(/from must be a valid date/);
    }
  });

  it('rejects from > to', () => {
    try {
      validateQueryFilters({ from: '2026-12-31', to: '2026-01-01' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.details).toContain('from must be earlier than or equal to to');
    }
  });

  it('rejects empty customer_id / assigned_to', () => {
    try {
      validateQueryFilters({ customer_id: '   ', assigned_to: '' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.details).toContain('customer_id cannot be empty');
      expect(err.details).toContain('assigned_to cannot be empty');
    }
  });

  it('ignores unknown query params', () => {
    expect(validateQueryFilters({ foo: 'bar', random: 'x' })).toEqual({});
  });
});
