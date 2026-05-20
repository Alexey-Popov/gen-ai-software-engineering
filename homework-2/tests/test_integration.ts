import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import app from '../src/app';
import { clearStore, getAllTickets, createTicket, resolveTicket } from '../src/services/ticket-service';
import { classifyTicket } from '../src/services/classifier';
import { Category, Status } from '../src/models/ticket';

const FIXTURES = join(__dirname, 'fixtures');

const validPayload = {
  customer_id: 'CUST001',
  customer_email: 'alice@example.com',
  customer_name: 'Alice Smith',
  subject: 'Cannot log in',
  description: 'I have been unable to log into my account for the past two days.',
  category: 'account_access',
  priority: 'high',
  status: 'new',
};

beforeEach(() => {
  clearStore();
});

// Test 1: full CRUD lifecycle
it('full create → read → update → delete lifecycle completes correctly', async () => {
  const created = await request(app).post('/tickets').send(validPayload);
  expect(created.status).toBe(201);
  const id = created.body.id;

  const fetched = await request(app).get(`/tickets/${id}`);
  expect(fetched.status).toBe(200);
  expect(fetched.body.subject).toBe('Cannot log in');

  const updated = await request(app).put(`/tickets/${id}`).send({ status: 'in_progress' });
  expect(updated.status).toBe(200);
  expect(updated.body.status).toBe('in_progress');

  const deleted = await request(app).delete(`/tickets/${id}`);
  expect(deleted.status).toBe(204);

  const gone = await request(app).get(`/tickets/${id}`);
  expect(gone.status).toBe(404);
});

// Test 2: bulk CSV import then list
it('bulk CSV import followed by GET /tickets returns all imported tickets', async () => {
  const csv = readFileSync(join(FIXTURES, 'valid-tickets.csv'), 'utf-8');
  const importRes = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/csv')
    .send(csv);
  expect(importRes.status).toBe(200);
  expect(importRes.body.successful).toBe(10);

  const listRes = await request(app).get('/tickets');
  expect(listRes.status).toBe(200);
  expect(listRes.body).toHaveLength(10);
});

// Test 3: create ticket then classify
it('create ticket then classify it via classifier service', async () => {
  const created = await request(app).post('/tickets').send({
    ...validPayload,
    subject: 'Password reset broken',
    description: 'I tried to reset my password but the login link expired immediately.',
  });
  expect(created.status).toBe(201);

  const classification = classifyTicket(created.body);
  expect(classification.category).toBe(Category.AccountAccess);
  expect(classification.keywords_found.length).toBeGreaterThan(0);
});

// Test 4: mixed import returns correct counts
it('mixed CSV import with invalid records returns correct successful/failed counts', async () => {
  const csv = readFileSync(join(FIXTURES, 'mixed-tickets.csv'), 'utf-8');
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/csv')
    .send(csv);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(5);
  expect(res.body.failed).toBeGreaterThan(0);
  expect(res.body.successful + res.body.failed).toBe(res.body.total);
});

// Test 5: multi-create then filter by category only
it('multi-create then filter by category returns only matching tickets', async () => {
  await request(app).post('/tickets').send({ ...validPayload, category: 'account_access' });
  await request(app).post('/tickets').send({
    ...validPayload,
    customer_email: 'b@example.com',
    category: 'billing_question',
  });
  await request(app).post('/tickets').send({
    ...validPayload,
    customer_email: 'c@example.com',
    category: 'billing_question',
  });

  const res = await request(app).get('/tickets?category=billing_question');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
  res.body.forEach((t: any) => expect(t.category).toBe('billing_question'));
});

// Test 5b: combined filtering by category AND priority
it('combined category + priority filter returns only tickets matching both fields', async () => {
  const base = { ...validPayload };
  await request(app).post('/tickets').send({ ...base, customer_email: 'a@example.com', category: 'technical_issue', priority: 'urgent' });
  await request(app).post('/tickets').send({ ...base, customer_email: 'b@example.com', category: 'technical_issue', priority: 'low' });
  await request(app).post('/tickets').send({ ...base, customer_email: 'c@example.com', category: 'billing_question', priority: 'urgent' });
  await request(app).post('/tickets').send({ ...base, customer_email: 'd@example.com', category: 'billing_question', priority: 'low' });

  const res = await request(app).get('/tickets?category=technical_issue&priority=urgent');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].category).toBe('technical_issue');
  expect(res.body[0].priority).toBe('urgent');
});

