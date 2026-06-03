const request = require('supertest');
const app = require('../src/app');
const { clearTickets } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Performance Tests', () => {
  test('Concurrent operations (20+ simultaneous requests)', async () => {
    const reqs = [];
    for (let i = 0; i < 25; i++) {
      reqs.push(request(app).post('/tickets').send({
        customer_email: `test${i}@example.com`,
        subject: `Test Subj ${i}`,
        description: `This is a test description ${i} with enough length.`
      }));
    }
    const results = await Promise.all(reqs);
    expect(results.every(r => r.status === 201)).toBe(true);

    const getRes = await request(app).get('/tickets');
    expect(getRes.body.length).toBe(25);
  });
  
  test('Fast classification', () => {
    const { classifyTicket } = require('../src/services/classificationService');
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      classifyTicket({ subject: 'bug login problem', description: 'crash everywhere' });
    }
    const end = performance.now();
    expect(end - start).toBeLessThan(1000);
  });

  test('Fast filtering', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).post('/tickets').send({
        customer_email: `test${i}@example.com`,
        subject: `Subj ${i}`,
        description: `Desc ${i} long enough`,
        category: i % 2 === 0 ? 'bug_report' : 'feature_request'
      });
    }
    const start = performance.now();
    const res = await request(app).get('/tickets?category=bug_report');
    const end = performance.now();
    expect(res.body.length).toBe(50);
    expect(end - start).toBeLessThan(150);
  });

  test('Import large JSON', async () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      customer_email: `test${i}@example.com`,
      subject: `Subj ${i}`,
      description: `Desc ${i} long enough`
    }));
    const start = performance.now();
    await request(app).post('/tickets/import').attach('file', Buffer.from(JSON.stringify(data)), 'test.json');
    const end = performance.now();
    expect(end - start).toBeLessThan(500);
  });

  test('Import large CSV', async () => {
    const csvLines = Array.from({ length: 100 }, (_, i) => `test${i}@example.com,Subj ${i},Desc ${i} long enough`);
    const csv = `customer_email,subject,description\n${csvLines.join('\n')}`;
    const start = performance.now();
    await request(app).post('/tickets/import').attach('file', Buffer.from(csv), 'test.csv');
    const end = performance.now();
    expect(end - start).toBeLessThan(500);
  });
});
