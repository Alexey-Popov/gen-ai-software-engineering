'use strict';

const { validateTransaction, validateAmount } = require('../src/validators/transactionValidator');

describe('validateAmount', () => {
  it.each([100, 100.5, 100.55, 0.01, 1])('accepts positive %p with ≤2 decimals', (amt) => {
    expect(validateAmount(amt)).toBeNull();
  });

  it.each([0, -1, -0.01])('rejects non-positive %p', (amt) => {
    expect(validateAmount(amt)).toMatch(/positive/);
  });

  it('rejects more than 2 decimal places', () => {
    expect(validateAmount(100.555)).toMatch(/2 decimal/);
  });

  it.each(['100', null, undefined, NaN])('rejects non-number %p', (amt) => {
    expect(validateAmount(amt)).not.toBeNull();
  });
});

describe('validateTransaction — account rules per type', () => {
  it('accepts a valid transfer with two distinct accounts', () => {
    const r = validateTransaction({
      fromAccount: 'ACC-12345', toAccount: 'ACC-67890',
      amount: 100.5, currency: 'USD', type: 'transfer',
    });
    expect(r.valid).toBe(true);
    expect(r.details).toHaveLength(0);
  });

  it('rejects a transfer with identical from/to', () => {
    const r = validateTransaction({
      fromAccount: 'ACC-12345', toAccount: 'ACC-12345',
      amount: 10, currency: 'USD', type: 'transfer',
    });
    expect(r.valid).toBe(false);
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'toAccount' })])
    );
  });

  it('accepts a deposit with only toAccount', () => {
    const r = validateTransaction({
      toAccount: 'ACC-12345', amount: 50, currency: 'EUR', type: 'deposit',
    });
    expect(r.valid).toBe(true);
  });

  it('rejects a deposit that carries a fromAccount', () => {
    const r = validateTransaction({
      fromAccount: 'ACC-99999', toAccount: 'ACC-12345',
      amount: 50, currency: 'EUR', type: 'deposit',
    });
    expect(r.valid).toBe(false);
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'fromAccount' })])
    );
  });

  it('accepts a withdrawal with only fromAccount', () => {
    const r = validateTransaction({
      fromAccount: 'ACC-12345', amount: 50, currency: 'GBP', type: 'withdrawal',
    });
    expect(r.valid).toBe(true);
  });

  it('rejects a withdrawal missing fromAccount', () => {
    const r = validateTransaction({ amount: 50, currency: 'GBP', type: 'withdrawal' });
    expect(r.valid).toBe(false);
  });
});

describe('validateTransaction — field validation', () => {
  it('rejects an invalid account format', () => {
    const r = validateTransaction({
      toAccount: 'ACC-123', amount: 50, currency: 'USD', type: 'deposit',
    });
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'toAccount' })])
    );
  });

  it('rejects an invalid currency', () => {
    const r = validateTransaction({
      toAccount: 'ACC-12345', amount: 50, currency: 'XYZ', type: 'deposit',
    });
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'currency' })])
    );
  });

  it('rejects an unknown type', () => {
    const r = validateTransaction({ amount: 50, currency: 'USD', type: 'lottery' });
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'type' })])
    );
  });

  it('rejects an invalid status override', () => {
    const r = validateTransaction({
      toAccount: 'ACC-12345', amount: 50, currency: 'USD', type: 'deposit', status: 'weird',
    });
    expect(r.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })])
    );
  });

  it('collects multiple errors at once', () => {
    const r = validateTransaction({ amount: -5, currency: 'XYZ', type: 'transfer' });
    expect(r.details.length).toBeGreaterThanOrEqual(3);
  });
});
