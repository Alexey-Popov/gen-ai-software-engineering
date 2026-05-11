import { parse } from 'csv-parse/sync';

const TOP_LEVEL_FIELDS = [
  'customer_id',
  'customer_email',
  'customer_name',
  'subject',
  'description',
  'category',
  'priority',
  'status',
  'assigned_to',
];

const METADATA_FIELDS = ['source', 'browser', 'device_type'];

/**
 * Parse a CSV buffer into an array of ticket objects.
 *
 * Expected columns: customer_id, customer_email, customer_name, subject,
 * description, category, priority, status, assigned_to, tags,
 * metadata.source, metadata.browser, metadata.device_type
 *
 * - `tags` is split on `;` (e.g. "urgent;security" → ["urgent", "security"])
 * - `metadata.*` columns are nested into a `metadata` sub-object
 * - empty cells are dropped (so partial rows don't get empty strings)
 *
 * @param {Buffer|string} input
 * @returns {object[]} parsed ticket payloads (NOT validated)
 * @throws {Error} on malformed CSV (caller should map to 400)
 */
export function parseCsvTickets(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : String(input);

  let rows;
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (err) {
    throw new Error(`Malformed CSV: ${err.message}`);
  }

  return rows.map((row) => {
    const ticket = {};

    for (const field of TOP_LEVEL_FIELDS) {
      if (row[field]) ticket[field] = row[field];
    }

    if (row.tags) {
      ticket.tags = row.tags
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const metadata = {};
    for (const field of METADATA_FIELDS) {
      const cell = row[`metadata.${field}`];
      if (cell) metadata[field] = cell;
    }
    if (Object.keys(metadata).length > 0) {
      ticket.metadata = metadata;
    }

    return ticket;
  });
}
