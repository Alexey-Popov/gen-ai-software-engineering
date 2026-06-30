'use strict';

const { isValidCurrency } = require('../config/currencies');
const { TRANSACTION_TYPES, TRANSACTION_STATUSES } = require('../models/transaction');

/** Account number format: literal `ACC-` + exactly 5 alphanumeric chars. */
const ACCOUNT_REGEX = /^ACC-[A-Za-z0-9]{5}$/;

/**
 * Which account fields each transaction type requires / forbids.
 * (Resolved contract: deposit credits a target, withdrawal debits a source,
 * transfer moves between two distinct accounts.)
 */
const ACCOUNT_RULES = {
  deposit: { from: 'forbidden', to: 'required' },
  withdrawal: { from: 'required', to: 'forbidden' },
  transfer: { from: 'required', to: 'required' },
};

/**
 * Validate that `amount` is a positive number with at most 2 decimal places.
 * @param {unknown} amount
 * @returns {string | null} error message, or null if valid
 */
function validateAmount(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return 'Amount must be a number';
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be a positive number';
  }
  const decimals = (amount.toString().split('.')[1] || '').length;
  if (decimals > 2) {
    return 'Amount must have at most 2 decimal places';
  }
  return null;
}

/**
 * Validate a transaction creation payload against the resolved domain contract.
 *
 * @param {object} body - raw request body
 * @returns {{ valid: boolean, details: Array<{field: string, message: string}> }}
 */
function validateTransaction(body = {}) {
  const details = [];
  const add = (field, message) => details.push({ field, message });

  // --- type (drives the account rules below) ---
  const { type } = body;
  const typeIsValid = TRANSACTION_TYPES.includes(type);
  if (!typeIsValid) {
    add('type', `Type must be one of: ${TRANSACTION_TYPES.join(', ')}`);
  }

  // --- amount ---
  const amountError = validateAmount(body.amount);
  if (amountError) add('amount', amountError);

  // --- currency ---
  if (!isValidCurrency(body.currency)) {
    add('currency', 'Invalid currency code (must be a supported ISO 4217 code)');
  }

  // --- accounts (presence rules depend on a valid type) ---
  if (typeIsValid) {
    const rules = ACCOUNT_RULES[type];
    validateAccountField('fromAccount', body.fromAccount, rules.from, add);
    validateAccountField('toAccount', body.toAccount, rules.to, add);

    // transfer must move between two *distinct* accounts
    if (
      type === 'transfer' &&
      body.fromAccount &&
      body.toAccount &&
      body.fromAccount === body.toAccount
    ) {
      add('toAccount', 'fromAccount and toAccount must be different for a transfer');
    }
  }

  // --- optional status override ---
  if (body.status !== undefined && !TRANSACTION_STATUSES.includes(body.status)) {
    add('status', `Status must be one of: ${TRANSACTION_STATUSES.join(', ')}`);
  }

  return { valid: details.length === 0, details };
}

/**
 * Validate a single account field given its rule (required | forbidden).
 * @param {string} field
 * @param {unknown} value
 * @param {'required'|'forbidden'} rule
 * @param {(field: string, message: string) => void} add
 */
function validateAccountField(field, value, rule, add) {
  const present = value !== undefined && value !== null && value !== '';

  if (rule === 'forbidden') {
    if (present) add(field, `${field} is not allowed for this transaction type`);
    return;
  }
  // rule === 'required'
  if (!present) {
    add(field, `${field} is required for this transaction type`);
    return;
  }
  if (!ACCOUNT_REGEX.test(value)) {
    add(field, `${field} must match format ACC-XXXXX (5 alphanumeric characters)`);
  }
}

module.exports = { validateTransaction, validateAmount, ACCOUNT_REGEX };
