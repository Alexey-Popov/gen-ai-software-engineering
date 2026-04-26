import { ValidationError } from '../utils/errors.js';
import { isSupportedCurrency, SUPPORTED_CURRENCIES } from '../utils/currencies.js';

const ACCOUNT_REGEX = /^ACC-[A-Z0-9]{5,}$/;
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
const VALID_TYPES = new Set(['deposit', 'withdrawal', 'transfer']);

function validateAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    return { field: 'amount', message: 'Amount is required' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { field: 'amount', message: 'Amount must be a number' };
  }
  if (amount <= 0) {
    return { field: 'amount', message: 'Amount must be a positive number' };
  }
  if (!AMOUNT_REGEX.test(String(amount))) {
    return { field: 'amount', message: 'Amount must have at most 2 decimal places' };
  }
  return null;
}

function validateAccount(field, value, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) return { field, message: `${field} is required` };
    return null;
  }
  if (typeof value !== 'string' || !ACCOUNT_REGEX.test(value)) {
    return { field, message: `${field} must match the format ACC-XXXXX (alphanumeric, uppercase)` };
  }
  return null;
}

function validateCurrency(currency) {
  if (!currency) {
    return { field: 'currency', message: 'Currency is required' };
  }
  if (!isSupportedCurrency(currency)) {
    return {
      field: 'currency',
      message: `Invalid currency code. Supported: ${[...SUPPORTED_CURRENCIES].join(', ')}`,
    };
  }
  return null;
}

function validateType(type) {
  if (!type) {
    return { field: 'type', message: 'Type is required' };
  }
  if (!VALID_TYPES.has(type)) {
    return { field: 'type', message: 'Type must be one of: deposit, withdrawal, transfer' };
  }
  return null;
}

export function validateTransactionPayload(payload = {}) {
  const { fromAccount, toAccount, amount, currency, type } = payload;
  const details = [];

  const typeError = validateType(type);
  if (typeError) details.push(typeError);

  // Account requirements depend on type:
  //   deposit    → toAccount required, fromAccount optional (external source)
  //   withdrawal → fromAccount required, toAccount optional (external target)
  //   transfer   → both required
  //   unknown type → require neither (the type error already covers it)
  const fromRequired = type === 'withdrawal' || type === 'transfer';
  const toRequired = type === 'deposit' || type === 'transfer';

  const fromError = validateAccount('fromAccount', fromAccount, { required: fromRequired });
  if (fromError) details.push(fromError);

  const toError = validateAccount('toAccount', toAccount, { required: toRequired });
  if (toError) details.push(toError);

  if (
    type === 'transfer' &&
    fromAccount &&
    toAccount &&
    fromAccount === toAccount
  ) {
    details.push({
      field: 'toAccount',
      message: 'fromAccount and toAccount must be different for a transfer',
    });
  }

  const amountError = validateAmount(amount);
  if (amountError) details.push(amountError);

  const currencyError = validateCurrency(currency);
  if (currencyError) details.push(currencyError);

  if (details.length > 0) {
    throw new ValidationError(details);
  }

  return {
    fromAccount: fromAccount ?? null,
    toAccount: toAccount ?? null,
    amount,
    currency: currency.toUpperCase(),
    type,
  };
}
