import { Router, Request, Response } from 'express';
import * as store from '../models/store';

const ACCOUNT_FORMAT = /^ACC-[A-Za-z0-9]{5}$/;

const router = Router();

router.get('/:accountId/summary', (req: Request, res: Response) => {
  const { accountId } = req.params;

  if (!ACCOUNT_FORMAT.test(accountId)) {
    return res.status(400).json({ error: 'Account ID must follow format ACC-XXXXX (e.g. ACC-A1B2C)' });
  }

  const transactions = store.getAll().filter(
    t => t.fromAccount === accountId || t.toAccount === accountId
  );

  if (transactions.length === 0) {
    return res.status(404).json({ error: `Account '${accountId}' not found` });
  }

  const totalDeposits: Record<string, number> = {};
  const totalWithdrawals: Record<string, number> = {};
  let lastTransactionDate = transactions[0].timestamp;

  for (const t of transactions) {
    if (t.timestamp > lastTransactionDate) {
      lastTransactionDate = t.timestamp;
    }

    if (t.type === 'deposit' && t.toAccount === accountId) {
      totalDeposits[t.currency] = (totalDeposits[t.currency] ?? 0) + t.amount;
    } else if (t.type === 'withdrawal' && t.fromAccount === accountId) {
      totalWithdrawals[t.currency] = (totalWithdrawals[t.currency] ?? 0) + t.amount;
    }
  }

  return res.status(200).json({
    accountId,
    transactionCount: transactions.length,
    totalDeposits,
    totalWithdrawals,
    lastTransactionDate,
  });
});

router.get('/:accountId/balance', (req: Request, res: Response) => {
  const { accountId } = req.params;
  const transactions = store.getAll();

  const accountExists = transactions.some(
    t => t.fromAccount === accountId || t.toAccount === accountId
  );

  if (!accountExists) {
    return res.status(404).json({ error: `Account '${accountId}' not found` });
  }

  // Aggregate completed transaction amounts per currency
  const balances: Record<string, number> = {};

  for (const t of transactions) {
    if (t.status !== 'completed') continue;

    balances[t.currency] ??= 0;

    if (t.type === 'deposit' && t.toAccount === accountId) {
      balances[t.currency] += t.amount;
    } else if (t.type === 'withdrawal' && t.fromAccount === accountId) {
      balances[t.currency] -= t.amount;
    } else if (t.type === 'transfer') {
      if (t.toAccount === accountId) balances[t.currency] += t.amount;
      if (t.fromAccount === accountId) balances[t.currency] -= t.amount;
    }
  }

  return res.status(200).json({ accountId, balances });
});

export default router;
