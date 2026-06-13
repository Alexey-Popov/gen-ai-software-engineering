import { parse as parseCSVSync } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function parseCSV(content: string): Record<string, unknown>[] {
  if (!content || !content.trim()) {
    return [];
  }
  try {
    const records = parseCSVSync(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as Record<string, unknown>[];
    return records;
  } catch (err) {
    throw new ParseError(`Failed to parse CSV: ${(err as Error).message}`);
  }
}

export function parseJSON(content: string): Record<string, unknown>[] {
  if (!content || !content.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new ParseError(`Failed to parse JSON: ${(err as Error).message}`);
  }

  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return [parsed as Record<string, unknown>];
  }
  throw new ParseError('JSON content must be an object or an array of objects');
}

export function parseXML(content: string): Record<string, unknown>[] {
  if (!content || !content.trim()) {
    return [];
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new ParseError(`Failed to parse XML: ${(err as Error).message}`);
  }

  // Remove XML declaration key if present
  const rootKeys = Object.keys(parsed).filter(k => k !== '?xml');
  if (rootKeys.length === 0) {
    return [];
  }

  const root = parsed[rootKeys[0]];

  // Root is an object with one child array (e.g. <tickets><ticket>...</ticket></tickets>)
  if (typeof root === 'object' && root !== null && !Array.isArray(root)) {
    const childKeys = Object.keys(root as Record<string, unknown>);
    if (childKeys.length === 1) {
      const child = (root as Record<string, unknown>)[childKeys[0]];
      if (Array.isArray(child)) {
        return child as Record<string, unknown>[];
      }
      if (typeof child === 'object' && child !== null) {
        return [child as Record<string, unknown>];
      }
    }
    // Flat root object — treat the root itself as a single record
    return [root as Record<string, unknown>];
  }

  if (Array.isArray(root)) {
    return root as Record<string, unknown>[];
  }

  return [];
}
