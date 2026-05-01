/**
 * Unit tests for helper utility functions
 */

const {
  detectFileFormat,
  validateEmail,
  sanitizeString,
  isValidDateRange
} = require('../src/utils/helpers');

describe('Helper Utilities', () => {
  describe('detectFileFormat', () => {
    test('should detect CSV from content-type header', () => {
      const buffer = Buffer.from('test');
      expect(detectFileFormat('text/csv', buffer)).toBe('csv');
      expect(detectFileFormat('application/csv', buffer)).toBe('csv');
    });

    test('should detect JSON from content-type header', () => {
      const buffer = Buffer.from('test');
      expect(detectFileFormat('application/json', buffer)).toBe('json');
    });

    test('should detect XML from content-type header', () => {
      const buffer = Buffer.from('test');
      expect(detectFileFormat('application/xml', buffer)).toBe('xml');
      expect(detectFileFormat('text/xml', buffer)).toBe('xml');
    });

    test('should detect XML from content starting with <?xml', () => {
      const buffer = Buffer.from('<?xml version="1.0"?><root></root>');
      expect(detectFileFormat(null, buffer)).toBe('xml');
    });

    test('should detect XML from content starting with <tickets', () => {
      const buffer = Buffer.from('<tickets><ticket></ticket></tickets>');
      expect(detectFileFormat(null, buffer)).toBe('xml');
    });

    test('should detect JSON from content starting with {', () => {
      const buffer = Buffer.from('{"key": "value"}');
      expect(detectFileFormat(null, buffer)).toBe('json');
    });

    test('should detect JSON from content starting with [', () => {
      const buffer = Buffer.from('[{"key": "value"}]');
      expect(detectFileFormat(null, buffer)).toBe('json');
    });

    test('should default to CSV for unknown format', () => {
      const buffer = Buffer.from('customer_id,email,name\n1,test@test.com,Test');
      expect(detectFileFormat(null, buffer)).toBe('csv');
    });

    test('should handle empty content-type', () => {
      const buffer = Buffer.from('some,csv,data');
      expect(detectFileFormat('', buffer)).toBe('csv');
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('first+last@test.org')).toBe(true);
      expect(validateEmail('123@numbers.com')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('missing@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
      expect(validateEmail('noatsign.com')).toBe(false);
      expect(validateEmail('spaces in@email.com')).toBe(false);
    });

    test('should reject empty or null email', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });

    test('should reject non-string email', () => {
      expect(validateEmail(123)).toBe(false);
      expect(validateEmail({})).toBe(false);
      expect(validateEmail([])).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    test('should trim whitespace from strings', () => {
      expect(sanitizeString('  hello world  ', 100)).toBe('hello world');
      expect(sanitizeString('\n\ttabbed\t\n', 100)).toBe('tabbed');
    });

    test('should limit string to maxLength', () => {
      expect(sanitizeString('this is a long string', 10)).toBe('this is a ');
      expect(sanitizeString('exactly10!', 10)).toBe('exactly10!');
      expect(sanitizeString('short', 100)).toBe('short');
    });

    test('should handle empty or null strings', () => {
      expect(sanitizeString('', 100)).toBe('');
      expect(sanitizeString(null, 100)).toBe('');
      expect(sanitizeString(undefined, 100)).toBe('');
    });

    test('should handle non-string input', () => {
      expect(sanitizeString(123, 100)).toBe('');
      expect(sanitizeString({}, 100)).toBe('');
      expect(sanitizeString([], 100)).toBe('');
    });

    test('should combine trimming and length limiting', () => {
      expect(sanitizeString('  too long string  ', 8)).toBe('too long');
    });
  });

  describe('isValidDateRange', () => {
    test('should validate correct date ranges', () => {
      expect(isValidDateRange('2024-01-01', '2024-12-31')).toBe(true);
      expect(isValidDateRange('2024-01-01', '2024-01-01')).toBe(true); // Same date
      expect(isValidDateRange('2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z')).toBe(true);
    });

    test('should reject invalid date ranges (from > to)', () => {
      expect(isValidDateRange('2024-12-31', '2024-01-01')).toBe(false);
      expect(isValidDateRange('2024-06-01', '2024-05-01')).toBe(false);
    });

    test('should reject invalid date formats', () => {
      expect(isValidDateRange('invalid-date', '2024-01-01')).toBe(false);
      expect(isValidDateRange('2024-01-01', 'not-a-date')).toBe(false);
      expect(isValidDateRange('abc', 'xyz')).toBe(false);
    });

    test('should return true when dates are missing', () => {
      expect(isValidDateRange(null, null)).toBe(true);
      expect(isValidDateRange(undefined, undefined)).toBe(true);
      expect(isValidDateRange('', '')).toBe(true);
    });

    test('should return true when only one date is provided', () => {
      expect(isValidDateRange('2024-01-01', null)).toBe(true);
      expect(isValidDateRange(null, '2024-01-01')).toBe(true);
      expect(isValidDateRange('2024-01-01', undefined)).toBe(true);
      expect(isValidDateRange(undefined, '2024-01-01')).toBe(true);
    });

    test('should handle various date formats', () => {
      expect(isValidDateRange('2024/01/01', '2024/12/31')).toBe(true);
      expect(isValidDateRange('01-01-2024', '12-31-2024')).toBe(true);
      expect(isValidDateRange('Jan 1, 2024', 'Dec 31, 2024')).toBe(true);
    });
  });
});
