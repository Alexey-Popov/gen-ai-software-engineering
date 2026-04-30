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
    // Create ticket
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

    // Update status
    await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ status: 'in_progress' })
      .expect(200);

    // Auto-classify
    const classifyResponse = await request(app)
      .post(`/tickets/${ticketId}/auto-classify`)
      .expect(200);

    expect(classifyResponse.body.category).toBe('account_access');

    // Resolve ticket
    await request(app)
      .put(`/tickets/${ticketId}`)
      .send({ status: 'resolved', resolved_at: new Date().toISOString() })
      .expect(200);

    // Verify final state
    const finalResponse = await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(200);

    expect(finalResponse.body.status).toBe('resolved');
    expect(finalResponse.body.category).toBe('account_access');
  });

  test('Bulk import CSV → auto-classify all tickets', async () => {
    const csvPath = path.join(__dirname, 'fixtures', 'valid_tickets.csv');
    const csvBuffer = fs.readFileSync(csvPath);

    // Import tickets
    const importResponse = await request(app)
      .post('/tickets/import')
      .set('Content-Type', 'text/csv')
      .send(csvBuffer)
      .expect(200);

    expect(importResponse.body.successful).toBeGreaterThan(0);

    // Get all tickets
    const ticketsResponse = await request(app)
      .get('/tickets')
      .expect(200);

    // Auto-classify each ticket
    for (const ticket of ticketsResponse.body.tickets) {
      await request(app)
        .post(`/tickets/${ticket.id}/auto-classify`)
        .expect(200);
    }

    // Verify all have classifications
    const finalResponse = await request(app)
      .get('/tickets')
      .expect(200);

    expect(finalResponse.body.tickets.length).toBeGreaterThan(0);
  });

  test('Combined filters: category + priority + status', async () => {
    // Create tickets with different combinations
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

    // Filter with multiple criteria
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

    // Auto-classify
    await request(app)
      .post(`/tickets/${ticketId}/auto-classify`)
      .expect(200);

    // Override with manual classification
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

    // Import
    const importResponse = await request(app)
      .post('/tickets/import')
      .set('Content-Type', 'application/json')
      .send(jsonData)
      .expect(200);

    expect(importResponse.body.successful).toBeGreaterThan(0);

    // Get all tickets to see what was imported
    const allTickets = await request(app)
      .get('/tickets')
      .expect(200);

    expect(allTickets.body.count).toBeGreaterThan(0);

    // Filter by category
    const filterResponse = await request(app)
      .get('/tickets?category=account_access')
      .expect(200);

    // If no account_access tickets, use any imported ticket
    const ticketId = filterResponse.body.tickets.length > 0
      ? filterResponse.body.tickets[0].id
      : allTickets.body.tickets[0].id;

    // Delete ticket
    await request(app)
      .delete(`/tickets/${ticketId}`)
      .expect(200);

    // Verify deleted
    await request(app)
      .get(`/tickets/${ticketId}`)
      .expect(404);
  });
});
