import { ValidationError } from '../utils/errors.js';

const CATEGORIES = ['account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parse a date-only or full ISO 8601 string into a Date.
 * Date-only strings normalize to bound: `from` → start of day UTC, `to` → end of day UTC.
 *
 * @param {string} value
 * @param {'from' | 'to'} bound
 * @returns {{ ok: true, date: Date } | { ok: false }}
 */
function parseDate(value, bound) {
  if (DATE_ONLY_REGEX.test(value)) {
    const suffix = bound === 'to' ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, date };
  }
  if (ISO_8601_REGEX.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, date };
  }
  return { ok: false };
}

/**
 * Validate `GET /tickets` query params and return a sanitized criteria object.
 * Collects all errors (no fail-fast) and throws a single ValidationError.
 *
 * Supported params (all optional, AND-combined):
 *   category, priority, status   — enum
 *   customer_id, assigned_to     — non-empty string
 *   from, to                     — date-only (YYYY-MM-DD) or full ISO 8601
 *
 * @param {object} query  req.query
 * @returns {{
 *   category?: string, priority?: string, status?: string,
 *   customer_id?: string, assigned_to?: string,
 *   from?: Date, to?: Date,
 * }}
 */
export function validateQueryFilters(query) {
  const errors = [];
  const criteria = {};

  if (query.category !== undefined) {
    if (!CATEGORIES.includes(query.category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
    } else {
      criteria.category = query.category;
    }
  }

  if (query.priority !== undefined) {
    if (!PRIORITIES.includes(query.priority)) {
      errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    } else {
      criteria.priority = query.priority;
    }
  }

  if (query.status !== undefined) {
    if (!STATUSES.includes(query.status)) {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    } else {
      criteria.status = query.status;
    }
  }

  if (query.customer_id !== undefined) {
    const v = String(query.customer_id).trim();
    if (v.length === 0) errors.push('customer_id cannot be empty');
    else criteria.customer_id = v;
  }

  if (query.assigned_to !== undefined) {
    const v = String(query.assigned_to).trim();
    if (v.length === 0) errors.push('assigned_to cannot be empty');
    else criteria.assigned_to = v;
  }

  if (query.from !== undefined) {
    const result = parseDate(String(query.from), 'from');
    if (!result.ok) errors.push('from must be a valid date (YYYY-MM-DD or ISO 8601)');
    else criteria.from = result.date;
  }

  if (query.to !== undefined) {
    const result = parseDate(String(query.to), 'to');
    if (!result.ok) errors.push('to must be a valid date (YYYY-MM-DD or ISO 8601)');
    else criteria.to = result.date;
  }

  if (criteria.from && criteria.to && criteria.from > criteria.to) {
    errors.push('from must be earlier than or equal to to');
  }

  if (errors.length > 0) throw new ValidationError(errors);

  return criteria;
}
