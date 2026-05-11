import express from 'express';
import ticketsRouter from './routes/tickets.js';
import classifierRouter from './routes/classifier.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Intelligent Customer Support Ticket System' });
});

app.use('/tickets', ticketsRouter);
app.use('/classifier', classifierRouter);

app.use(errorHandler);

export default app;
