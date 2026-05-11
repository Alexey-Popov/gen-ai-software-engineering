import { validateTicket } from '../validators/ticketValidator.js';
import ticketStore from '../store/ticketStore.js';

/**
 * Validate and persist an array of parsed ticket payloads.
 * Each row that passes validation is created in the store; each row that fails
 * is recorded under `failed` with its 1-based row number.
 *
 * @param {object[]} parsedRows  ticket payloads from a parser (CSV/JSON/XML)
 * @returns {{ total: number, successful: number, failed: { row: number, errors: string[] }[] }}
 */
export function importTickets(parsedRows) {
  const failed = [];
  let successful = 0;

  parsedRows.forEach((row, idx) => {
    const errors = validateTicket(row);
    if (errors.length > 0) {
      failed.push({ row: idx + 1, errors });
    } else {
      ticketStore.create(row);
      successful += 1;
    }
  });

  return {
    total: parsedRows.length,
    successful,
    failed,
  };
}
