/**
 * Detects file format from Content-Type header or file content.
 * @param {string} contentType - Content-Type header value
 * @param {Buffer} buffer - File buffer for content inspection
 * @returns {string} Format: 'csv', 'json', or 'xml'
 */
const detectFileFormat = (contentType, buffer) => {
  if (contentType) {
    if (contentType.includes('csv')) return 'csv';
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('xml')) return 'xml';
  }

  const content = buffer.toString().trim();

  if (content.startsWith('<?xml') || content.startsWith('<tickets')) {
    return 'xml';
  }

  if (content.startsWith('{') || content.startsWith('[')) {
    return 'json';
  }

  return 'csv';
};

/**
 * Validates email format.
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitizes string by trimming and limiting length.
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
const sanitizeString = (str, maxLength) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
};

/**
 * Validates date range.
 * @param {string} from - Start date
 * @param {string} to - End date
 * @returns {boolean} True if valid range
 */
const isValidDateRange = (from, to) => {
  if (!from || !to) return true;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return false;
  return fromDate <= toDate;
};

module.exports = {
  detectFileFormat,
  validateEmail,
  sanitizeString,
  isValidDateRange
};
