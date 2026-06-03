const { importTickets } = require('../src/services/importService');
const { clearTickets, getTickets } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Import JSON', () => {
  const validJson = `[
    {
      "customer_email": "test@example.com",
      "subject": "Test Subj",
      "description": "Test description is here."
    }
  ]`;

  test('Successfully imports valid JSON', () => {
    const res = importTickets(Buffer.from(validJson), 'json');
    expect(res.total).toBe(1);
    expect(res.successful).toBe(1);
    expect(getTickets().length).toBe(1);
  });

  test('Handles single object instead of array', () => {
    const singleObj = `{
      "customer_email": "test2@example.com",
      "subject": "Test Subj 2",
      "description": "Test description is here 2."
    }`;
    const res = importTickets(Buffer.from(singleObj), 'json');
    expect(res.successful).toBe(1);
  });

  test('Fails on invalid JSON syntax', () => {
    const invalidJson = `[{ bad json`;
    const res = importTickets(Buffer.from(invalidJson), 'json');
    expect(res.errors[0]).toMatch(/Parse error/);
  });

  test('Fails on invalid ticket data in JSON', () => {
    const invalidDataJson = `[{"subject": "too short"}]`;
    const res = importTickets(Buffer.from(invalidDataJson), 'json');
    expect(res.failed).toBe(1);
    expect(res.errors[0]).toMatch(/Row error/);
  });

  test('Returns zero totals for empty array', () => {
    const res = importTickets(Buffer.from('[]'), 'json');
    expect(res.total).toBe(0);
    expect(res.successful).toBe(0);
  });
});
