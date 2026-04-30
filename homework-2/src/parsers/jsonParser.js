const { validateTicket } = require('../validators/ticketValidator');
const Ticket = require('../models/ticket');

/**
 * Parses JSON file buffer and returns tickets with validation.
 * Handles both single ticket object and array of tickets.
 *
 * @param {Buffer} buffer - JSON file buffer
 * @returns {Promise<Object>} Object with {tickets: Array, errors: Array}
 */
const parseJSONFile = async (buffer) => {
  const tickets = [];
  const errors = [];

  try {
    const jsonString = buffer.toString();
    let data = JSON.parse(jsonString);

    if (!Array.isArray(data)) {
      data = [data];
    }

    data.forEach((item, index) => {
      const validation = validateTicket(item);
      if (!validation.isValid) {
        errors.push({
          row: index + 1,
          errors: validation.errors
        });
      } else {
        const ticket = new Ticket(item);
        tickets.push(ticket);
      }
    });

    return { tickets, errors };
  } catch (error) {
    errors.push({
      row: 0,
      errors: [{ field: 'json', message: `JSON parsing error: ${error.message}` }]
    });
    return { tickets, errors };
  }
};

module.exports = { parseJSONFile };
