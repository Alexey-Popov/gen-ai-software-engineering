import { randomUUID } from 'node:crypto';

const transactions = new Map();

export function createTransaction({ fromAccount, toAccount, amount, currency, type }) {
  const id = randomUUID();
  const transaction = {
    id,
    fromAccount: fromAccount ?? null,
    toAccount: toAccount ?? null,
    amount,
    currency,
    type,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };
  transactions.set(id, transaction);
  return transaction;
}

export function getAllTransactions(filters = {}) {
  const { accountId, type, from, to } = filters;
  let result = Array.from(transactions.values());

  if (accountId) {
    result = result.filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId,
    );
  }

  if (type) {
    result = result.filter((t) => t.type === type);
  }

  if (from instanceof Date) {
    const fromMs = from.getTime();
    result = result.filter((t) => new Date(t.timestamp).getTime() >= fromMs);
  }

  if (to instanceof Date) {
    const toMs = to.getTime();
    result = result.filter((t) => new Date(t.timestamp).getTime() <= toMs);
  }

  return result;
}

export function getTransactionById(id) {
  return transactions.get(id) ?? null;
}

export function getBalance(accountId) {
  let balance = 0;
  for (const t of transactions.values()) {
    if (t.status !== 'completed') continue;
    if (t.toAccount === accountId) balance += t.amount;
    if (t.fromAccount === accountId) balance -= t.amount;
  }
  return Number(balance.toFixed(2));
}

export function getAccountSummary(accountId) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let transactionCount = 0;
  let lastTransactionDate = null;

  for (const t of transactions.values()) {
    const involvesAccount = t.fromAccount === accountId || t.toAccount === accountId;
    if (!involvesAccount) continue;

    transactionCount += 1;

    if (t.status === 'completed') {
      if (t.toAccount === accountId) totalDeposits += t.amount;
      if (t.fromAccount === accountId) totalWithdrawals += t.amount;
    }

    if (lastTransactionDate === null || t.timestamp > lastTransactionDate) {
      lastTransactionDate = t.timestamp;
    }
  }

  return {
    accountId,
    totalDeposits: Number(totalDeposits.toFixed(2)),
    totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
    transactionCount,
    lastTransactionDate,
  };
}
