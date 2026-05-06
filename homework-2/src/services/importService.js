const { parse } = require('csv-parse/sync');
const { XMLParser } = require('fast-xml-parser');
const { createTicket } = require('../models/ticket');

function importTickets(buffer, format) {
  const result = { total: 0, successful: 0, failed: 0, errors: [] };
  let parsedData = [];

  try {
    if (format === 'json') {
      parsedData = JSON.parse(buffer.toString());
      if (!Array.isArray(parsedData)) parsedData = [parsedData];
    } else if (format === 'csv') {
      parsedData = parse(buffer.toString(), { columns: true, skip_empty_lines: true });
    } else if (format === 'xml') {
      const parser = new XMLParser({ ignoreAttributes: false });
      const xmlDoc = parser.parse(buffer.toString());
      const ticketsObj = xmlDoc.tickets?.ticket;
      parsedData = Array.isArray(ticketsObj) ? ticketsObj : (ticketsObj ? [ticketsObj] : []);
    } else {
      throw new Error("Unsupported format");
    }
  } catch (err) {
    result.errors.push(`Parse error: ${err.message}`);
    return result;
  }

  result.total = parsedData.length;

  for (const item of parsedData) {
    try {
      createTicket(item);
      result.successful++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Row error: ${err.message}`);
    }
  }

  return result;
}

module.exports = { importTickets };