// Test 6: HTTP JSON import covers route JSON branch
it('POST /tickets/import with application/json Content-Type imports JSON tickets', async () => {
  const json = readFileSync(join(FIXTURES, 'valid-tickets.json'), 'utf-8');
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'application/json')
    .send(json);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(3);
  expect(res.body.successful).toBe(3);
});

// Test 7: HTTP XML import covers route XML branch
it('POST /tickets/import with text/xml Content-Type imports XML tickets', async () => {
  const xml = readFileSync(join(FIXTURES, 'valid-tickets.xml'), 'utf-8');
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/xml')
    .send(xml);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(3);
  expect(res.body.successful).toBe(3);
});

// Test 8: import with ?format=csv query param
it('POST /tickets/import?format=csv accepts format via query parameter', async () => {
  const csv = readFileSync(join(FIXTURES, 'valid-tickets.csv'), 'utf-8');
  const res = await request(app)
    .post('/tickets/import?format=csv')
    .set('Content-Type', 'text/plain')
    .send(csv);
  expect(res.status).toBe(200);
  expect(res.body.successful).toBe(10);
});

// Test 9: bulk import + auto-classification verification
// Tickets are sent WITHOUT category/priority so auto-classify is the only source
it('POST /tickets/import?auto_classify=true assigns correct categories from keywords', async () => {
  const unclassified = [
    {
      customer_id: 'C1',
      customer_email: 'a@example.com',
      customer_name: 'Alice',
      subject: 'Cannot login',
      description: 'I forgot my password and cannot sign in to my account at all.',
    },
    {
      customer_id: 'C2',
      customer_email: 'b@example.com',
      customer_name: 'Bob',
      subject: 'App crash on startup',
      description: 'The application crash every time I try to open it on my phone.',
    },
    {
      customer_id: 'C3',
      customer_email: 'c@example.com',
      customer_name: 'Carol',
      subject: 'Invoice amount wrong',
      description: 'My invoice shows the wrong charge amount for this billing period.',
    },
  ];

  const res = await request(app)
    .post('/tickets/import?auto_classify=true')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(unclassified));

  expect(res.status).toBe(200);
  expect(res.body.successful).toBe(3);

  const listRes = await request(app).get('/tickets');
  const tickets: any[] = listRes.body;

  const byCustomer = (id: string) => tickets.find((t: any) => t.customer_id === id);

  // Classifier should recognise keyword "password" → account_access
  expect(byCustomer('C1').category).toBe('account_access');
  // Classifier should recognise keyword "crash" → technical_issue
  expect(byCustomer('C2').category).toBe('technical_issue');
  // Classifier should recognise keyword "invoice" / "charge" → billing_question
  expect(byCustomer('C3').category).toBe('billing_question');

  // Every ticket must also have a priority assigned by the classifier
  tickets.forEach(t => expect(t.priority).toBeDefined());
});

// Test 9b: 25 concurrent POST /tickets requests all succeed without data loss
it('25 concurrent POST /tickets requests all succeed and are all stored', async () => {
  const requests = Array.from({ length: 25 }, (_, i) =>
    request(app)
      .post('/tickets')
      .send({
        customer_id: `CUST${i}`,
        customer_email: `user${i}@example.com`,
        customer_name: `User ${i}`,
        subject: `Concurrent ticket ${i}`,
        description: `This is concurrent test ticket number ${i} for load testing.`,
        category: 'technical_issue',
        priority: 'medium',
      })
  );

  const responses = await Promise.all(requests);

  responses.forEach(res => expect(res.status).toBe(201));

  const listRes = await request(app).get('/tickets');
  expect(listRes.body).toHaveLength(25);

  const ids = new Set(responses.map(r => r.body.id));
  expect(ids.size).toBe(25);
});

// Test 10: resolveTicket service function sets status and resolved_at
it('resolveTicket sets ticket status to resolved with a timestamp', () => {
  const ticket = createTicket({
    customer_id: 'CUST001',
    customer_email: 'alice@example.com',
    customer_name: 'Alice Smith',
    subject: 'Cannot log in',
    description: 'I have been unable to log into my account for the past two days.',
    category: Category.AccountAccess,
    priority: 'high' as any,
  });
  const resolved = resolveTicket(ticket.id, 'agent-007');
  expect(resolved).not.toBeNull();
  expect(resolved!.status).toBe(Status.Resolved);
  expect(resolved!.resolved_at).toBeDefined();
  expect(resolved!.assigned_to).toBe('agent-007');
});

// Test 11: resolveTicket returns null for unknown ticket
it('resolveTicket returns null for an unknown ticket id', () => {
  expect(resolveTicket('no-such-id')).toBeNull();
});
