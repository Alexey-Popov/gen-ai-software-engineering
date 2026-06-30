'use strict';

const express = require('express');
const accountService = require('../services/accountService');
const { ACCOUNT_REGEX } = require('../validators/transactionValidator');
const { HttpError } = require('../middleware/errorHandler');

const router = express.Router();

/** Reject path params that are not well-formed account numbers (400). */
function assertAccountId(accountId) {
  if (!ACCOUNT_REGEX.test(accountId)) {
    throw new HttpError(400, 'Validation failed', [
      { field: 'accountId', message: 'accountId must match format ACC-XXXXX (5 alphanumeric characters)' },
    ]);
  }
}

/**
 * GET /accounts/:accountId/balance — current balance (completed transactions).
 */
router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;
  assertAccountId(accountId);
  res.status(200).json({ accountId, balance: accountService.getBalance(accountId) });
});

/**
 * GET /accounts/:accountId/summary — deposits/withdrawals/count/recency.
 */
router.get('/:accountId/summary', (req, res) => {
  const { accountId } = req.params;
  assertAccountId(accountId);
  res.status(200).json(accountService.getSummary(accountId));
});

/**
 * GET /accounts/:accountId/interest?rate=&days= — simple interest on balance.
 * rate must be a positive decimal; days a positive integer.
 */
router.get('/:accountId/interest', (req, res) => {
  const { accountId } = req.params;
  assertAccountId(accountId);

  const rate = Number(req.query.rate);
  const days = Number(req.query.days);
  const details = [];
  if (!Number.isFinite(rate) || rate <= 0) {
    details.push({ field: 'rate', message: 'rate must be a positive number' });
  }
  if (!Number.isInteger(days) || days <= 0) {
    details.push({ field: 'days', message: 'days must be a positive integer' });
  }
  if (details.length > 0) {
    throw new HttpError(400, 'Validation failed', details);
  }

  res.status(200).json(accountService.getInterest(accountId, rate, days));
});

module.exports = router;
