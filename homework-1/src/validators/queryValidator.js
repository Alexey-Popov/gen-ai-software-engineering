import { ValidationError } from '../utils/errors.js';

const VALID_TYPES = new Set(['deposit', 'withdrawal', 'transfer']);
const ACCOUNT_REGEX = /^ACC-[A-Z0-9]{5,}$/;

function parseDate(value, field, endOfDay = false) {
  // Accept either a date-only string (YYYY-MM-DD) or a full ISO 8601 timestamp.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const normalized = dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw { field, message: `${field} must be a valid date (YYYY-MM-DD or ISO 8601)` };
  }
  return date;
}

export function validateTransactionFilters(query = {}) {
  const { accountId, type, from, to } = query;
  const details = [];
  const filters = {};

  if (accountId !== undefined) {
    if (typeof accountId !== 'string' || !ACCOUNT_REGEX.test(accountId)) {
      details.push({
        field: 'accountId',
        message: 'accountId must match the format ACC-XXXXX (alphanumeric, uppercase)',
      });
    } else {
      filters.accountId = accountId;
    }
  }

  if (type !== undefined) {
    if (!VALID_TYPES.has(type)) {
      details.push({
        field: 'type',
        message: 'type must be one of: deposit, withdrawal, transfer',
      });
    } else {
      filters.type = type;
    }
  }

  if (from !== undefined) {
    try {
      filters.from = parseDate(from, 'from', false);
    } catch (e) {
      details.push(e);
    }
  }

  if (to !== undefined) {
    try {
      filters.to = parseDate(to, 'to', true);
    } catch (e) {
      details.push(e);
    }
  }

  if (filters.from && filters.to && filters.from.getTime() > filters.to.getTime()) {
    details.push({ field: 'to', message: '"to" must be greater than or equal to "from"' });
  }

  if (details.length > 0) {
    throw new ValidationError(details);
  }

  return filters;
}
