import { describe, it, expect } from 'vitest';
import { parseCsvTickets } from '../../src/parsers/csvParser.js';

describe('parseCsvTickets', () => {
  it('parses a single valid row into a ticket payload', () => {
    const csv = [
      'customer_email,subject,description',
      'a@example.com,Login broken,Cannot access dashboard after password reset',
    ].join('\n');

    const tickets = parseCsvTickets(csv);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual({
      customer_email: 'a@example.com',
      subject: 'Login broken',
      description: 'Cannot access dashboard after password reset',
    });
  });

  it('parses multiple rows', () => {
    const csv = [
      'customer_email,subject,description',
      'a@example.com,T1,desc one ten plus chars',
      'b@example.com,T2,desc two ten plus chars',
      'c@example.com,T3,desc three ten plus chars',
    ].join('\n');

    const tickets = parseCsvTickets(csv);

    expect(tickets).toHaveLength(3);
    expect(tickets.map((t) => t.customer_email)).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ]);
  });

  it('splits the tags column on ";"', () => {
    const csv = [
      'customer_email,subject,description,tags',
      'a@example.com,T1,desc one ten plus chars,urgent;security; vip',
    ].join('\n');

    const [ticket] = parseCsvTickets(csv);

    expect(ticket.tags).toEqual(['urgent', 'security', 'vip']);
  });

  it('nests metadata.* columns into a metadata object', () => {
    const csv = [
      'customer_email,subject,description,metadata.source,metadata.browser,metadata.device_type',
      'a@example.com,T1,desc one ten plus chars,web_form,Chrome,desktop',
    ].join('\n');

    const [ticket] = parseCsvTickets(csv);

    expect(ticket.metadata).toEqual({
      source: 'web_form',
      browser: 'Chrome',
      device_type: 'desktop',
    });
  });

  it('drops empty cells (does not emit empty strings)', () => {
    const csv = [
      'customer_email,subject,description,assigned_to,tags,metadata.browser',
      'a@example.com,T1,desc one ten plus chars,,,',
    ].join('\n');

    const [ticket] = parseCsvTickets(csv);

    expect(ticket).not.toHaveProperty('assigned_to');
    expect(ticket).not.toHaveProperty('tags');
    expect(ticket).not.toHaveProperty('metadata');
  });

  it('throws on malformed CSV (mismatched quotes)', () => {
    const csv = 'customer_email,subject,description\n"a@example.com,broken,"unterminated';

    expect(() => parseCsvTickets(csv)).toThrow(/Malformed CSV/);
  });
});
