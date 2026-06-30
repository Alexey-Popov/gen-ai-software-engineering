'use strict';

const store = require('../store/transactionStore');
const { createTransaction } = require('../models/transaction');

/**
 * Create and persist a transaction from a validated payload.
 * @param {object} input - already-validated request body
 * @returns {object} the stored transaction
 */
function create(input) {
  return store.insert(createTransaction(input));
}

/**
 * @param {string} id
 * @returns {object | undefined}
 */
function getById(id) {
  return store.findById(id);
}

/**
 * Parse a filter bound into a comparable timestamp (ms).
 *
 * A date-only `to` bound is pushed to the end of that day so the range is
 * inclusive of the whole day (resolved contract). Returns null for invalid
 * input so callers can ignore unparseable filters.
 *
 * @param {string} value
 * @param {'start'|'end'} edge
 * @returns {number | null}
 */
function parseBound(value, edge) {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const iso = dateOnly && edge === 'end' ? `${value}T23:59:59.999Z` : value;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * List transactions with optional, combinable filters.
 *
 * @param {object} [filters]
 * @param {string} [filters.accountId] - matches fromAccount OR toAccount
 * @param {string} [filters.type] - exact transaction type
 * @param {string} [filters.from] - inclusive lower bound (date or ISO 8601)
 * @param {string} [filters.to] - inclusive upper bound (date or ISO 8601)
 * @returns {object[]}
 */
function list(filters = {}) {
  const { accountId, type, from, to } = filters;
  const fromMs = parseBound(from, 'start');
  const toMs = parseBound(to, 'end');

  return store.all().filter((t) => {
    if (accountId && t.fromAccount !== accountId && t.toAccount !== accountId) {
      return false;
    }
    if (type && t.type !== type) {
      return false;
    }
    if (fromMs !== null || toMs !== null) {
      const ts = Date.parse(t.timestamp);
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
    }
    return true;
  });
}

module.exports = { create, getById, list };
