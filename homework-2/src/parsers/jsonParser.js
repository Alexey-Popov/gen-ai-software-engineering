/**
 * Parse a JSON buffer into an array of ticket payloads.
 *
 * Accepts two shapes:
 *   - top-level array:    [{...}, {...}]
 *   - wrapper object:     { "tickets": [{...}, {...}] }
 *
 * The parser does NOT validate ticket fields — that's the importService's job.
 *
 * @param {Buffer|string} input
 * @returns {object[]} ticket payloads (NOT validated)
 * @throws {Error} on malformed JSON or unsupported shape (caller maps to 400)
 */
export function parseJsonTickets(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : String(input);

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Malformed JSON: ${err.message}`);
  }

  if (Array.isArray(data)) return data;

  if (data && typeof data === 'object' && Array.isArray(data.tickets)) {
    return data.tickets;
  }

  throw new Error(
    'Unsupported JSON shape: expected an array of tickets or { "tickets": [...] }'
  );
}
