const request = require('supertest');
const app = require('../src/app');
const { clearTickets, createTicket } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Ticket API', () => {
  const validData = {
    customer_email: 'test@example.com',
    subject: 'Valid Subject',
    description: 'This is a valid description that is long enough.'
  };

  test('POST /tickets creates ticket', async () => {
    const res = await request(app).post('/tickets').send(validData);
    expect(res.status).toBe(201);
    expect(res.body.customer_email).toBe(validData.customer_email);
  });

  test('POST /tickets fails with invalid data', async () => {
    const res = await request(app).post('/tickets').send({ ...validData, customer_email: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('GET /tickets returns list of tickets', async () => {
    createTicket(validData);
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /tickets filters by category', async () => {
    createTicket({ ...validData, category: 'bug_report' });
    createTicket({ ...validData, category: 'feature_request', customer_email: 'a@b.com' });
    const res = await request(app).get('/tickets?category=bug_report');
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('bug_report');
  });

  test('GET /tickets filters by priority', async () => {
    createTicket({ ...validData, priority: 'urgent' });
    createTicket({ ...validData, priority: 'low', customer_email: 'a@b.com' });
    const res = await request(app).get('/tickets?priority=urgent');
    expect(res.body.length).toBe(1);
    expect(res.body[0].priority).toBe('urgent');
  });

  test('GET /tickets/:id returns ticket', async () => {
    const ticket = createTicket(validData);
    const res = await request(app).get(`/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
  });

  test('GET /tickets/:id returns 404 for unknown', async () => {
    const res = await request(app).get('/tickets/unknown');
    expect(res.status).toBe(404);
  });

  test('PUT /tickets/:id updates ticket', async () => {
    const ticket = createTicket(validData);
    const res = await request(app).put(`/tickets/${ticket.id}`).send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
  });

  test('PUT /tickets/:id returns 404 for unknown', async () => {
    const res = await request(app).put('/tickets/unknown').send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  test('DELETE /tickets/:id deletes ticket', async () => {
    const ticket = createTicket(validData);
    const res = await request(app).delete(`/tickets/${ticket.id}`);
    expect(res.status).toBe(204);
  });

  test('DELETE /tickets/:id returns 404 for unknown', async () => {
    const res = await request(app).delete('/tickets/unknown');
    expect(res.status).toBe(404);
  });
});
