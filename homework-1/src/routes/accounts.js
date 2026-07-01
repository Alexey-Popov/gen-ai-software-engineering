import { Router } from 'express';
import { transactionRepository } from '../store.js';
import { computeBalance, addToTotal } from '../utils/helpers.js';

const router = Router();

function getCompletedAccountTransactions(accountId) {
  return transactionRepository.getAll().filter(
    (t) => t.status === 'completed' && (t.fromAccount === accountId || t.toAccount === accountId),
  );
}

router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;
  const relevant = getCompletedAccountTransactions(accountId);

  if (relevant.length === 0) {
    return res.status(404).json({ error: `Account '${accountId}' not found` });
  }

  return res.json({ accountId, balances: computeBalance(accountId, relevant) });
});

router.get('/:accountId/summary', (req, res) => {
  const { accountId } = req.params;
  const relevant = getCompletedAccountTransactions(accountId);

  if (relevant.length === 0) {
    return res.status(404).json({ error: `Account '${accountId}' not found` });
  }

  const summary = {
    accountId,
    transactionCount: relevant.length,
    lastTransactionDate: relevant[relevant.length - 1].timestamp,
    deposits: { count: 0, total: {} },
    withdrawals: { count: 0, total: {} },
    transfers: {
      sent: { count: 0, total: {} },
      received: { count: 0, total: {} },
    },
  };

  for (const { type, currency, amount, fromAccount, toAccount } of relevant) {
    if (type === 'deposit' && toAccount === accountId) {
      summary.deposits.count++;
      addToTotal(summary.deposits.total, currency, amount);
    } else if (type === 'withdrawal' && fromAccount === accountId) {
      summary.withdrawals.count++;
      addToTotal(summary.withdrawals.total, currency, amount);
    } else if (type === 'transfer') {
      if (fromAccount === accountId) {
        summary.transfers.sent.count++;
        addToTotal(summary.transfers.sent.total, currency, amount);
      }
      if (toAccount === accountId) {
        summary.transfers.received.count++;
        addToTotal(summary.transfers.received.total, currency, amount);
      }
    }
  }

  return res.json(summary);
});

router.get('/:accountId/interest', (req, res) => {
  const { accountId } = req.params;
  const { rate, days } = req.query;
  const errors = [];

  const rateNum = parseFloat(rate);
  const daysNum = parseInt(days, 10);

  if (rate === undefined) {
    errors.push({ field: 'rate', message: 'rate is required (e.g. ?rate=0.05 for 5% annual rate)' });
  } else if (isNaN(rateNum) || rateNum < 0) {
    errors.push({ field: 'rate', message: 'rate must be a non-negative number (e.g. 0.05 for 5%)' });
  }

  if (days === undefined) {
    errors.push({ field: 'days', message: 'days is required (e.g. ?days=30)' });
  } else if (isNaN(daysNum) || daysNum <= 0 || String(daysNum) !== String(days.trim())) {
    errors.push({ field: 'days', message: 'days must be a positive integer' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const relevant = getCompletedAccountTransactions(accountId);
  if (relevant.length === 0) {
    return res.status(404).json({ error: `Account '${accountId}' not found` });
  }

  const currentBalance = computeBalance(accountId, relevant);

  const interest = {};
  const projectedBalance = {};
  for (const [currency, balance] of Object.entries(currentBalance)) {
    // Simple interest: I = P × r × (t / 365)
    interest[currency] = parseFloat((balance * rateNum * (daysNum / 365)).toFixed(2));
    projectedBalance[currency] = parseFloat((balance + interest[currency]).toFixed(2));
  }

  return res.json({ accountId, currentBalance, annualRate: rateNum, days: daysNum, interest, projectedBalance });
});

export default router;
