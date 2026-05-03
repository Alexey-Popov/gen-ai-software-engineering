const xml2js = require('xml2js');
const { validateTicket } = require('../validators/ticketValidator');
const Ticket = require('../models/ticket');

/**
 * Parses XML file buffer and returns tickets with validation.
 * Handles <tickets><ticket>...</ticket></tickets> structure.
 * Performs type coercion from XML strings to proper types.
 *
 * @param {Buffer} buffer - XML file buffer
 * @returns {Promise<Object>} Object with {tickets: Array, errors: Array}
 */
const parseXMLFile = async (buffer) => {
  const tickets = [];
  const errors = [];

  try {
    const xmlString = buffer.toString();
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });

    const result = await parser.parseStringPromise(xmlString);

    let ticketData = [];

    if (result.tickets && result.tickets.ticket) {
      ticketData = Array.isArray(result.tickets.ticket)
        ? result.tickets.ticket
        : [result.tickets.ticket];
    }

    ticketData.forEach((item, index) => {
      try {
        const ticketObj = {
          customer_id: item.customer_id || '',
          customer_email: item.customer_email || '',
          customer_name: item.customer_name || '',
          subject: item.subject || '',
          description: item.description || '',
          category: item.category || 'other',
          priority: item.priority || 'medium',
          status: item.status || 'new'
        };

        if (item.tags) {
          if (typeof item.tags === 'string') {
            ticketObj.tags = [item.tags];
          } else if (item.tags.tag) {
            ticketObj.tags = Array.isArray(item.tags.tag)
              ? item.tags.tag
              : [item.tags.tag];
          }
        }

        if (item.metadata) {
          ticketObj.metadata = {
            source: item.metadata.source || 'api',
            browser: item.metadata.browser || '',
            device_type: item.metadata.device_type || ''
          };
        }

        if (item.assigned_to) ticketObj.assigned_to = item.assigned_to;
        if (item.resolved_at) ticketObj.resolved_at = item.resolved_at;

        const validation = validateTicket(ticketObj);
        if (!validation.isValid) {
          errors.push({
            row: index + 1,
            errors: validation.errors
          });
        } else {
          const ticket = new Ticket(ticketObj);
          tickets.push(ticket);
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          errors: [{ field: 'parse', message: error.message }]
        });
      }
    });

    return { tickets, errors };
  } catch (error) {
    errors.push({
      row: 0,
      errors: [{ field: 'xml', message: `XML parsing error: ${error.message}` }]
    });
    return { tickets, errors };
  }
};

module.exports = { parseXMLFile };
