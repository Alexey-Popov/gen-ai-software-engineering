import { XMLParser, XMLValidator } from 'fast-xml-parser';

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

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: false, // keep strings — don't coerce "123" → 123
  isArray: (name, jpath) => {
    if (jpath === 'tickets.ticket') return true;
    if (jpath === 'tickets.ticket.tags.tag') return true;
    return false;
  },
});

/**
 * Parse an XML buffer into an array of ticket payloads.
 *
 * Expected shape:
 *   <tickets>
 *     <ticket>
 *       <customer_email>...</customer_email>
 *       <subject>...</subject>
 *       <description>...</description>
 *       <tags><tag>urgent</tag><tag>security</tag></tags>
 *       <metadata>
 *         <source>web_form</source>
 *         <browser>Chrome</browser>
 *         <device_type>desktop</device_type>
 *       </metadata>
 *     </ticket>
 *   </tickets>
 *
 * @param {Buffer|string} input
 * @returns {object[]} ticket payloads (NOT validated)
 * @throws {Error} on malformed XML or unsupported shape (caller maps to 400)
 */
export function parseXmlTickets(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : String(input);

  const valid = XMLValidator.validate(text);
  if (valid !== true) {
    const msg = valid && valid.err ? valid.err.msg : 'invalid XML';
    throw new Error(`Malformed XML: ${msg}`);
  }

  let parsed;
  try {
    parsed = parser.parse(text);
  } catch (err) {
    throw new Error(`Malformed XML: ${err.message}`);
  }

  if (!parsed || !('tickets' in parsed)) {
    throw new Error(
      'Unsupported XML shape: expected <tickets><ticket>...</ticket></tickets>'
    );
  }

  const list = parsed.tickets && parsed.tickets.ticket;
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((row) => {
    const ticket = {};

    for (const field of TOP_LEVEL_FIELDS) {
      if (row[field]) ticket[field] = String(row[field]);
    }

    if (row.tags && Array.isArray(row.tags.tag)) {
      const tags = row.tags.tag.map((t) => String(t).trim()).filter(Boolean);
      if (tags.length > 0) ticket.tags = tags;
    }

    if (row.metadata && typeof row.metadata === 'object') {
      const metadata = {};
      for (const field of METADATA_FIELDS) {
        if (row.metadata[field]) metadata[field] = String(row.metadata[field]);
      }
      if (Object.keys(metadata).length > 0) ticket.metadata = metadata;
    }

    return ticket;
  });
}
