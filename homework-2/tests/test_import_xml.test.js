const { parseXMLFile } = require('../src/parsers/xmlParser');
const fs = require('fs');
const path = require('path');

describe('XML Parser', () => {
  test('should parse valid XML with nested tickets', async () => {
    const xmlPath = path.join(__dirname, 'fixtures', 'valid_tickets.xml');
    const buffer = fs.readFileSync(xmlPath);

    const result = await parseXMLFile(buffer);

    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.tickets[0]).toHaveProperty('customer_email');
  });

  test('should handle XML with missing required fields', async () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>test@example.com</customer_email>
    <subject>Missing description</subject>
  </ticket>
</tickets>`;
    const buffer = Buffer.from(xmlData);

    const result = await parseXMLFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should handle malformed XML', async () => {
    const xmlPath = path.join(__dirname, 'fixtures', 'invalid_tickets.xml');
    const buffer = fs.readFileSync(xmlPath);

    const result = await parseXMLFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].errors[0].field).toBe('xml');
  });

  test('should handle XML type conversion for tags', async () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_email>test@example.com</customer_email>
    <customer_name>Test User</customer_name>
    <subject>Test Subject</subject>
    <description>This is a test description with enough characters</description>
    <tags>
      <tag>tag1</tag>
      <tag>tag2</tag>
    </tags>
  </ticket>
</tickets>`;
    const buffer = Buffer.from(xmlData);

    const result = await parseXMLFile(buffer);

    expect(result.tickets.length).toBeGreaterThan(0);
    if (result.tickets.length > 0) {
      expect(Array.isArray(result.tickets[0].tags)).toBe(true);
    }
  });

  test('should handle empty XML', async () => {
    const xmlData = '<?xml version="1.0" encoding="UTF-8"?><tickets></tickets>';
    const buffer = Buffer.from(xmlData);

    const result = await parseXMLFile(buffer);

    expect(result.tickets.length).toBe(0);
  });
});
