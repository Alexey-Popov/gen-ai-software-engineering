import { readFileSync } from 'fs';
import { join } from 'path';
import { importTickets } from '../src/services/import-service';
import { clearStore } from '../src/services/ticket-service';

const FIXTURES = join(__dirname, 'fixtures');

function makeXML(records: Record<string, unknown>[]): string {
  const items = records
    .map(r => {
      const fields = Object.entries(r)
        .map(([k, v]) => `    <${k}>${v}</${k}>`)
        .join('\n');
      return `  <ticket>\n${fields}\n  </ticket>`;
    })
    .join('\n');
  return `<?xml version="1.0"?>\n<tickets>\n${items}\n</tickets>`;
}

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
it('valid XML with nested <ticket> elements imports all records', () => {
  const xml = readFileSync(join(FIXTURES, 'valid-tickets.xml'), 'utf-8');
  const result = importTickets(xml, 'xml');
  expect(result.total).toBe(3);
  expect(result.successful).toBe(3);
  expect(result.failed).toBe(0);
});

// Test 2
it('XML with one invalid record reports error and continues', () => {
  const badRecord = { ...validRecord, customer_email: 'not-an-email' };
  const xml = makeXML([validRecord, badRecord]);
  const result = importTickets(xml, 'xml');
  expect(result.total).toBe(2);
  expect(result.successful).toBe(1);
  expect(result.failed).toBe(1);
});

// Test 3
it('malformed XML returns parse error', () => {
  const result = importTickets('<unclosed', 'xml');
  expect(result.failed).toBeGreaterThan(0);
  expect(result.errors[0].errors.parse).toBeDefined();
});

// Test 4
it('empty <tickets/> element returns zero successful and zero failed', () => {
  const result = importTickets('<tickets></tickets>', 'xml');
  expect(result.total).toBe(0);
  expect(result.successful).toBe(0);
  expect(result.failed).toBe(0);
});

// Test 5
it('XML without declaration is parsed correctly', () => {
  const xml = makeXML([validRecord]);
  const xmlNoDecl = xml.replace('<?xml version="1.0"?>\n', '');
  const result = importTickets(xmlNoDecl, 'xml');
  expect(result.total).toBe(1);
  expect(result.successful).toBe(1);
});
