import { Router } from 'express';
import { getBalance } from '../store/transactionStore.js';

const router = Router();

router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;
  const balance = getBalance(accountId);
  res.json({ accountId, balance });
});

export default router;
