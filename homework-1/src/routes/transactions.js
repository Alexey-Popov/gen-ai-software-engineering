const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const storage = require('../storage/inMemoryStorage');
const { validateTransaction, isValidDate } = require('../validators/transactionValidator');
const { transactionsToCSV } = require('../utils/helpers');

const CSV_FORMAT = 'csv';
const CSV_CONTENT_TYPE = 'text/csv';
const CSV_FILENAME = 'transactions.csv';

router.post('/', (req, res) => {
  try {
    const validation = validateTransaction(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const transaction = new Transaction(req.body);
    storage.addTransaction(transaction);

    return res.status(201).json(transaction.toJSON());
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const { accountId, type, from, to, format } = req.query;

    if (format === CSV_FORMAT) {
      const transactions = storage.getAllTransactions();
      const csv = transactionsToCSV(transactions);
      res.setHeader('Content-Type', CSV_CONTENT_TYPE);
      res.setHeader('Content-Disposition', `attachment; filename=${CSV_FILENAME}`);
      return res.send(csv);
    }

    const filters = {};
    if (accountId) filters.accountId = accountId;
    if (type) filters.type = type;
    if (from) {
      if (!isValidDate(from)) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ field: 'from', message: 'Invalid date format. Use ISO 8601' }]
        });
      }
      filters.from = from;
    }
    if (to) {
      if (!isValidDate(to)) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ field: 'to', message: 'Invalid date format. Use ISO 8601' }]
        });
      }
      filters.to = to;
    }

    const transactions = Object.keys(filters).length > 0
      ? storage.getFilteredTransactions(filters)
      : storage.getAllTransactions();

    return res.status(200).json({
      count: transactions.length,
      transactions
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

router.get('/export', (req, res) => {
  try {
    const { format } = req.query;

    if (format !== CSV_FORMAT) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'format', message: 'Only CSV format is supported' }]
      });
    }

    const transactions = storage.getAllTransactions();
    const csv = transactionsToCSV(transactions);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const transaction = storage.getTransactionById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        id: req.params.id
      });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
