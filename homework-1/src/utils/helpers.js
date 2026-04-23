const CSV_HEADERS = ['id', 'fromAccount', 'toAccount', 'amount', 'currency', 'type', 'timestamp', 'status'];
const DAYS_PER_YEAR = 365;
const TRANSACTION_STATUS_COMPLETED = 'completed';
const TRANSACTION_TYPE_DEPOSIT = 'deposit';
const TRANSACTION_TYPE_WITHDRAWAL = 'withdrawal';
const TRANSACTION_TYPE_TRANSFER = 'transfer';

function calculateBalance(accountId, transactions) {
  let balance = 0;

  transactions.forEach(transaction => {
    if (transaction.status !== TRANSACTION_STATUS_COMPLETED) return;

    if (transaction.type === TRANSACTION_TYPE_DEPOSIT && transaction.toAccount === accountId) {
      balance += transaction.amount;
    }

    if (transaction.type === TRANSACTION_TYPE_WITHDRAWAL && transaction.fromAccount === accountId) {
      balance -= transaction.amount;
    }

    if (transaction.type === TRANSACTION_TYPE_TRANSFER && transaction.toAccount === accountId) {
      balance += transaction.amount;
    }

    if (transaction.type === TRANSACTION_TYPE_TRANSFER && transaction.fromAccount === accountId) {
      balance -= transaction.amount;
    }
  });

  return Math.round(balance * 100) / 100;
}

function calculateSummary(accountId, transactions) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let mostRecentTransaction = null;

  const accountTransactions = transactions.filter(t =>
    t.fromAccount === accountId || t.toAccount === accountId
  );

  accountTransactions.forEach(transaction => {
    if (!mostRecentTransaction || new Date(transaction.timestamp) > new Date(mostRecentTransaction)) {
      mostRecentTransaction = transaction.timestamp;
    }

    if (transaction.type === TRANSACTION_TYPE_DEPOSIT && transaction.toAccount === accountId) {
      totalDeposits += transaction.amount;
    }
    if (transaction.type === TRANSACTION_TYPE_TRANSFER && transaction.toAccount === accountId) {
      totalDeposits += transaction.amount;
    }

    if (transaction.type === TRANSACTION_TYPE_WITHDRAWAL && transaction.fromAccount === accountId) {
      totalWithdrawals += transaction.amount;
    }
    if (transaction.type === TRANSACTION_TYPE_TRANSFER && transaction.fromAccount === accountId) {
      totalWithdrawals += transaction.amount;
    }
  });

  return {
    accountId,
    totalDeposits: Math.round(totalDeposits * 100) / 100,
    totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
    transactionCount: accountTransactions.length,
    mostRecentTransaction
  };
}

function calculateInterest(principal, rate, days) {
  return Math.round(principal * rate * (days / DAYS_PER_YEAR) * 100) / 100;
}

function transactionsToCSV(transactions) {
  const csvRows = [CSV_HEADERS.join(',')];

  transactions.forEach(t => {
    const row = [
      t.id,
      t.fromAccount,
      t.toAccount,
      t.amount,
      t.currency,
      t.type,
      t.timestamp,
      t.status
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

module.exports = {
  calculateBalance,
  calculateSummary,
  calculateInterest,
  transactionsToCSV
};
