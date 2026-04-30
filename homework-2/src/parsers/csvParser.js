const csv = require('csv-parser');
const { Readable } = require('stream');
const { validateTicket } = require('../validators/ticketValidator');
const Ticket = require('../models/ticket');

/**
 * Parses CSV file buffer and returns tickets with validation.
 * Handles RFC 4180 compliant CSV format with proper quote escaping.
 *
 * @param {Buffer} buffer - CSV file buffer
 * @returns {Promise<Object>} Object with {tickets: Array, errors: Array}
 */
const parseCSVFile = async (buffer) => {
  return new Promise((resolve) => {
    const tickets = [];
    const errors = [];
    let rowNumber = 0;

    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv())
      .on('data', (row) => {
        rowNumber++;

        try {
          if (row.tags && typeof row.tags === 'string') {
            row.tags = row.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
          }

          if (row.source || row.browser || row.device_type) {
            row.metadata = {
              source: row.source || 'api',
              browser: row.browser || '',
              device_type: row.device_type || ''
            };
            delete row.source;
            delete row.browser;
            delete row.device_type;
          }

          const validation = validateTicket(row);
          if (!validation.isValid) {
            errors.push({
              row: rowNumber,
              errors: validation.errors
            });
          } else {
            const ticket = new Ticket(row);
            tickets.push(ticket);
          }
        } catch (error) {
          errors.push({
            row: rowNumber,
            errors: [{ field: 'parse', message: error.message }]
          });
        }
      })
      .on('end', () => {
        resolve({ tickets, errors });
      })
      .on('error', (error) => {
        errors.push({
          row: 0,
          errors: [{ field: 'csv', message: `CSV parsing error: ${error.message}` }]
        });
        resolve({ tickets, errors });
      });
  });
};

module.exports = { parseCSVFile };
