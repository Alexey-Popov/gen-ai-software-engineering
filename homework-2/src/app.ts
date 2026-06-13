import express, { Express, Request, Response, NextFunction } from 'express';
import ticketRoutes from './routes/tickets';
import importRoutes from './routes/import';
import { requestIdMiddleware, errorMiddleware } from './utils/error-handler';

const app: Express = express();

app.use(express.json());
app.use(express.text({ type: ['text/csv', 'text/xml', 'text/plain', 'application/xml'] }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(requestIdMiddleware);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/tickets', importRoutes);
app.use('/tickets', ticketRoutes);

app.use(errorMiddleware);

export default app;
