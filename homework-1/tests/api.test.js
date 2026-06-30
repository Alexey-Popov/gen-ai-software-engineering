'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const store = require('../src/store/transactionStore');

// Rate limiting disabled here so functional cases are never throttled.
const app = createApp({ enableRateLimit: false });

const deposit = (toAccount, amount, extra = {}) => ({
  toAccount, amount, currency: 'USD', type: 'deposit', ...extra,
});
const transfer = (fromAccount, toAccount, amount, extra = {}) => ({
  fromAccount, toAccount, amount, currency: 'USD', type: 'transfer', ...extra,
});

beforeEach(() => store.clear());

describe('POST /transactions', () => {
  it('creates a transaction and returns 201 with server fields', async () => {
    const res = await request(app).post('/transactions').send(transfer('ACC-12345', 'ACC-67890', 100.5));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 100.5,
      type: 'transfer', status: 'completed',
    });
    expect(res.body.id).toBeTruthy();
    expect(res.body.timestamp).toBeTruthy();
  });

  it('returns 400 with details[] for invalid input', async () => {
    const res = await request(app).post('/transactions').send({ amount: -5, currency: 'XYZ', type: 'transfer' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Content-Type', 'application/json')
      .send('{ bad json');
    expect(res.status).toBe(400);
  });
});

describe('GET /transactions/:id', () => {
  it('fetches an existing transaction', async () => {
    const created = await request(app).post('/transactions').send(deposit('ACC-12345', 10));
    const res = await request(app).get(`/transactions/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 for a missing id', async () => {
    const res = await request(app).get('/transactions/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /transactions filtering', () => {
  beforeEach(async () => {
    await request(app).post('/transactions').send(deposit('ACC-11111', 100, { timestamp: '2024-01-05T10:00:00.000Z' }));
    await request(app).post('/transactions').send(transfer('ACC-11111', 'ACC-22222', 30, { timestamp: '2024-01-20T10:00:00.000Z' }));
    await request(app).post('/transactions').send(deposit('ACC-22222', 50, { timestamp: '2024-02-10T10:00:00.000Z' }));
  });

  it('filters by accountId (matches from OR to)', async () => {
    const res = await request(app).get('/transactions?accountId=ACC-11111');
    expect(res.body).toHaveLength(2);
  });

  it('filters by type', async () => {
    const res = await request(app).get('/transactions?type=deposit');
    expect(res.body).toHaveLength(2);
  });

  it('filters by inclusive date range (date-only bounds)', async () => {
    const res = await request(app).get('/transactions?from=2024-01-01&to=2024-01-31');
    expect(res.body).toHaveLength(2);
  });

  it('combines filters', async () => {
    const res = await request(app).get('/transactions?accountId=ACC-11111&type=transfer');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('transfer');
  });
});

describe('GET /accounts/:id/balance', () => {
  it('computes balance from completed credits minus debits', async () => {
    await request(app).post('/transactions').send(deposit('ACC-12345', 200));
    await request(app).post('/transactions').send(transfer('ACC-12345', 'ACC-67890', 75));
    const a = await request(app).get('/accounts/ACC-12345/balance');
    const b = await request(app).get('/accounts/ACC-67890/balance');
    expect(a.body.balance).toBe(125);
    expect(b.body.balance).toBe(75);
  });

  it('excludes non-completed transactions', async () => {
    await request(app).post('/transactions').send(deposit('ACC-12345', 200));
    await request(app).post('/transactions').send(deposit('ACC-12345', 999, { status: 'pending' }));
    const res = await request(app).get('/accounts/ACC-12345/balance');
    expect(res.body.balance).toBe(200);
  });

  it('rejects a malformed accountId with 400', async () => {
    const res = await request(app).get('/accounts/BAD/balance');
    expect(res.status).toBe(400);
  });
});

describe('GET /accounts/:id/summary', () => {
  it('keeps the identity balance == totalDeposits - totalWithdrawals', async () => {
    await request(app).post('/transactions').send(deposit('ACC-12345', 200));
    await request(app).post('/transactions').send(transfer('ACC-12345', 'ACC-67890', 50));
    const res = await request(app).get('/accounts/ACC-12345/summary');
    expect(res.body.totalDeposits).toBe(200);
    expect(res.body.totalWithdrawals).toBe(50);
    expect(res.body.balance).toBe(150);
    expect(res.body.numberOfTransactions).toBe(2);
    expect(res.body.mostRecentTransactionDate).toBeTruthy();
  });
});

describe('GET /accounts/:id/interest', () => {
  it('computes simple interest = balance × rate × days/365', async () => {
    await request(app).post('/transactions').send(deposit('ACC-12345', 1000));
    const res = await request(app).get('/accounts/ACC-12345/interest?rate=0.05&days=365');
    expect(res.body.interest).toBe(50);
  });

  it('rejects non-positive rate/days with 400', async () => {
    const res = await request(app).get('/accounts/ACC-12345/interest?rate=0&days=-5');
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(2);
  });
});

describe('GET /transactions/export', () => {
  it('exports CSV with a header row', async () => {
    await request(app).post('/transactions').send(deposit('ACC-12345', 10));
    const res = await request(app).get('/transactions/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('id,fromAccount,toAccount,amount,currency,type,timestamp,status');
    expect(lines).toHaveLength(2);
  });

  it('rejects an unsupported format with 400', async () => {
    const res = await request(app).get('/transactions/export?format=xml');
    expect(res.status).toBe(400);
  });
});

describe('rate limiting', () => {
  it('returns 429 after exceeding the limit', async () => {
    const limited = createApp({ enableRateLimit: true });
    // default 100/min; the limiter middleware uses its own option defaults,
    // but app.js wires the default. Hammer beyond 100 to trigger 429.
    let last;
    for (let i = 0; i < 101; i += 1) {
      last = await request(limited).get('/health');
    }
    expect(last.status).toBe(429);
    expect(last.body.error).toBe('Too Many Requests');
  });
});
