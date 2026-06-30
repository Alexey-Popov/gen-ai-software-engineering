'use strict';

/**
 * In-memory transaction store.
 *
 * No database — transactions live in a module-level array for the lifetime of
 * the process. Exposed as a small CRUD surface so services never touch the
 * array directly (and tests can reset state between cases).
 */
const transactions = [];

/** @returns {object[]} all transactions (insertion order) */
function all() {
  return transactions;
}

/**
 * @param {object} transaction
 * @returns {object} the stored transaction
 */
function insert(transaction) {
  transactions.push(transaction);
  return transaction;
}

/**
 * @param {string} id
 * @returns {object | undefined}
 */
function findById(id) {
  return transactions.find((t) => t.id === id);
}

/** Clear all transactions (test helper). */
function clear() {
  transactions.length = 0;
}

module.exports = { all, insert, findById, clear };
