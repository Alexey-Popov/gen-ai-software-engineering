import { err, hasMaxTwoDecimals } from '../utils/helpers.js';
import { VALID_TYPES, VALID_CURRENCIES, ACCOUNT_FORMAT } from '../models/transaction.js';

function validateAccount(value, fieldName) {
  if (!value) return err(fieldName, `${fieldName} is required`);
  if (!ACCOUNT_FORMAT.test(value)) {
    return err(fieldName, `${fieldName} must follow format ACC-XXXXX (5 uppercase alphanumeric characters)`);
  }
  return null;
}

export function validateTransaction(body) {
  const { fromAccount, toAccount, amount, currency, type } = body;
  const errors = [];

  if (!type || !VALID_TYPES.has(type)) {
    errors.push(err('type', `type must be one of: ${[...VALID_TYPES].join(', ')}`));
  }

  if (type === 'deposit') {
    const e = validateAccount(toAccount, 'toAccount');
    if (e) errors.push(e);
  } else if (type === 'withdrawal') {
    const e = validateAccount(fromAccount, 'fromAccount');
    if (e) errors.push(e);
  } else if (type === 'transfer') {
    const eFrom = validateAccount(fromAccount, 'fromAccount');
    const eTo = validateAccount(toAccount, 'toAccount');
    if (eFrom) errors.push(eFrom);
    if (eTo) errors.push(eTo);
    if (!eFrom && !eTo && fromAccount === toAccount) {
      errors.push(err('fromAccount', 'fromAccount and toAccount must be different for transfer'));
    }
  }

  if (amount === undefined || amount === null) {
    errors.push(err('amount', 'Amount is required'));
  } else if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    errors.push(err('amount', 'Amount must be a positive number'));
  } else if (!hasMaxTwoDecimals(amount)) {
    errors.push(err('amount', 'Amount must have at most 2 decimal places'));
  }

  if (!currency) {
    errors.push(err('currency', 'Currency is required'));
  } else if (!VALID_CURRENCIES.has(currency)) {
    errors.push(err('currency', 'Invalid currency code. Must be a valid ISO 4217 code (e.g. USD, EUR, GBP)'));
  }

  return errors;
}

export function parseFilterErrors(query) {
  const errors = [];
  const { accountId, type, from, to } = query;

  if (accountId !== undefined && !ACCOUNT_FORMAT.test(accountId)) {
    errors.push(err('accountId', 'accountId must follow format ACC-XXXXX (5 uppercase alphanumeric characters)'));
  }

  if (type !== undefined && !VALID_TYPES.has(type)) {
    errors.push(err('type', `type must be one of: ${[...VALID_TYPES].join(', ')}`));
  }

  if (from !== undefined && isNaN(Date.parse(from))) {
    errors.push(err('from', 'from must be a valid ISO 8601 date (e.g. 2024-01-01)'));
  }

  if (to !== undefined && isNaN(Date.parse(to))) {
    errors.push(err('to', 'to must be a valid ISO 8601 date (e.g. 2024-01-31)'));
  }

  if (from && to && !isNaN(Date.parse(from)) && !isNaN(Date.parse(to)) && new Date(from) > new Date(to)) {
    errors.push(err('from', 'from date must not be later than to date'));
  }

  return errors;
}
