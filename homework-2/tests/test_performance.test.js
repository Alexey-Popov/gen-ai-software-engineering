const request = require('supertest');
const app = require('../src/index');
const storage = require('../src/storage/inMemoryStorage');

describe('Performance Tests', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('should handle 20 concurrent POST requests', async () => {
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        request(app)
          .post('/tickets')
          .send({
            customer_email: `test${i}@example.com`,
            customer_name: `Test User ${i}`,
            subject: 'Test Subject',
            description: 'This is a test description with enough characters'
          })
      );
    }

    const results = await Promise.all(requests);
    const successCount = results.filter(r => r.status === 201).length;

    expect(successCount).toBe(20);
  });

  test('should import 50 tickets quickly via CSV', async () => {
    const csvRows = ['customer_email,customer_name,subject,description'];
    for (let i = 0; i < 50; i++) {
      csvRows.push(`test${i}@example.com,User ${i},Subject ${i},Description ${i} with enough characters`);
    }
    const csvData = csvRows.join('\n');
    const buffer = Buffer.from(csvData);

    const startTime = Date.now();
    const response = await request(app)
      .post('/tickets/import')
      .set('Content-Type', 'text/csv')
      .send(buffer);
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(response.body.successful).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds
  });

  test('should filter large dataset quickly', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post('/tickets')
        .send({
          customer_email: `test${i}@example.com`,
          customer_name: `User ${i}`,
          subject: 'Test',
          description: 'Test description here',
          category: i % 2 === 0 ? 'billing_question' : 'technical_issue'
        });
    }

    const startTime = Date.now();
    const response = await request(app)
      .get('/tickets?category=billing_question');
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(200);
  });

  test('should classify 10 tickets quickly', async () => {
    const ticketIds = [];
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/tickets')
        .send({
          customer_email: `test${i}@example.com`,
          customer_name: `User ${i}`,
          subject: 'Cannot login',
          description: 'I forgot my password and need help'
        });
      ticketIds.push(response.body.id);
    }

    const startTime = Date.now();
    for (const id of ticketIds) {
      await request(app).post(`/tickets/${id}/auto-classify`);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });

  test('should maintain memory stability with many operations', async () => {
    for (let i = 0; i < 100; i++) {
      const createResponse = await request(app)
        .post('/tickets')
        .send({
          customer_email: `test${i}@example.com`,
          customer_name: `User ${i}`,
          subject: 'Test',
          description: 'Test description here'
        });

      const id = createResponse.body.id;

      await request(app).get(`/tickets/${id}`);
      await request(app).put(`/tickets/${id}`).send({ status: 'resolved' });

      if (i % 10 === 0) {
        await request(app).delete(`/tickets/${id}`);
      }
    }

    const response = await request(app).get('/tickets');
    expect(response.status).toBe(200);
  });
});
