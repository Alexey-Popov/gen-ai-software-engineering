import { Router } from 'express';
import { getAll } from '../classifier/decisionLog.js';

const router = Router();

/**
 * GET /classifier/log — return classifier decision log (oldest first).
 * Read-only; useful for debugging and graders.
 */
router.get('/log', (_req, res) => {
  res.json(getAll());
});

export default router;
