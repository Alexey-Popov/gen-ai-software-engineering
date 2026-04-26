import { Router } from 'express';
import { getBalance, getAccountSummary } from '../store/transactionStore.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;
  const balance = getBalance(accountId);
  res.json({ accountId, balance });
});

router.get('/:accountId/summary', (req, res) => {
  const { accountId } = req.params;
  res.json(getAccountSummary(accountId));
});

router.get('/:accountId/interest', (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { rate, days } = req.query;
    const details = [];

    const rateNum = Number(rate);
    if (rate === undefined || rate === '' || !Number.isFinite(rateNum) || rateNum <= 0) {
      details.push({ field: 'rate', message: 'rate must be a positive number (e.g. 0.05 for 5%)' });
    }

    const daysNum = Number(days);
    if (
      days === undefined ||
      days === '' ||
      !Number.isInteger(daysNum) ||
      daysNum <= 0
    ) {
      details.push({ field: 'days', message: 'days must be a positive integer' });
    }

    if (details.length > 0) {
      throw new ValidationError(details);
    }

    const balance = getBalance(accountId);
    const interest = Number(((balance * rateNum * daysNum) / 365).toFixed(2));

    res.json({
      accountId,
      balance,
      rate: rateNum,
      days: daysNum,
      interest,
      formula: 'balance × rate × days / 365',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
