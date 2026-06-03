const { importTickets } = require('../src/services/importService');
const { clearTickets, getTickets } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Import XML', () => {
  const validXml = `<tickets>
    <ticket>
      <customer_email>test@example.com</customer_email>
      <subject>Test Subj</subject>
      <description>Test description is here.</description>
    </ticket>
  </tickets>`;

  test('Successfully imports valid XML', () => {
    const res = importTickets(Buffer.from(validXml), 'xml');
    expect(res.total).toBe(1);
    expect(res.successful).toBe(1);
    expect(getTickets().length).toBe(1);
  });

  test('Fails on invalid ticket data in XML', () => {
    const invalidXml = `<tickets><ticket><subject>short</subject></ticket></tickets>`;
    const res = importTickets(Buffer.from(invalidXml), 'xml');
    expect(res.failed).toBe(1);
  });

  test('Fails on malformed XML', () => {
    const invalidXml = `<tickets><ticket>unclosed`;
    const res = importTickets(Buffer.from(invalidXml), 'xml');
    expect(res.successful).toBe(0);
  });

  test('Empty XML tickets', () => {
    const res = importTickets(Buffer.from('<tickets></tickets>'), 'xml');
    expect(res.total).toBe(0);
  });

  test('Single object vs array handling', () => {
    const res = importTickets(Buffer.from(validXml), 'xml');
    expect(res.successful).toBe(1);
  });
});
