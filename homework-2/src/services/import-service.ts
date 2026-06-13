import { ImportResult } from '../models/ticket';
import { parseCSV, parseJSON, parseXML, ParseError } from '../utils/file-parser';
import { validateCSVStructure, validateJSONStructure, validateXMLStructure } from '../validators/import-validator';
import { createTicket } from './ticket-service';
import { ValidationError } from '../validators/ticket-validator';

export type ImportFormat = 'csv' | 'json' | 'xml';

export function importTickets(fileContent: string, format: ImportFormat): ImportResult {
  let records: Record<string, unknown>[];

  try {
    if (format === 'csv') {
      records = parseCSV(fileContent);
    } else if (format === 'json') {
      records = parseJSON(fileContent);
    } else if (format === 'xml') {
      records = parseXML(fileContent);
    } else {
      return {
        total: 0,
        successful: 0,
        failed: 1,
        errors: [{ recordIndex: -1, errors: { format: `Unsupported format: ${format}` } }],
        created_ids: [],
      };
    }
  } catch (err) {
    if (err instanceof ParseError) {
      return {
        total: 0,
        successful: 0,
        failed: 1,
        errors: [{ recordIndex: -1, errors: { parse: err.message } }],
        created_ids: [],
      };
    }
    throw err;
  }

  if (records.length === 0) {
    return { total: 0, successful: 0, failed: 0, errors: [], created_ids: [] };
  }

  let validator: (records: unknown[]) => { valid: Record<string, unknown>[]; errors: import('../models/ticket').ImportRecordError[] };
  if (format === 'csv') {
    validator = validateCSVStructure;
  } else if (format === 'json') {
    validator = validateJSONStructure;
  } else {
    validator = validateXMLStructure;
  }

  const { errors: validationErrors } = validator(records);
  const errorIndexes = new Set(validationErrors.map(e => e.recordIndex));

  let successful = 0;
  const importErrors = [...validationErrors];
  const created_ids: string[] = [];

  records.forEach((record, index) => {
    if (errorIndexes.has(index)) return;
    try {
      const ticket = createTicket(record as unknown as Parameters<typeof createTicket>[0]);
      created_ids.push(ticket.id);
      successful++;
    } catch (err) {
      if (err instanceof ValidationError) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach(d => { fieldErrors[d.field] = d.message; });
        importErrors.push({ recordIndex: index, errors: fieldErrors });
      } else {
        importErrors.push({ recordIndex: index, errors: { unknown: 'Unexpected error during ticket creation' } });
      }
    }
  });

  importErrors.sort((a, b) => a.recordIndex - b.recordIndex);

  return {
    total: records.length,
    successful,
    failed: records.length - successful,
    errors: importErrors,
    created_ids,
  };
}
