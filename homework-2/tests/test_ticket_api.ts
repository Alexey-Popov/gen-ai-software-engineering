import request from 'supertest';
import app from '../src/app';
import { clearStore } from '../src/services/ticket-service';

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

// Test 1
it('POST /tickets returns 201 with created ticket', async () => {
  const res = await request(app).post('/tickets').send(validPayload);
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
  expect(res.body.customer_email).toBe('alice@example.com');
  expect(res.body.created_at).toBeDefined();
});

// Test 2
it('POST /tickets returns 400 on missing required fields', async () => {
  const res = await request(app).post('/tickets').send({ customer_id: 'x' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Validation failed');
  expect(Array.isArray(res.body.details)).toBe(true);
});

// Test 3
it('POST /tickets returns 400 on invalid email', async () => {
  const res = await request(app)
    .post('/tickets')
    .send({ ...validPayload, customer_email: 'not-an-email' });
  expect(res.status).toBe(400);
  expect(res.body.details.some((d: any) => d.field === 'customer_email')).toBe(true);
});

// Test 4
it('GET /tickets returns 200 with array of all tickets', async () => {
  await request(app).post('/tickets').send(validPayload);
  await request(app).post('/tickets').send({ ...validPayload, customer_email: 'bob@example.com' });
  const res = await request(app).get('/tickets');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body).toHaveLength(2);
});

// Test 5
it('GET /tickets?status=new filters tickets by status', async () => {
  await request(app).post('/tickets').send(validPayload);
  const res = await request(app).get('/tickets?status=new');
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  res.body.forEach((t: any) => expect(t.status).toBe('new'));
});

// Test 6
it('GET /tickets?priority=high filters tickets by priority', async () => {
  await request(app).post('/tickets').send(validPayload);
  await request(app).post('/tickets').send({
    ...validPayload,
    customer_email: 'low@example.com',
    priority: 'low',
  });
  const res = await request(app).get('/tickets?priority=high');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].priority).toBe('high');
});

// Test 7
it('GET /tickets/:id returns 200 for an existing ticket', async () => {
  const created = await request(app).post('/tickets').send(validPayload);
  const res = await request(app).get(`/tickets/${created.body.id}`);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(created.body.id);
});

// Test 8
it('GET /tickets/:id returns 404 for an unknown id', async () => {
  const res = await request(app).get('/tickets/00000000-0000-0000-0000-000000000000');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('Ticket not found');
});

// Test 9
it('PUT /tickets/:id returns 200 with updated ticket', async () => {
  const created = await request(app).post('/tickets').send(validPayload);
  const res = await request(app)
    .put(`/tickets/${created.body.id}`)
    .send({ priority: 'urgent', status: 'in_progress' });
  expect(res.status).toBe(200);
  expect(res.body.priority).toBe('urgent');
  expect(res.body.status).toBe('in_progress');
});

// Test 10
it('PUT /tickets/:id returns 404 for an unknown id', async () => {
  const res = await request(app)
    .put('/tickets/00000000-0000-0000-0000-000000000000')
    .send({ priority: 'low' });
  expect(res.status).toBe(404);
});

// Test 11
it('DELETE /tickets/:id returns 204 and removes the ticket', async () => {
  const created = await request(app).post('/tickets').send(validPayload);
  const delRes = await request(app).delete(`/tickets/${created.body.id}`);
  expect(delRes.status).toBe(204);
  const getRes = await request(app).get(`/tickets/${created.body.id}`);
  expect(getRes.status).toBe(404);
});

// Test 12: auto-classify on create
it('POST /tickets?auto_classify=true applies classification to created ticket', async () => {
  const res = await request(app)
    .post('/tickets?auto_classify=true')
    .send({
      ...validPayload,
      subject: 'Password reset broken',
      description: 'I tried to reset my password but the login link expired immediately.',
      category: undefined,
      priority: undefined,
    });
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
  expect(res.body.category).toBeDefined();
  expect(res.body.priority).toBeDefined();
});

// Test 13: POST /:id/auto-classify
it('POST /tickets/:id/auto-classify returns classification result', async () => {
  const created = await request(app).post('/tickets').send({
    ...validPayload,
    subject: 'App crash on startup',
    description: 'The application crashes every time I try to open it on my device.',
  });
  const res = await request(app).post(`/tickets/${created.body.id}/auto-classify`);
  expect(res.status).toBe(200);
  expect(res.body.category).toBeDefined();
  expect(res.body.priority).toBeDefined();
  expect(res.body.reasoning).toBeDefined();
});

// Test 14: POST /:id/auto-classify returns 404 for unknown ticket
it('POST /tickets/:id/auto-classify returns 404 for unknown id', async () => {
  const res = await request(app).post('/tickets/00000000-0000-0000-0000-000000000000/auto-classify');
  expect(res.status).toBe(404);
});

// Test 15: DELETE returns 404 for unknown id
it('DELETE /tickets/:id returns 404 for unknown id', async () => {
  const res = await request(app).delete('/tickets/00000000-0000-0000-0000-000000000000');
  expect(res.status).toBe(404);
});

// Test 16: PUT returns 400 on invalid field value
it('PUT /tickets/:id returns 400 for invalid field value', async () => {
  const created = await request(app).post('/tickets').send(validPayload);
  const res = await request(app)
    .put(`/tickets/${created.body.id}`)
    .send({ customer_email: 'not-an-email' });
  expect(res.status).toBe(400);
  expect(res.body.details.some((d: any) => d.field === 'customer_email')).toBe(true);
});

// Test 17: GET /tickets filters by customer_id
it('GET /tickets?customer_id filters tickets by customer_id', async () => {
  await request(app).post('/tickets').send({ ...validPayload, customer_id: 'CUST-AAA' });
  await request(app).post('/tickets').send({ ...validPayload, customer_email: 'b@b.com', customer_id: 'CUST-BBB' });
  const res = await request(app).get('/tickets?customer_id=CUST-AAA');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].customer_id).toBe('CUST-AAA');
});

// Test 18: GET /tickets filters by assigned_to
it('GET /tickets?assigned_to filters tickets by assigned agent', async () => {
  await request(app).post('/tickets').send({ ...validPayload, assigned_to: 'agent-007' });
  await request(app).post('/tickets').send({ ...validPayload, customer_email: 'b@b.com' });
  const res = await request(app).get('/tickets?assigned_to=agent-007');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].assigned_to).toBe('agent-007');
});

// Test 19: POST /tickets/import auto-detects JSON from content shape
it('POST /tickets/import auto-detects JSON format from content shape', async () => {
  const json = JSON.stringify([validPayload]);
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/plain')
    .send(json);
  expect(res.status).toBe(200);
  expect(res.body.successful).toBe(1);
});

// Test 20: POST /tickets/import auto-detects XML from content shape
it('POST /tickets/import auto-detects XML format from content shape', async () => {
  const xml = `<tickets><ticket><customer_id>C1</customer_id><customer_email>a@b.com</customer_email><customer_name>Alice</customer_name><subject>Test</subject><description>Ten chars or more here.</description><category>account_access</category><priority>high</priority><status>new</status></ticket></tickets>`;
  const res = await request(app)
    .post('/tickets/import')
    .set('Content-Type', 'text/plain')
    .send(xml);
  expect(res.status).toBe(200);
  expect(res.body.successful).toBe(1);
});
