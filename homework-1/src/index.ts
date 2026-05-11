import express, { Request, Response } from 'express';
import transactionRoutes from './routes/transactions';
import accountRoutes from './routes/accounts';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.use('/transactions', transactionRoutes);
app.use('/accounts', accountRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Banking API running on http://localhost:${PORT}`);
});

export default app;
