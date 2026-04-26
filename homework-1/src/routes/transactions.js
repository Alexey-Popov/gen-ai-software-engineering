import { Router } from 'express';
import {
  createTransaction,
  getAllTransactions,
  getTransactionById,
} from '../store/transactionStore.js';
import { validateTransactionPayload } from '../validators/transactionValidator.js';
import { validateTransactionFilters } from '../validators/queryValidator.js';
import { toCsv } from '../utils/csv.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

const EXPORT_COLUMNS = [
  'id',
  'fromAccount',
  'toAccount',
  'amount',
  'currency',
  'type',
  'timestamp',
  'status',
];

router.post('/', (req, res, next) => {
  try {
    const payload = validateTransactionPayload(req.body);
    const transaction = createTransaction(payload);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const filters = validateTransactionFilters(req.query);
    res.json(getAllTransactions(filters));
  } catch (err) {
    next(err);
  }
});

// IMPORTANT: must be registered before "/:id" so it isn't captured as a transaction id.
router.get('/export', (req, res, next) => {
  try {
    const { format = 'csv', ...filterQuery } = req.query;
    if (format !== 'csv' && format !== 'json') {
      throw new ValidationError([
        { field: 'format', message: 'format must be either "csv" or "json"' },
      ]);
    }

    const filters = validateTransactionFilters(filterQuery);
    const data = getAllTransactions(filters);

    if (format === 'json') {
      return res.json(data);
    }

    const csv = toCsv(data, EXPORT_COLUMNS);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res) => {
  const transaction = getTransactionById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
});

export default router;
