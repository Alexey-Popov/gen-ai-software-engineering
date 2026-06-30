'use strict';

const { randomUUID } = require('crypto');

const TRANSACTION_TYPES = Object.freeze(['deposit', 'withdrawal', 'transfer']);
const TRANSACTION_STATUSES = Object.freeze(['pending', 'completed', 'failed']);

/**
 * Build a normalized transaction record from already-validated input.
 *
 * Server-controlled fields are always (re)generated here: `id`, `timestamp`,
 * and a default `status` of "completed" (synchronous in-memory settlement —
 * see the resolved contract in CLAUDE.md). Per the contract, `fromAccount` /
 * `toAccount` are normalized to `null` when absent for the given type.
 *
 * @param {object} input - validated request body
 * @returns {object} transaction record
 */
function createTransaction(input) {
  return {
    id: randomUUID(),
    fromAccount: input.fromAccount ?? null,
    toAccount: input.toAccount ?? null,
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    timestamp: input.timestamp || new Date().toISOString(),
    status: input.status || 'completed',
  };
}

module.exports = { createTransaction, TRANSACTION_TYPES, TRANSACTION_STATUSES };
