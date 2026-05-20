import { parseCSV, parseJSON, parseXML, ParseError } from '../../src/utils/file-parser';

// ─── CSV ───────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  const validCSV = `customer_id,customer_email,subject
cust-1,a@b.com,Test subject
cust-2,c@d.com,Another subject`;

  it('parses a well-formed CSV into an array of objects', () => {
    const result = parseCSV(validCSV);
    expect(result).toHaveLength(2);
    expect(result[0].customer_id).toBe('cust-1');
    expect(result[0].customer_email).toBe('a@b.com');
  });

  it('uses header row as object keys', () => {
    const result = parseCSV(validCSV);
    expect(Object.keys(result[0])).toEqual(['customer_id', 'customer_email', 'subject']);
  });

  it('handles quoted fields containing commas', () => {
    const csv = `name,value\n"Smith, John","hello, world"`;
    const result = parseCSV(csv);
    expect(result[0].name).toBe('Smith, John');
    expect(result[0].value).toBe('hello, world');
  });

  it('skips empty lines', () => {
    const csv = `a,b\n1,2\n\n3,4`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
  });

  it('trims whitespace from values', () => {
    const csv = `key,value\n  hello  ,  world  `;
    const result = parseCSV(csv);
    expect(result[0].key).toBe('hello');
    expect(result[0].value).toBe('world');
  });

  it('returns an empty array for empty content', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('   ')).toEqual([]);
  });

  it('returns an empty array for header-only CSV', () => {
    const result = parseCSV('col1,col2,col3');
    expect(result).toHaveLength(0);
  });

  it('throws ParseError for malformed CSV', () => {
    // Mismatched quotes that csv-parse cannot recover from
    expect(() => parseCSV('a,b\n"unclosed')).toThrow(ParseError);
  });

  it('handles unicode characters', () => {
    const csv = `name,value\nÄnna,日本語`;
    const result = parseCSV(csv);
    expect(result[0].name).toBe('Änna');
    expect(result[0].value).toBe('日本語');
  });
});

// ─── JSON ──────────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('parses a JSON array of objects', () => {
    const json = JSON.stringify([{ id: '1' }, { id: '2' }]);
    const result = parseJSON(json);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
  });

  it('wraps a single JSON object in an array', () => {
    const json = JSON.stringify({ id: '1', name: 'test' });
    const result = parseJSON(json);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test');
  });

  it('returns an empty array for empty content', () => {
    expect(parseJSON('')).toEqual([]);
    expect(parseJSON('   ')).toEqual([]);
  });

  it('throws ParseError for malformed JSON', () => {
    expect(() => parseJSON('{invalid json')).toThrow(ParseError);
  });

  it('throws ParseError for a JSON primitive (not object/array)', () => {
    expect(() => parseJSON('"just a string"')).toThrow(ParseError);
    expect(() => parseJSON('42')).toThrow(ParseError);
  });

  it('handles nested objects in the array', () => {
    const json = JSON.stringify([{ id: '1', meta: { source: 'web' } }]);
    const result = parseJSON(json);
    expect((result[0].meta as Record<string, unknown>).source).toBe('web');
  });

  it('handles unicode characters', () => {
    const json = JSON.stringify([{ name: '日本語', value: 'Ünïcödé' }]);
    const result = parseJSON(json);
    expect(result[0].name).toBe('日本語');
  });
});

// ─── XML ───────────────────────────────────────────────────────────────────

describe('parseXML', () => {
  const validXML = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-1</customer_id>
    <customer_email>a@b.com</customer_email>
    <subject>Test subject</subject>
  </ticket>
  <ticket>
    <customer_id>cust-2</customer_id>
    <customer_email>c@d.com</customer_email>
    <subject>Another</subject>
  </ticket>
</tickets>`;

  it('parses a standard nested XML structure into an array', () => {
    const result = parseXML(validXML);
    expect(result).toHaveLength(2);
    expect(result[0].customer_id).toBe('cust-1');
    expect(result[1].customer_email).toBe('c@d.com');
  });

  it('returns a single-element array for XML with one child', () => {
    const xml = `<tickets><ticket><id>1</id></ticket></tickets>`;
    const result = parseXML(xml);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns an empty array for empty content', () => {
    expect(parseXML('')).toEqual([]);
    expect(parseXML('   ')).toEqual([]);
  });

  it('returns an empty array for XML with no child elements', () => {
    const xml = `<tickets></tickets>`;
    const result = parseXML(xml);
    expect(result).toHaveLength(0);
  });

  it('throws ParseError for malformed XML', () => {
    expect(() => parseXML('<unclosed')).toThrow(ParseError);
  });

  it('handles XML without declaration', () => {
    const xml = `<tickets><ticket><id>42</id></ticket></tickets>`;
    const result = parseXML(xml);
    expect(result[0].id).toBe(42);
  });
});
