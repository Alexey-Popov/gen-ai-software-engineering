import { readFileSync } from 'fs';
import { join } from 'path';
import { importTickets } from '../src/services/import-service';
import { clearStore } from '../src/services/ticket-service';

const FIXTURES = join(__dirname, 'fixtures');

const validRecord = {
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
it('valid JSON array imports all records successfully', () => {
  const json = readFileSync(join(FIXTURES, 'valid-tickets.json'), 'utf-8');
  const result = importTickets(json, 'json');
  expect(result.total).toBe(3);
  expect(result.successful).toBe(3);
  expect(result.failed).toBe(0);
});

// Test 2
it('single JSON object (not array) is normalized and imported', () => {
  const json = JSON.stringify(validRecord);
  const result = importTickets(json, 'json');
  expect(result.total).toBe(1);
  expect(result.successful).toBe(1);
  expect(result.failed).toBe(0);
});

// Test 3
it('JSON with one invalid record reports error for that record only', () => {
  const invalidRecord = { ...validRecord, priority: 'critical' };
  const json = JSON.stringify([validRecord, invalidRecord]);
  const result = importTickets(json, 'json');
  expect(result.total).toBe(2);
  expect(result.successful).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.errors[0].recordIndex).toBe(1);
});

// Test 4
it('malformed JSON string returns parse error', () => {
  const result = importTickets('{bad json', 'json');
  expect(result.failed).toBeGreaterThan(0);
  expect(result.errors[0].errors.parse).toBeDefined();
});

// Test 5
it('empty JSON array ([]) returns zero successful and zero failed', () => {
  const result = importTickets('[]', 'json');
  expect(result.total).toBe(0);
  expect(result.successful).toBe(0);
  expect(result.failed).toBe(0);
});
