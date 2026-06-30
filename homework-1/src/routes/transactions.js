'use strict';

const express = require('express');
const transactionService = require('../services/transactionService');
const { validateTransaction } = require('../validators/transactionValidator');
const { transactionsToCsv } = require('../utils/csv');
const { HttpError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * POST /transactions — create a transaction.
 * 201 on success, 400 with details[] on validation failure.
 */
router.post('/', (req, res) => {
  const { valid, details } = validateTransaction(req.body);
  if (!valid) {
    throw new HttpError(400, 'Validation failed', details);
  }
  const transaction = transactionService.create(req.body);
  res.status(201).json(transaction);
});

/**
 * GET /transactions/export?format=csv — export transactions (with the same
 * filters as the list endpoint). Registered before `/:id` so "export" is not
 * captured as an id.
 */
router.get('/export', (req, res) => {
  const format = (req.query.format || 'csv').toLowerCase();
  if (format !== 'csv') {
    throw new HttpError(400, `Unsupported export format: ${format} (only csv)`);
  }
  const transactions = transactionService.list(req.query);
  const csv = transactionsToCsv(transactions);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.status(200).send(csv);
});

/**
 * GET /transactions — list with optional filters: accountId, type, from, to.
 */
router.get('/', (req, res) => {
  const transactions = transactionService.list(req.query);
  res.status(200).json(transactions);
});

/**
 * GET /transactions/:id — fetch one transaction. 404 if not found.
 */
router.get('/:id', (req, res) => {
  const transaction = transactionService.getById(req.params.id);
  if (!transaction) {
    throw new HttpError(404, `Transaction not found: ${req.params.id}`);
  }
  res.status(200).json(transaction);
});

module.exports = router;
