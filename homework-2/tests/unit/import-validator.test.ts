import {
  validateCSVStructure,
  validateJSONStructure,
  validateXMLStructure,
} from '../../src/validators/import-validator';
import { Category, Priority, Status } from '../../src/models/ticket';

const validRecord = {
  customer_id: 'cust-001',
  customer_email: 'john@example.com',
  customer_name: 'John Doe',
  subject: 'Cannot access account',
  description: 'I have been unable to log into my account for two days.',
  category: Category.AccountAccess,
  priority: Priority.High,
  status: Status.New,
};

const invalidRecord = {
  customer_id: '',
  customer_email: 'not-an-email',
  customer_name: 'Jane',
  subject: 'x',
  description: 'short',
  category: 'invalid_cat',
  priority: 'critical',
};

describe('validateCSVStructure', () => {
  it('accepts an array of valid records', () => {
    const result = validateCSVStructure([validRecord]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid records and reports per-record errors', () => {
    const result = validateCSVStructure([invalidRecord]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].recordIndex).toBe(0);
    expect(Object.keys(result.errors[0].errors).length).toBeGreaterThan(0);
  });

  it('handles a mix of valid and invalid records', () => {
    const result = validateCSVStructure([validRecord, invalidRecord, validRecord]);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].recordIndex).toBe(1);
  });

  it('returns an error for an empty array', () => {
    const result = validateCSVStructure([]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].errors.structure).toBeDefined();
  });

  it('returns a structure error for a non-array input', () => {
    const result = validateCSVStructure(null as unknown as unknown[]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });

  it('returns an error for records that are not objects', () => {
    const result = validateCSVStructure(['string-record'] as unknown[]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });

  it('reports the correct recordIndex for multi-record errors', () => {
    const result = validateCSVStructure([validRecord, validRecord, invalidRecord]);
    expect(result.errors[0].recordIndex).toBe(2);
  });

  it('error messages contain field names', () => {
    const result = validateCSVStructure([invalidRecord]);
    const errorKeys = Object.keys(result.errors[0].errors);
    expect(errorKeys.length).toBeGreaterThan(0);
    expect(errorKeys.some(k => k !== 'unknown')).toBe(true);
  });
});

describe('validateJSONStructure', () => {
  it('accepts an array of valid records', () => {
    const result = validateJSONStructure([validRecord]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid records', () => {
    const result = validateJSONStructure([invalidRecord]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('handles mixed valid and invalid records', () => {
    const result = validateJSONStructure([validRecord, invalidRecord]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors[0].recordIndex).toBe(1);
  });

  it('returns an error for an empty array', () => {
    const result = validateJSONStructure([]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });

  it('returns a structure error for a non-object element', () => {
    const result = validateJSONStructure([42] as unknown[]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });
});

describe('validateXMLStructure', () => {
  it('accepts an array of valid records', () => {
    const result = validateXMLStructure([validRecord]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid records', () => {
    const result = validateXMLStructure([invalidRecord]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('handles mixed valid and invalid records', () => {
    const result = validateXMLStructure([invalidRecord, validRecord]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors[0].recordIndex).toBe(0);
  });

  it('returns an error for an empty array', () => {
    const result = validateXMLStructure([]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });

  it('returns a structure error for a non-object element', () => {
    const result = validateXMLStructure([true] as unknown[]);
    expect(result.errors[0].errors.structure).toBeDefined();
  });
});
