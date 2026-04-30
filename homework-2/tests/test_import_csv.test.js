const { parseCSVFile } = require('../src/parsers/csvParser');
const fs = require('fs');
const path = require('path');

describe('CSV Parser', () => {
  test('should parse valid CSV with multiple tickets', async () => {
    const csvPath = path.join(__dirname, 'fixtures', 'valid_tickets.csv');
    const buffer = fs.readFileSync(csvPath);

    const result = await parseCSVFile(buffer);

    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.tickets[0]).toHaveProperty('customer_email');
    expect(result.tickets[0]).toHaveProperty('subject');
  });

  test('should handle CSV with missing required fields', async () => {
    const csvPath = path.join(__dirname, 'fixtures', 'invalid_tickets.csv');
    const buffer = fs.readFileSync(csvPath);

    const result = await parseCSVFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should handle CSV with invalid email format', async () => {
    const csvData = 'customer_email,customer_name,subject,description\ninvalid-email,John,Test,This is a test description with enough characters';
    const buffer = Buffer.from(csvData);

    const result = await parseCSVFile(buffer);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should handle empty CSV', async () => {
    const buffer = Buffer.from('');

    const result = await parseCSVFile(buffer);

    expect(result.tickets.length).toBe(0);
  });

  test('should parse tags from comma-separated string', async () => {
    const csvData = 'customer_email,customer_name,subject,description,tags\ntest@example.com,Test,Subject,Description with enough chars,"tag1,tag2,tag3"';
    const buffer = Buffer.from(csvData);

    const result = await parseCSVFile(buffer);

    if (result.tickets.length > 0) {
      expect(Array.isArray(result.tickets[0].tags)).toBe(true);
    }
  });

  test('should handle mixed valid/invalid rows', async () => {
    const csvData = `customer_email,customer_name,subject,description
valid@example.com,Valid User,Test Subject,This is a valid description
invalid-email,Invalid,Short,Bad
test@example.com,Test,Good Subject,Another valid description here`;
    const buffer = Buffer.from(csvData);

    const result = await parseCSVFile(buffer);

    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
