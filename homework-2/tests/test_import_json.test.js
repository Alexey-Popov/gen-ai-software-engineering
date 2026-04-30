const { parseJSONFile } = require('../src/parsers/jsonParser');
const fs = require('fs');
const path = require('path');

describe('JSON Parser', () => {
  test('should parse valid JSON array', async () => {
    const jsonPath = path.join(__dirname, 'fixtures', 'valid_tickets.json');
    const buffer = fs.readFileSync(jsonPath);

    const result = await parseJSONFile(buffer);

    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.tickets[0]).toHaveProperty('customer_email');
  });

  test('should handle single JSON object', async () => {
    const jsonData = {
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      subject: 'Test Subject',
      description: 'This is a test description'
    };
    const buffer = Buffer.from(JSON.stringify(jsonData));

    const result = await parseJSONFile(buffer);

    expect(result.tickets.length).toBeLessThanOrEqual(1);
  });

  test('should handle invalid JSON syntax', async () => {
    const jsonPath = path.join(__dirname, 'fixtures', 'invalid_tickets.json');
    const buffer = fs.readFileSync(jsonPath);

    const result = await parseJSONFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].errors[0].field).toBe('json');
  });

  test('should handle JSON with validation errors', async () => {
    const jsonData = [{
      customer_email: 'invalid-email',
      customer_name: 'Test',
      subject: 'Short',
      description: 'Too short'
    }];
    const buffer = Buffer.from(JSON.stringify(jsonData));

    const result = await parseJSONFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should handle empty JSON array', async () => {
    const buffer = Buffer.from(JSON.stringify([]));

    const result = await parseJSONFile(buffer);

    expect(result.tickets.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });
});
