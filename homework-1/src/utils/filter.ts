import { Transaction, TransactionType } from '../models/transaction';

const VALID_TYPES: TransactionType[] = ['deposit', 'withdrawal', 'transfer'];
const ACCOUNT_FORMAT = /^ACC-[A-Za-z0-9]{5}$/;
// Accepts YYYY-MM-DD or full ISO 8601
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType;
  from?: Date;
  to?: Date;
}

export interface FilterParseError {
  param: string;
  message: string;
}

export const parseFilters = (
  query: Record<string, unknown>
): { errors: FilterParseError[]; filters: TransactionFilters } => {
  const errors: FilterParseError[] = [];
  const filters: TransactionFilters = {};

  if (query.accountId !== undefined) {
    if (typeof query.accountId !== 'string' || !ACCOUNT_FORMAT.test(query.accountId)) {
      errors.push({ param: 'accountId', message: 'accountId must follow format ACC-XXXXX (e.g. ACC-A1B2C)' });
    } else {
      filters.accountId = query.accountId;
    }
  }

  if (query.type !== undefined) {
    if (!VALID_TYPES.includes(query.type as TransactionType)) {
      errors.push({ param: 'type', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
    } else {
      filters.type = query.type as TransactionType;
    }
  }

  if (query.from !== undefined) {
    if (typeof query.from !== 'string' || !DATE_FORMAT.test(query.from)) {
      errors.push({ param: 'from', message: 'from must be a valid date (YYYY-MM-DD or ISO 8601)' });
    } else {
      const d = new Date(query.from.length === 10 ? `${query.from}T00:00:00.000Z` : query.from);
      if (isNaN(d.getTime())) {
        errors.push({ param: 'from', message: 'from is not a valid date' });
      } else {
        filters.from = d;
      }
    }
  }

  if (query.to !== undefined) {
    if (typeof query.to !== 'string' || !DATE_FORMAT.test(query.to)) {
      errors.push({ param: 'to', message: 'to must be a valid date (YYYY-MM-DD or ISO 8601)' });
    } else {
      // YYYY-MM-DD: treat as end of that day
      const d = new Date(query.to.length === 10 ? `${query.to}T23:59:59.999Z` : query.to);
      if (isNaN(d.getTime())) {
        errors.push({ param: 'to', message: 'to is not a valid date' });
      } else {
        filters.to = d;
      }
    }
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    errors.push({ param: 'from', message: "'from' date must not be after 'to' date" });
  }

  return { errors, filters };
};

export const applyFilters = (
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] =>
  transactions.filter(t => {
    if (filters.accountId && t.fromAccount !== filters.accountId && t.toAccount !== filters.accountId) {
      return false;
    }
    if (filters.type && t.type !== filters.type) {
      return false;
    }
    const ts = new Date(t.timestamp);
    if (filters.from && ts < filters.from) return false;
    if (filters.to && ts > filters.to) return false;
    return true;
  });
