import express from 'express';

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Intelligent Customer Support Ticket System' });
});

export default app;
