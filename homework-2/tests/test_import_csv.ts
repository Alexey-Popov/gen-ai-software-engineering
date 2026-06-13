import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCSV } from '../src/utils/file-parser';
import { importTickets } from '../src/services/import-service';
import { clearStore } from '../src/services/ticket-service';

const FIXTURES = join(__dirname, 'fixtures');

beforeEach(() => {
  clearStore();
});

// Test 1
it('valid CSV with 10 rows imports all records successfully', () => {
  const csv = readFileSync(join(FIXTURES, 'valid-tickets.csv'), 'utf-8');
  const result = importTickets(csv, 'csv');
  expect(result.total).toBe(10);
  expect(result.successful).toBe(10);
  expect(result.failed).toBe(0);
  expect(result.errors).toHaveLength(0);
});

// Test 2
it('CSV with quoted fields containing commas is parsed correctly', () => {
  const csv = `name,value\n"Smith, John","hello, world"`;
  const rows = parseCSV(csv);
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe('Smith, John');
  expect(rows[0].value).toBe('hello, world');
});

// Test 3
it('CSV with only required columns succeeds (missing optional columns)', () => {
  const csv = [
    'customer_id,customer_email,customer_name,subject,description',
    'CUST001,test@example.com,Test User,Login issue,I cannot log in to my account today.',
  ].join('\n');
  const result = importTickets(csv, 'csv');
  expect(result.total).toBe(1);
  expect(result.successful).toBe(1);
  expect(result.failed).toBe(0);
});

// Test 4
it('CSV with invalid email in one row reports error and continues', () => {
  const csv = [
    'customer_id,customer_email,customer_name,subject,description,category,priority,status',
    'CUST001,valid@example.com,Alice,Cannot log in,I cannot access my account at all.,account_access,high,new',
    'CUST002,not-an-email,Bob,Invoice issue,My latest invoice shows the wrong amount charged.,billing_question,medium,new',
  ].join('\n');
  const result = importTickets(csv, 'csv');
  expect(result.total).toBe(2);
  expect(result.successful).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.errors[0].recordIndex).toBe(1);
});

// Test 5
it('empty CSV file returns zero successful and zero failed', () => {
  const result = importTickets('', 'csv');
  expect(result.total).toBe(0);
  expect(result.successful).toBe(0);
  expect(result.failed).toBe(0);
});

// Test 6
it('malformed CSV with unclosed quote returns a parse error', () => {
  const result = importTickets('"unclosed', 'csv');
  expect(result.failed).toBeGreaterThan(0);
  expect(result.errors[0].errors.parse).toBeDefined();
});
