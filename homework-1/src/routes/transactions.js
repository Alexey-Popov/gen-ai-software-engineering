import { Router } from 'express';
import {
  createTransaction,
  getAllTransactions,
  getTransactionById,
} from '../store/transactionStore.js';
import { validateTransactionPayload } from '../validators/transactionValidator.js';

const router = Router();

router.post('/', (req, res, next) => {
  try {
    const payload = validateTransactionPayload(req.body);
    const transaction = createTransaction(payload);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

router.get('/', (_req, res) => {
  res.json(getAllTransactions());
});

router.get('/:id', (req, res) => {
  const transaction = getTransactionById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
});

export default router;
