import { Router } from 'express';
import { transactionRepository } from '../store.js';
import { validateTransaction, parseFilterErrors } from '../validators/transactionValidator.js';
import { escapeCSV, CSV_FIELDS } from '../utils/helpers.js';
import { createTransaction } from '../models/transaction.js';

const router = Router();

router.post('/', (req, res) => {
  const errors = validateTransaction(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  const transaction = transactionRepository.create(createTransaction(req.body));
  return res.status(201).json(transaction);
});

// Must be defined before /:id to avoid Express matching "export" as an id param
router.get('/export', (req, res) => {
  if (req.query.format && req.query.format !== 'csv') {
    return res.status(400).json({
      error: 'Unsupported format',
      details: [{ field: 'format', message: 'Only csv format is supported' }],
    });
  }

  const filterErrors = parseFilterErrors(req.query);
  if (filterErrors.length > 0) {
    return res.status(400).json({ error: 'Invalid filter parameters', details: filterErrors });
  }

  const result = transactionRepository.query(req.query);
  const rows = result.map((t) => CSV_FIELDS.map((f) => escapeCSV(t[f])).join(','));
  const csv = [CSV_FIELDS.join(','), ...rows].join('\n');

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="transactions.csv"');
  return res.send(csv);
});

router.get('/', (req, res) => {
  const filterErrors = parseFilterErrors(req.query);
  if (filterErrors.length > 0) {
    return res.status(400).json({ error: 'Invalid filter parameters', details: filterErrors });
  }
  return res.json(transactionRepository.query(req.query));
});

router.get('/:id', (req, res) => {
  const transaction = transactionRepository.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: `Transaction with id '${req.params.id}' not found` });
  }
  return res.json(transaction);
});

export default router;
