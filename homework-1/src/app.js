'use strict';

const express = require('express');
const transactionsRouter = require('./routes/transactions');
const accountsRouter = require('./routes/accounts');
const { rateLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Build the Express application.
 *
 * Exposed as a factory (no .listen here) so tests can mount it with supertest
 * without binding a port. The HTTP server is started in src/index.js.
 *
 * @param {object} [options]
 * @param {boolean} [options.enableRateLimit=true] - toggle the rate limiter
 *   (tests disable it so unrelated cases are not throttled).
 * @returns {import('express').Express}
 */
function createApp(options = {}) {
  const { enableRateLimit = true } = options;
  const app = express();

  app.use(express.json());

  if (enableRateLimit) {
    app.use(rateLimiter());
  }

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/transactions', transactionsRouter);
  app.use('/accounts', accountsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
