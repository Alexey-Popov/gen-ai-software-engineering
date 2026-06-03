const { importTickets } = require('../src/services/importService');
const { clearTickets, getTickets } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Import CSV', () => {
  const validCsv = `customer_email,subject,description
test@example.com,Test Subj,Test description is here.`;

  test('Successfully imports valid CSV', () => {
    const res = importTickets(Buffer.from(validCsv), 'csv');
    expect(res.total).toBe(1);
    expect(res.successful).toBe(1);
    expect(getTickets().length).toBe(1);
  });

  test('Fails on invalid ticket data in CSV', () => {
    const invalidCsv = `customer_email,subject,description\n,short,no`;
    const res = importTickets(Buffer.from(invalidCsv), 'csv');
    expect(res.failed).toBe(1);
  });

  test('Fails on malformed CSV', () => {
    const res = importTickets(Buffer.from('a,b,c\n"unterminated string'), 'csv');
    expect(res.errors.length).toBeGreaterThan(0);
  });
  
  test('Empty CSV', () => {
    const res = importTickets(Buffer.from('customer_email,subject,description\n'), 'csv');
    expect(res.total).toBe(0);
  });

  test('Multiple rows', () => {
    const csv = `customer_email,subject,description\ntest1@a.com,Subj 1,Description 1 long\ntest2@a.com,Subj 2,Description 2 long`;
    const res = importTickets(Buffer.from(csv), 'csv');
    expect(res.successful).toBe(2);
  });
  
  test('Mixed valid/invalid rows', () => {
    const csv = `customer_email,subject,description\ntest1@a.com,Subj 1,Description 1 long\n,invalid,row`;
    const res = importTickets(Buffer.from(csv), 'csv');
    expect(res.successful).toBe(1);
    expect(res.failed).toBe(1);
  });
});
