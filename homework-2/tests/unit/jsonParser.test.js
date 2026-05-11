import { describe, it, expect } from 'vitest';
import { parseJsonTickets } from '../../src/parsers/jsonParser.js';

describe('parseJsonTickets', () => {
  it('parses a top-level array of tickets', () => {
    const json = JSON.stringify([
      { customer_email: 'a@ex.com', subject: 'T1', description: 'desc one' },
      { customer_email: 'b@ex.com', subject: 'T2', description: 'desc two' },
    ]);

    const tickets = parseJsonTickets(json);

    expect(tickets).toHaveLength(2);
    expect(tickets[0].customer_email).toBe('a@ex.com');
    expect(tickets[1].subject).toBe('T2');
  });

  it('parses a wrapper object with a tickets[] field', () => {
    const json = JSON.stringify({
      tickets: [
        { customer_email: 'a@ex.com', subject: 'T1', description: 'desc one' },
      ],
    });

    const tickets = parseJsonTickets(json);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].customer_email).toBe('a@ex.com');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseJsonTickets('{not valid json')).toThrow(/Malformed JSON/);
  });

  it('throws on unsupported shape (e.g. raw object, string)', () => {
    expect(() => parseJsonTickets('{"foo": "bar"}')).toThrow(/Unsupported JSON shape/);
    expect(() => parseJsonTickets('"a string"')).toThrow(/Unsupported JSON shape/);
  });

  it('returns an empty array for [] or { tickets: [] }', () => {
    expect(parseJsonTickets('[]')).toEqual([]);
    expect(parseJsonTickets('{"tickets": []}')).toEqual([]);
  });
});
