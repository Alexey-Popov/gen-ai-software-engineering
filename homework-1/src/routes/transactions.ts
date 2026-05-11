import { Router, Request, Response } from 'express';
import * as store from '../models/store';
import { validateTransaction } from '../validators/transaction.validator';
import { parseFilters, applyFilters } from '../utils/filter';
import { generateId } from '../utils/id';
import { Transaction } from '../models/transaction';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { errors, input } = validateTransaction(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const transaction: Transaction = {
    ...input!,
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  return res.status(201).json(store.add(transaction));
});

router.get('/', (req: Request, res: Response) => {
  const { errors, filters } = parseFilters(req.query as Record<string, unknown>);

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid filter parameters', details: errors });
  }

  return res.status(200).json(applyFilters(store.getAll(), filters));
});

router.get('/:id', (req: Request, res: Response) => {
  const transaction = store.getById(req.params.id);

  if (!transaction) {
    return res.status(404).json({ error: `Transaction '${req.params.id}' not found` });
  }

  return res.status(200).json(transaction);
});

export default router;
