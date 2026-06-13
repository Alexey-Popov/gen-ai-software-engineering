import { ImportRecordError } from '../models/ticket';
import { validateCreateTicket, ValidationError } from './ticket-validator';

export interface ValidationResult {
  valid: Record<string, unknown>[];
  errors: ImportRecordError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCSVStructure(records: unknown[]): ValidationResult {
  const valid: Record<string, unknown>[] = [];
  const errors: ImportRecordError[] = [];

  if (!Array.isArray(records) || records.length === 0) {
    errors.push({ recordIndex: 0, errors: { structure: 'CSV must contain at least one record' } });
    return { valid, errors };
  }

  records.forEach((record, index) => {
    if (!isRecord(record)) {
      errors.push({ recordIndex: index, errors: { structure: 'Record must be an object' } });
      return;
    }
    try {
      validateCreateTicket(record);
      valid.push(record);
    } catch (err) {
      if (err instanceof ValidationError) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach(d => { fieldErrors[d.field] = d.message; });
        errors.push({ recordIndex: index, errors: fieldErrors });
      } else {
        errors.push({ recordIndex: index, errors: { unknown: 'Unknown validation error' } });
      }
    }
  });

  return { valid, errors };
}

export function validateJSONStructure(records: unknown[]): ValidationResult {
  const valid: Record<string, unknown>[] = [];
  const errors: ImportRecordError[] = [];

  if (!Array.isArray(records) || records.length === 0) {
    errors.push({ recordIndex: 0, errors: { structure: 'JSON must contain at least one record' } });
    return { valid, errors };
  }

  records.forEach((record, index) => {
    if (!isRecord(record)) {
      errors.push({ recordIndex: index, errors: { structure: 'Each JSON element must be an object' } });
      return;
    }
    try {
      validateCreateTicket(record);
      valid.push(record);
    } catch (err) {
      if (err instanceof ValidationError) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach(d => { fieldErrors[d.field] = d.message; });
        errors.push({ recordIndex: index, errors: fieldErrors });
      } else {
        errors.push({ recordIndex: index, errors: { unknown: 'Unknown validation error' } });
      }
    }
  });

  return { valid, errors };
}

export function validateXMLStructure(records: unknown[]): ValidationResult {
  const valid: Record<string, unknown>[] = [];
  const errors: ImportRecordError[] = [];

  if (!Array.isArray(records) || records.length === 0) {
    errors.push({ recordIndex: 0, errors: { structure: 'XML must contain at least one record' } });
    return { valid, errors };
  }

  records.forEach((record, index) => {
    if (!isRecord(record)) {
      errors.push({ recordIndex: index, errors: { structure: 'Each XML element must be an object' } });
      return;
    }
    try {
      validateCreateTicket(record);
      valid.push(record);
    } catch (err) {
      if (err instanceof ValidationError) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach(d => { fieldErrors[d.field] = d.message; });
        errors.push({ recordIndex: index, errors: fieldErrors });
      } else {
        errors.push({ recordIndex: index, errors: { unknown: 'Unknown validation error' } });
      }
    }
  });

  return { valid, errors };
}
