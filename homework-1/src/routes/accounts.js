import { Router } from 'express';
import { getBalance, getAccountSummary } from '../store/transactionStore.js';

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

export default router;
