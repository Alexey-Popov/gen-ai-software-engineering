const express = require('express');
const transactionsRouter = require('./routes/transactions');
const accountsRouter = require('./routes/accounts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/transactions', transactionsRouter);
app.use('/accounts', accountsRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Banking Transactions API',
    version: '1.0.0',
    endpoints: {
      transactions: {
        'POST /transactions': 'Create a new transaction',
        'GET /transactions': 'List all transactions (supports filtering)',
        'GET /transactions/:id': 'Get transaction by ID',
        'GET /transactions/export?format=csv': 'Export transactions as CSV'
      },
      accounts: {
        'GET /accounts/:accountId/balance': 'Get account balance',
        'GET /accounts/:accountId/summary': 'Get transaction summary',
        'GET /accounts/:accountId/interest': 'Calculate interest (params: rate, days)'
      }
    },
    filters: {
      'accountId': 'Filter by account (e.g., ?accountId=ACC-12345)',
      'type': 'Filter by type (e.g., ?type=transfer)',
      'from': 'Filter by start date (e.g., ?from=2024-01-01)',
      'to': 'Filter by end date (e.g., ?to=2024-01-31)'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('\n🏦 Banking Transactions API\n');
  console.table({
    'Status': 'Running',
    'Port': PORT,
    'API URL': `http://localhost:${PORT}`,
    'Documentation': `http://localhost:${PORT}/`,
    'Stop Server': 'Press Ctrl+C'
  });
});

module.exports = app;
