const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemoryStorage');
const { isValidAccountId } = require('../validators/transactionValidator');
const { calculateBalance, calculateSummary, calculateInterest } = require('../utils/helpers');

const DEFAULT_CURRENCY = 'USD';

router.get('/:accountId/balance', (req, res) => {
  try {
    const { accountId } = req.params;

    if (!isValidAccountId(accountId)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'accountId', message: 'Account ID must follow format ACC-XXXXX' }]
      });
    }

    const transactions = storage.getAllTransactions();
    const balance = calculateBalance(accountId, transactions);

    return res.status(200).json({
      accountId,
      balance,
      currency: DEFAULT_CURRENCY
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

router.get('/:accountId/summary', (req, res) => {
  try {
    const { accountId } = req.params;

    if (!isValidAccountId(accountId)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'accountId', message: 'Account ID must follow format ACC-XXXXX' }]
      });
    }

    const transactions = storage.getAllTransactions();
    const summary = calculateSummary(accountId, transactions);

    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

router.get('/:accountId/interest', (req, res) => {
  try {
    const { accountId } = req.params;
    const { rate, days } = req.query;

    if (!isValidAccountId(accountId)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'accountId', message: 'Account ID must follow format ACC-XXXXX' }]
      });
    }

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 1) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'rate', message: 'Rate must be between 0 and 1 (e.g., 0.05 for 5%)' }]
      });
    }

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'days', message: 'Days must be a positive integer' }]
      });
    }

    const transactions = storage.getAllTransactions();
    const currentBalance = calculateBalance(accountId, transactions);
    const calculatedInterest = calculateInterest(currentBalance, rateNum, daysNum);

    return res.status(200).json({
      accountId,
      currentBalance,
      interestRate: rateNum,
      days: daysNum,
      calculatedInterest
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
