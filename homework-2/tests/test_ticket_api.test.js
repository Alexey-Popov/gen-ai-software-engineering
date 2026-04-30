const request = require('supertest');
const app = require('../src/index');
const storage = require('../src/storage/inMemoryStorage');

describe('Ticket API', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('POST /tickets - should create valid ticket (201)', async () => {
    const ticket = {
      customer_email: 'john@example.com',
      customer_name: 'John Doe',
      subject: 'Test Subject',
      description: 'This is a test description with enough characters for validation'
    };

    const response = await request(app)
      .post('/tickets')
      .send(ticket)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.customer_email).toBe('john@example.com');
    expect(response.body.status).toBe('new');
  });

  test('POST /tickets - should return 400 for validation error', async () => {
    const ticket = {
      customer_email: 'invalid-email',
      customer_name: 'John',
      subject: 'Test',
      description: 'Short'
    };

    const response = await request(app)
      .post('/tickets')
      .send(ticket)
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  test('GET /tickets - should list all tickets (200)', async () => {
    await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test description here'
      });

    const response = await request(app)
      .get('/tickets')
      .expect(200);

    expect(response.body.count).toBeGreaterThan(0);
    expect(Array.isArray(response.body.tickets)).toBe(true);
  });

  test('GET /tickets?category=X - should filter by category', async () => {
    await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test description here',
        category: 'billing_question'
      });

    const response = await request(app)
      .get('/tickets?category=billing_question')
      .expect(200);

    expect(response.body.tickets.every(t => t.category === 'billing_question')).toBe(true);
  });

  test('GET /tickets/:id - should get existing ticket (200)', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test description here'
      });

    const ticketId = createResponse.body.id;

    const response = await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(200);

    expect(response.body.id).toBe(ticketId);
  });

  test('GET /tickets/:id - should return 404 for non-existent ticket', async () => {
    const response = await request(app)
      .get('/tickets/non-existent-id')
      .expect(404);

    expect(response.body.error).toBe('Ticket not found');
  });

  test('PUT /tickets/:id - should update ticket (200)', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test description here'
      });

    const ticketId = createResponse.body.id;

    const response = await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(response.body.status).toBe('in_progress');
  });

  test('PUT /tickets/:id - should return 404 if not found', async () => {
    await request(app)
      .put('/tickets/non-existent-id')
      .send({ status: 'resolved' })
      .expect(404);
  });

  test('DELETE /tickets/:id - should delete ticket (200)', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test description here'
      });

    const ticketId = createResponse.body.id;

    await request(app)
      .delete(`/tickets/${ticketId}`)
      .expect(200);

    await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(404);
  });

  test('DELETE /tickets/:id - should return 404 if not found', async () => {
    await request(app)
      .delete('/tickets/non-existent-id')
      .expect(404);
  });

  test('POST /tickets/:id/auto-classify - should classify ticket', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Cannot login to my account',
        description: 'I forgot my password and need help with password reset'
      });

    const ticketId = createResponse.body.id;

    const response = await request(app)
      .post(`/tickets/${ticketId}/auto-classify`)
      .expect(200);

    expect(response.body.category).toBeDefined();
    expect(response.body.priority).toBeDefined();
    expect(response.body.confidence).toBeGreaterThanOrEqual(0);
  });
});
