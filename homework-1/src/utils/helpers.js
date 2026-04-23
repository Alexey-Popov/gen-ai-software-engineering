const CSV_HEADERS = ['id', 'fromAccount', 'toAccount', 'amount', 'currency', 'type', 'timestamp', 'status'];
const DAYS_PER_YEAR = 365;
const TRANSACTION_STATUS_COMPLETED = 'completed';

/**
 * Rounds monetary amounts to 2 decimal places to prevent JavaScript
 * floating-point precision errors (e.g., 100.50 + 0.30 = 100.79999999).
 * @param {number} amount - The amount to round
 * @returns {number} Amount rounded to 2 decimal places
 */
const roundMoney = (amount) => Math.round(amount * 100) / 100;

/**
 * Calculates the current balance for a given account by processing all completed transactions.
 * Balance = deposits + incoming transfers - withdrawals - outgoing transfers
 * Only transactions with status 'completed' are included in the calculation.
 *
 * @param {string} accountId - The account ID to calculate balance for
 * @param {Array} transactions - Array of transaction objects
 * @returns {number} The calculated balance rounded to 2 decimal places
 * @throws {Error} If accountId is missing or transactions is not an array
 */
const calculateBalance = (accountId, transactions) => {
  if (!Array.isArray(transactions)) {
    throw new Error('transactions must be an array');
  }
  if (!accountId) {
    throw new Error('accountId is required');
  }

  // Balance calculation logic:
  // - Deposits: only toAccount is set → add amount
  // - Withdrawals: only fromAccount is set → subtract amount
  // - Transfers: both accounts set → add if toAccount matches, subtract if fromAccount matches
  // Result: deposits + incoming transfers - withdrawals - outgoing transfers
  const balance = transactions.reduce((sum, t) => {
    if (t.status !== TRANSACTION_STATUS_COMPLETED) return sum;
    if (!Number.isFinite(t.amount)) {
      console.warn(`Skipping transaction ${t.id} with invalid amount: ${t.amount}`);
      return sum;
    }
    if (t.toAccount === accountId) return sum + t.amount;
    if (t.fromAccount === accountId) return sum - t.amount;
    return sum;
  }, 0);
  return roundMoney(balance);
};

/**
 * Generates a summary of all transactions for a given account.
 * Note: totalDeposits includes BOTH deposit transactions AND incoming transfers.
 * Similarly, totalWithdrawals includes withdrawals AND outgoing transfers.
 * This ensures consistency with balance calculation.
 * Unlike calculateBalance, this includes ALL transaction statuses (pending, completed, failed).
 *
 * @param {string} accountId - The account ID to generate summary for
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Summary object with totals, count, and most recent transaction
 * @throws {Error} If accountId is missing or transactions is not an array
 */
const calculateSummary = (accountId, transactions) => {
  if (!Array.isArray(transactions)) {
    throw new Error('transactions must be an array');
  }
  if (!accountId) {
    throw new Error('accountId is required');
  }

  const accountTransactions = transactions.filter(t =>
    t.fromAccount === accountId || t.toAccount === accountId
  );

  const summary = accountTransactions.reduce((acc, t) => {
    if (!acc.mostRecentTransaction || new Date(t.timestamp) > new Date(acc.mostRecentTransaction)) {
      acc.mostRecentTransaction = t.timestamp;
    }
    if (Number.isFinite(t.amount)) {
      if (t.toAccount === accountId) acc.totalDeposits += t.amount;
      if (t.fromAccount === accountId) acc.totalWithdrawals += t.amount;
    }
    return acc;
  }, { totalDeposits: 0, totalWithdrawals: 0, mostRecentTransaction: null });

  return {
    accountId,
    totalDeposits: roundMoney(summary.totalDeposits),
    totalWithdrawals: roundMoney(summary.totalWithdrawals),
    transactionCount: accountTransactions.length,
    mostRecentTransaction: summary.mostRecentTransaction
  };
};

const calculateInterest = (principal, rate, days) => {
  if (!Number.isFinite(principal) || principal < 0) {
    throw new Error('principal must be a non-negative number');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('rate must be a non-negative number');
  }
  if (!Number.isFinite(days) || days < 0) {
    throw new Error('days must be a non-negative number');
  }
  return roundMoney(principal * rate * (days / DAYS_PER_YEAR));
};

// Escape CSV values by wrapping in quotes and escaping internal quotes
const escapeCSV = (value) => {
  const str = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const transactionsToCSV = (transactions) => {
  if (!Array.isArray(transactions)) {
    throw new Error('transactions must be an array');
  }
  return [CSV_HEADERS.join(','), ...transactions.map(t =>
    [
      escapeCSV(t.id),
      escapeCSV(t.fromAccount),
      escapeCSV(t.toAccount),
      escapeCSV(t.amount),
      escapeCSV(t.currency),
      escapeCSV(t.type),
      escapeCSV(t.timestamp),
      escapeCSV(t.status)
    ].join(',')
  )].join('\n');
};

module.exports = {
  calculateBalance,
  calculateSummary,
  calculateInterest,
  transactionsToCSV
};
