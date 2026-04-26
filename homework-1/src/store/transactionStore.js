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

export function getAllTransactions() {
  return Array.from(transactions.values());
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
