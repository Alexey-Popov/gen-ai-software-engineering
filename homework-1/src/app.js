import express from 'express';
import transactionsRouter from './routes/transactions.js';
import accountsRouter from './routes/accounts.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'Banking Transactions API',
      status: 'ok',
      version: '1.0.0',
    });
  });

  app.use('/transactions', transactionsRouter);
  app.use('/accounts', accountsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
