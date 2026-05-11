import { describe, it, expect } from 'vitest';
import { parseXmlTickets } from '../../src/parsers/xmlParser.js';

describe('parseXmlTickets', () => {
  it('parses a single ticket inside <tickets>', () => {
    const xml = `
      <tickets>
        <ticket>
          <customer_email>a@example.com</customer_email>
          <subject>Login broken</subject>
          <description>Cannot access dashboard after password reset</description>
          <category>account_access</category>
          <priority>high</priority>
        </ticket>
      </tickets>
    `;

    const tickets = parseXmlTickets(xml);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual({
      customer_email: 'a@example.com',
      subject: 'Login broken',
      description: 'Cannot access dashboard after password reset',
      category: 'account_access',
      priority: 'high',
    });
  });

  it('parses multiple tickets', () => {
    const xml = `
      <tickets>
        <ticket>
          <customer_email>a@ex.com</customer_email>
          <subject>T1</subject>
          <description>desc one ten plus chars</description>
        </ticket>
        <ticket>
          <customer_email>b@ex.com</customer_email>
          <subject>T2</subject>
          <description>desc two ten plus chars</description>
        </ticket>
      </tickets>
    `;

    const tickets = parseXmlTickets(xml);

    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.subject)).toEqual(['T1', 'T2']);
  });

  it('parses nested <tags><tag/></tags> into a string array', () => {
    const xml = `
      <tickets>
        <ticket>
          <customer_email>a@ex.com</customer_email>
          <subject>T1</subject>
          <description>desc one ten plus chars</description>
          <tags>
            <tag>urgent</tag>
            <tag>security</tag>
            <tag>vip</tag>
          </tags>
        </ticket>
      </tickets>
    `;

    const [ticket] = parseXmlTickets(xml);

    expect(ticket.tags).toEqual(['urgent', 'security', 'vip']);
  });

  it('parses nested <metadata> into an object', () => {
    const xml = `
      <tickets>
        <ticket>
          <customer_email>a@ex.com</customer_email>
          <subject>T1</subject>
          <description>desc one ten plus chars</description>
          <metadata>
            <source>web_form</source>
            <browser>Chrome</browser>
            <device_type>desktop</device_type>
          </metadata>
        </ticket>
      </tickets>
    `;

    const [ticket] = parseXmlTickets(xml);

    expect(ticket.metadata).toEqual({
      source: 'web_form',
      browser: 'Chrome',
      device_type: 'desktop',
    });
  });

  it('throws on malformed XML', () => {
    expect(() => parseXmlTickets('<tickets><ticket></tickets>')).toThrow(/Malformed XML/);
  });

  it('throws on unsupported XML shape (missing <tickets> root)', () => {
    expect(() => parseXmlTickets('<foo><bar/></foo>')).toThrow(/Unsupported XML shape/);
  });

  it('returns an empty array for <tickets/> with no children', () => {
    expect(parseXmlTickets('<tickets></tickets>')).toEqual([]);
  });
});
