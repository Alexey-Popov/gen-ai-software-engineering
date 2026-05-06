const request = require('supertest');
const app = require('../src/app');
const { clearTickets } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Integration Tests', () => {
  test('Complete ticket lifecycle workflow', async () => {
    // Create
    let res = await request(app).post('/tickets?autoClassify=true').send({
      customer_email: 'test@example.com',
      subject: 'Critical login bug',
      description: 'The system crashes and I cannot access my account.'
    });
    expect(res.status).toBe(201);
    const id = res.body.id;
    expect(res.body.category).toBe('account_access');
    expect(res.body.priority).toBe('urgent');

    // Read
    res = await request(app).get(`/tickets/${id}`);
    expect(res.body.status).toBe('new');

    // Update
    res = await request(app).put(`/tickets/${id}`).send({ status: 'in_progress' });
    expect(res.body.status).toBe('in_progress');

    // Delete
    res = await request(app).delete(`/tickets/${id}`);
    expect(res.status).toBe(204);

    // Verify deleted
    res = await request(app).get(`/tickets/${id}`);
    expect(res.status).toBe(404);
  });

  test('Bulk import with auto-classification endpoint', async () => {
    const csv = `customer_email,subject,description\ntest@example.com,bug problem,Description for bug\ntest2@example.com,refund please,Description for billing`;
    
    // Import
    let res = await request(app).post('/tickets/import').attach('file', Buffer.from(csv), 'test.csv');
    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(2);

    // Get all tickets
    res = await request(app).get('/tickets');
    expect(res.body.length).toBe(2);

    // Auto classify first one
    const id = res.body[0].id;
    res = await request(app).post(`/tickets/${id}/auto-classify`);
    expect(res.body.category).toBe('bug_report');
  });

  test('Combined filtering by category and priority', async () => {
    await request(app).post('/tickets').send({ customer_email: 'a@a.com', subject: 's', description: 'dddddddddd', category: 'bug_report', priority: 'high' });
    await request(app).post('/tickets').send({ customer_email: 'b@b.com', subject: 's', description: 'dddddddddd', category: 'bug_report', priority: 'low' });
    
    const res = await request(app).get('/tickets?category=bug_report&priority=high');
    expect(res.body.length).toBe(1);
    expect(res.body[0].priority).toBe('high');
  });

  test('Error on invalid import format', async () => {
    const res = await request(app).post('/tickets/import').attach('file', Buffer.from('data'), 'test.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid file format');
  });

  test('Error on missing import file', async () => {
    const res = await request(app).post('/tickets/import');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file provided');
  });
});
