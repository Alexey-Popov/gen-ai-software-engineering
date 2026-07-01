import express from 'express';
import transactionsRouter from './routes/transactions.js';
import accountsRouter from './routes/accounts.js';
import rateLimiter from './middleware/rateLimiter.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(rateLimiter);

  app.use('/transactions', transactionsRouter);
  app.use('/accounts', accountsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.statusCode ?? 500).json({ error: err.message ?? 'Internal server error' });
  });

  return app;
}

const PORT = process.env.PORT || 3000;
createApp().listen(PORT, () => {
  console.log(`Transactions API running on http://localhost:${PORT}`);
});
