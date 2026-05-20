import { importTickets } from '../../src/services/import-service';
import { clearStore, getAllTickets } from '../../src/services/ticket-service';
import { Category, Priority, Status } from '../../src/models/ticket';

const validRecord = {
  customer_id: 'cust-001',
  customer_email: 'john@example.com',
  customer_name: 'John Doe',
  subject: 'Cannot access account',
  description: 'I have been unable to log into my account for two days.',
  category: Category.AccountAccess,
  priority: Priority.High,
  status: Status.New,
};

function makeCSV(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]).join(',');
  const rows = records.map(r => Object.values(r).join(','));
  return [headers, ...rows].join('\n');
}

beforeEach(() => {
  clearStore();
});

// ─── CSV ───────────────────────────────────────────────────────────────────

describe('importTickets — CSV', () => {
  it('imports all valid CSV records and returns correct counts', () => {
    const csv = makeCSV([validRecord, validRecord]);
    const result = importTickets(csv, 'csv');
    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('stores created tickets in the service', () => {
    importTickets(makeCSV([validRecord]), 'csv');
    expect(getAllTickets()).toHaveLength(1);
  });

  it('handles mixed valid and invalid CSV records', () => {
    const invalidRecord = { ...validRecord, customer_email: 'bad-email' };
    const csv = makeCSV([validRecord, invalidRecord]);
    const result = importTickets(csv, 'csv');
    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].recordIndex).toBe(1);
  });

  it('returns zero counts for empty CSV', () => {
    const result = importTickets('', 'csv');
    expect(result.total).toBe(0);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('reports a parse error for malformed CSV', () => {
    const result = importTickets('"unclosed', 'csv');
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors[0].errors.parse).toBeDefined();
  });
});

// ─── JSON ──────────────────────────────────────────────────────────────────

describe('importTickets — JSON', () => {
  it('imports all valid JSON records', () => {
    const json = JSON.stringify([validRecord, validRecord]);
    const result = importTickets(json, 'json');
    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('imports a single JSON object wrapped in array', () => {
    const json = JSON.stringify(validRecord);
    const result = importTickets(json, 'json');
    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
  });

  it('handles mixed valid and invalid JSON records', () => {
    const invalidRecord = { ...validRecord, priority: 'critical' };
    const json = JSON.stringify([validRecord, invalidRecord]);
    const result = importTickets(json, 'json');
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('returns zero counts for empty JSON', () => {
    const result = importTickets('', 'json');
    expect(result.total).toBe(0);
  });

  it('reports a parse error for malformed JSON', () => {
    const result = importTickets('{bad json', 'json');
    expect(result.errors[0].errors.parse).toBeDefined();
  });
});

// ─── XML ───────────────────────────────────────────────────────────────────

describe('importTickets — XML', () => {
  function makeXML(records: Record<string, unknown>[]): string {
    const items = records.map(r => {
      const fields = Object.entries(r).map(([k, v]) => `    <${k}>${v}</${k}>`).join('\n');
      return `  <ticket>\n${fields}\n  </ticket>`;
    }).join('\n');
    return `<?xml version="1.0"?>\n<tickets>\n${items}\n</tickets>`;
  }

  it('imports all valid XML records', () => {
    const xml = makeXML([validRecord]);
    const result = importTickets(xml, 'xml');
    expect(result.total).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('handles mixed valid and invalid XML records', () => {
    const badRecord = { ...validRecord, customer_email: 'not-an-email' };
    const xml = makeXML([validRecord, badRecord]);
    const result = importTickets(xml, 'xml');
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('returns zero counts for empty XML', () => {
    const result = importTickets('', 'xml');
    expect(result.total).toBe(0);
  });

  it('reports a parse error for malformed XML', () => {
    const result = importTickets('<unclosed', 'xml');
    expect(result.errors[0].errors.parse).toBeDefined();
  });
});

// ─── Unsupported format ────────────────────────────────────────────────────

describe('importTickets — unsupported format', () => {
  it('returns a format error for an unrecognised format', () => {
    const result = importTickets('data', 'txt' as 'csv');
    expect(result.failed).toBe(1);
    expect(result.errors[0].errors.format).toBeDefined();
  });
});
