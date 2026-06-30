'use strict';

const store = require('../store/transactionStore');

/**
 * Round to cents to avoid floating-point drift in accumulated sums.
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Transactions that move real money for an account: only `completed` ones
 * where the account is the source or destination (resolved contract).
 * @param {string} accountId
 * @returns {object[]}
 */
function settledFor(accountId) {
  return store
    .all()
    .filter(
      (t) =>
        t.status === 'completed' &&
        (t.fromAccount === accountId || t.toAccount === accountId)
    );
}

/**
 * Current balance = Σ credits (toAccount) − Σ debits (fromAccount),
 * over completed transactions only.
 * @param {string} accountId
 * @returns {number}
 */
function getBalance(accountId) {
  let balance = 0;
  for (const t of settledFor(accountId)) {
    if (t.toAccount === accountId) balance += t.amount;
    if (t.fromAccount === accountId) balance -= t.amount;
  }
  return round2(balance);
}

/**
 * Account summary. `totalDeposits`/`totalWithdrawals` are credits/debits
 * (not transaction-type names), so balance == totalDeposits − totalWithdrawals.
 *
 * @param {string} accountId
 * @returns {{
 *   accountId: string, totalDeposits: number, totalWithdrawals: number,
 *   balance: number, numberOfTransactions: number,
 *   mostRecentTransactionDate: string | null
 * }}
 */
function getSummary(accountId) {
  const settled = settledFor(accountId);
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const t of settled) {
    if (t.toAccount === accountId) totalDeposits += t.amount;
    if (t.fromAccount === accountId) totalWithdrawals += t.amount;
  }

  // numberOfTransactions / recency consider ALL transactions touching the
  // account (any status), so the count reflects activity, not just settlement.
  const touching = store
    .all()
    .filter((t) => t.fromAccount === accountId || t.toAccount === accountId);
  const mostRecent = touching.reduce(
    (max, t) => (max === null || t.timestamp > max ? t.timestamp : max),
    null
  );

  return {
    accountId,
    totalDeposits: round2(totalDeposits),
    totalWithdrawals: round2(totalWithdrawals),
    balance: round2(totalDeposits - totalWithdrawals),
    numberOfTransactions: touching.length,
    mostRecentTransactionDate: mostRecent,
  };
}

/**
 * Simple interest on the current balance: balance × rate × (days / 365).
 * @param {string} accountId
 * @param {number} rate - annual rate as a decimal (e.g. 0.05)
 * @param {number} days
 * @returns {{ accountId: string, balance: number, rate: number, days: number, interest: number }}
 */
function getInterest(accountId, rate, days) {
  const balance = getBalance(accountId);
  const interest = round2(balance * rate * (days / 365));
  return { accountId, balance, rate, days, interest };
}

module.exports = { getBalance, getSummary, getInterest };
