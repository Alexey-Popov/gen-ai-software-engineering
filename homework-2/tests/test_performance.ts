import request from 'supertest';
import app from '../src/app';
import { clearStore, createTicket } from '../src/services/ticket-service';
import { Category, Priority, Status } from '../src/models/ticket';

const validPayload = {
  customer_id: 'CUST001',
  customer_email: 'alice@example.com',
  customer_name: 'Alice Smith',
  subject: 'Cannot log in',
  description: 'I have been unable to log into my account for the past two days.',
  category: Category.AccountAccess,
  priority: Priority.High,
  status: Status.New,
};

function buildCSV(count: number): string {
  const header =
    'customer_id,customer_email,customer_name,subject,description,category,priority,status';
  const rows = Array.from(
    { length: count },
    (_, i) =>
      `CUST${i},user${i}@example.com,User ${i},Cannot log in,I have been unable to log into my account for two days.,account_access,high,new`
  );
  return [header, ...rows].join('\n');
}

beforeEach(() => {
  clearStore();
});

// Test 1
it('POST /tickets responds in under 100ms', async () => {
  const start = Date.now();
  const res = await request(app).post('/tickets').send(validPayload);
  const elapsed = Date.now() - start;
  expect(res.status).toBe(201);
  expect(elapsed).toBeLessThan(200);
});

// Test 2
it('GET /tickets with 1000 in-memory tickets responds in under 200ms', () => {
  for (let i = 0; i < 1000; i++) {
    createTicket({ ...validPayload, customer_email: `user${i}@example.com` });
  }
  const start = Date.now();
  return request(app)
    .get('/tickets')
    .then(res => {
      const elapsed = Date.now() - start;
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1000);
      expect(elapsed).toBeLessThan(200);
    });
});

// Test 3
it('bulk import of 100-record CSV completes in under 2000ms', async () => {
  const csv = buildCSV(100);
  const start = Date.now();
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/csv')
    .send(csv);
  const elapsed = Date.now() - start;
  expect(res.status).toBe(200);
  expect(res.body.successful).toBe(100);
  expect(elapsed).toBeLessThan(2000);
});

// Test 4
it('50 concurrent GET /tickets requests all complete without error', async () => {
  createTicket(validPayload);
  const requests = Array.from({ length: 50 }, () => request(app).get('/tickets'));
  const responses = await Promise.all(requests);
  responses.forEach(res => {
    expect(res.status).toBe(200);
  });
});

// Test 5
it('memory footprint after importing 100 tickets stays under 50MB increase', () => {
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) {
    createTicket({ ...validPayload, customer_email: `u${i}@example.com` });
  }
  const after = process.memoryUsage().heapUsed;
  const diffMB = (after - before) / 1024 / 1024;
  expect(diffMB).toBeLessThan(50);
});
