'use strict';

/** Column order for transaction CSV export. */
const TRANSACTION_COLUMNS = [
  'id', 'fromAccount', 'toAccount', 'amount',
  'currency', 'type', 'timestamp', 'status',
];

/**
 * Escape a single CSV field per RFC 4180: wrap in quotes when it contains a
 * comma, quote, or newline, and double any embedded quotes.
 * @param {unknown} value
 * @returns {string}
 */
function escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize transactions to a CSV string (header row + one row per record).
 * @param {object[]} transactions
 * @returns {string}
 */
function transactionsToCsv(transactions) {
  const header = TRANSACTION_COLUMNS.join(',');
  const rows = transactions.map((t) =>
    TRANSACTION_COLUMNS.map((col) => escapeField(t[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

module.exports = { transactionsToCsv, TRANSACTION_COLUMNS };
