const request = require('supertest');
const app = require('../src/index');
const storage = require('../src/storage/inMemoryStorage');
const fs = require('fs');
const path = require('path');

describe('Integration Tests', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('Complete ticket lifecycle: create → update → classify → resolve', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'lifecycle@example.com',
        customer_name: 'Lifecycle Test',
        subject: 'Cannot login',
        description: 'I forgot my password and need urgent help with account access'
      })
      .expect(201);

    const ticketId = createResponse.body.id;

    await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ status: 'in_progress' })
      .expect(200);

    const classifyResponse = await request(app)
      .post(`/tickets/${ticketId}/auto-classify`)
      .expect(200);

    expect(classifyResponse.body.category).toBe('account_access');

    await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ status: 'resolved', resolved_at: new Date().toISOString() })
      .expect(200);

    const finalResponse = await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(200);

    expect(finalResponse.body.status).toBe('resolved');
    expect(finalResponse.body.category).toBe('account_access');
  });

  test('Bulk import CSV → auto-classify all tickets', async () => {
    const csvPath = path.join(__dirname, 'fixtures', 'valid_tickets.csv');
    const csvBuffer = fs.readFileSync(csvPath);

    const importResponse = await request(app)
      .post('/tickets/import')
      .set('Content-Type', 'text/csv')
      .send(csvBuffer)
      .expect(200);

    expect(importResponse.body.successful).toBeGreaterThan(0);

    const ticketsResponse = await request(app)
      .get('/tickets')
      .expect(200);

    for (const ticket of ticketsResponse.body.tickets) {
      await request(app)
        .post(`/tickets/${ticket.id}/auto-classify`)
        .expect(200);
    }

    const finalResponse = await request(app)
      .get('/tickets')
      .expect(200);

    expect(finalResponse.body.tickets.length).toBeGreaterThan(0);
  });

  test('Combined filters: category + priority + status', async () => {
    await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test1@example.com',
        customer_name: 'Test 1',
        subject: 'Test',
        description: 'Test description',
        category: 'billing_question',
        priority: 'high',
        status: 'new'
      });

    await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test2@example.com',
        customer_name: 'Test 2',
        subject: 'Test',
        description: 'Test description',
        category: 'billing_question',
        priority: 'high',
        status: 'resolved'
      });

    const response = await request(app)
      .get('/tickets?category=billing_question&priority=high&status=new')
      .expect(200);

    expect(response.body.tickets.length).toBe(1);
    expect(response.body.tickets[0].category).toBe('billing_question');
    expect(response.body.tickets[0].priority).toBe('high');
    expect(response.body.tickets[0].status).toBe('new');
  });

  test('Update ticket with manual category override', async () => {
    const createResponse = await request(app)
      .post('/tickets')
      .send({
        customer_email: 'test@example.com',
        customer_name: 'Test',
        subject: 'Test',
        description: 'Test description here'
      });

    const ticketId = createResponse.body.id;

    await request(app)
      .post(`/tickets/${ticketId}/auto-classify`)
      .expect(200);

    const updateResponse = await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ category: 'feature_request', priority: 'low' })
      .expect(200);

    expect(updateResponse.body.category).toBe('feature_request');
    expect(updateResponse.body.priority).toBe('low');
  });

  test('Import → filter → delete workflow', async () => {
    const jsonPath = path.join(__dirname, 'fixtures', 'valid_tickets.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');

    const importResponse = await request(app)
      .post('/tickets/import')
      .set('Content-Type', 'application/json')
      .send(jsonData)
      .expect(200);

    expect(importResponse.body.successful).toBeGreaterThan(0);

    const allTickets = await request(app)
      .get('/tickets')
      .expect(200);

    expect(allTickets.body.count).toBeGreaterThan(0);

    const filterResponse = await request(app)
      .get('/tickets?category=account_access')
      .expect(200);

    const ticketId = filterResponse.body.tickets.length > 0
      ? filterResponse.body.tickets[0].id
      : allTickets.body.tickets[0].id;

    await request(app)
      .delete(`/tickets/${ticketId}`)
      .expect(200);

    await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(404);
  });
});
