const express = require('express');
const ticketsRouter = require('./routes/tickets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/tickets/import', express.raw({ type: ['text/csv', 'application/json', 'application/xml', 'text/xml'], limit: '10mb' }));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/tickets', ticketsRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Customer Support System API',
    version: '1.0.0',
    endpoints: {
      tickets: '/tickets',
      health: '/'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /',
      'GET /tickets',
      'POST /tickets',
      'GET /tickets/:id',
      'PUT /tickets/:id',
      'DELETE /tickets/:id',
      'POST /tickets/import',
      'POST /tickets/:id/auto-classify'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Customer Support System API running on http://localhost:${PORT}`);
    console.log(`✓ Ready to handle ticket requests`);
  });
}

module.exports = app;
