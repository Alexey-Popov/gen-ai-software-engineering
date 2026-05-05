import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';

const validHeader =
  'customer_email,subject,description,category,priority';

const VALID_DESC = 'this is a valid description ten plus chars';

function csvBuffer(lines) {
  return Buffer.from(lines.join('\n'), 'utf-8');
}

describe('POST /tickets/import — CSV', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  it('imports a fully valid CSV and returns a summary', async () => {
    const csv = csvBuffer([
      validHeader,
      `a@ex.com,T1,${VALID_DESC},technical_issue,high`,
      `b@ex.com,T2,${VALID_DESC},billing_question,medium`,
      `c@ex.com,T3,${VALID_DESC},account_access,urgent`,
    ]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', csv, 'sample.csv');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 3, successful: 3, failed: [] });
    expect(ticketStore.getAll()).toHaveLength(3);
  });

  it('returns a partial-success summary for a mixed-valid file', async () => {
    const csv = csvBuffer([
      validHeader,
      `a@ex.com,T1,${VALID_DESC},technical_issue,high`,
      `bad-email,T2,${VALID_DESC},billing_question,medium`, // invalid email
      `c@ex.com,T3,short,account_access,urgent`,           // description too short
    ]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', csv, 'sample.csv');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.successful).toBe(1);
    expect(res.body.failed).toHaveLength(2);
    expect(res.body.failed[0]).toMatchObject({ row: 2 });
    expect(res.body.failed[0].errors.some((e) => e.includes('customer_email'))).toBe(true);
    expect(res.body.failed[1]).toMatchObject({ row: 3 });
    expect(res.body.failed[1].errors.some((e) => e.includes('description'))).toBe(true);
    expect(ticketStore.getAll()).toHaveLength(1);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/tickets/import');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details[0]).toMatch(/file is required/);
  });

  it('returns 400 for unsupported file format', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('hello'), 'sample.txt');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Unsupported file format/);
  });

  it('returns 400 (not 500) on malformed CSV', async () => {
    const broken = Buffer.from(
      'customer_email,subject,description\n"a@ex.com,broken,"unterminated',
      'utf-8'
    );

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', broken, 'broken.csv');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed CSV/);
  });

  it('does not create any tickets when every row is invalid', async () => {
    const csv = csvBuffer([
      validHeader,
      `bad,T1,short,wrong,wrong`,
      `bad2,T2,short,wrong,wrong`,
    ]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', csv, 'sample.csv');

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(0);
    expect(res.body.failed).toHaveLength(2);
    expect(ticketStore.getAll()).toHaveLength(0);
  });
});

describe('POST /tickets/import — JSON', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  function jsonBuffer(value) {
    return Buffer.from(JSON.stringify(value), 'utf-8');
  }

  const validTicket = (i) => ({
    customer_email: `user${i}@ex.com`,
    subject: `T${i}`,
    description: VALID_DESC,
    category: 'technical_issue',
    priority: 'medium',
  });

  it('imports a top-level array of valid tickets', async () => {
    const file = jsonBuffer([validTicket(1), validTicket(2), validTicket(3)]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 3, successful: 3, failed: [] });
    expect(ticketStore.getAll()).toHaveLength(3);
  });

  it('imports a wrapper { tickets: [...] } shape', async () => {
    const file = jsonBuffer({ tickets: [validTicket(1), validTicket(2)] });

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.json');

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(2);
    expect(ticketStore.getAll()).toHaveLength(2);
  });

  it('returns a partial-success summary for a mixed-valid JSON file', async () => {
    const file = jsonBuffer([
      validTicket(1),
      { customer_email: 'bad', subject: 'T2', description: VALID_DESC }, // bad email
      validTicket(3),
    ]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.json');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.successful).toBe(2);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0]).toMatchObject({ row: 2 });
    expect(res.body.failed[0].errors.some((e) => e.includes('customer_email'))).toBe(true);
  });

  it('returns 400 (not 500) on malformed JSON', async () => {
    const file = Buffer.from('{not valid json', 'utf-8');

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'broken.json');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed JSON/);
  });

  it('returns 400 for unsupported JSON shape (raw object)', async () => {
    const file = jsonBuffer({ foo: 'bar' });

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.json');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Unsupported JSON shape/);
  });
});

describe('POST /tickets/import — XML', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  function xmlBuffer(str) {
    return Buffer.from(str, 'utf-8');
  }

  const ticketXml = (i) => `
    <ticket>
      <customer_email>user${i}@ex.com</customer_email>
      <subject>T${i}</subject>
      <description>${VALID_DESC}</description>
      <category>technical_issue</category>
      <priority>medium</priority>
    </ticket>
  `;

  it('imports a valid XML file with multiple tickets', async () => {
    const file = xmlBuffer(`
      <tickets>${ticketXml(1)}${ticketXml(2)}${ticketXml(3)}</tickets>
    `);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.xml');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 3, successful: 3, failed: [] });
    expect(ticketStore.getAll()).toHaveLength(3);
  });

  it('returns a partial-success summary for a mixed-valid XML file', async () => {
    const file = xmlBuffer(`
      <tickets>
        ${ticketXml(1)}
        <ticket>
          <customer_email>not-an-email</customer_email>
          <subject>T2</subject>
          <description>${VALID_DESC}</description>
        </ticket>
        ${ticketXml(3)}
      </tickets>
    `);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.xml');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.successful).toBe(2);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0]).toMatchObject({ row: 2 });
    expect(res.body.failed[0].errors.some((e) => e.includes('customer_email'))).toBe(true);
  });

  it('returns 400 (not 500) on malformed XML', async () => {
    const file = xmlBuffer('<tickets><ticket></tickets>');

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'broken.xml');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed XML/);
  });

  it('returns 400 for unsupported XML shape (missing <tickets> root)', async () => {
    const file = xmlBuffer('<foo><bar/></foo>');

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'wrong.xml');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Unsupported XML shape/);
  });

  it('imports nested metadata and tags from XML correctly', async () => {
    const file = xmlBuffer(`
      <tickets>
        <ticket>
          <customer_email>a@ex.com</customer_email>
          <subject>Nested test</subject>
          <description>${VALID_DESC}</description>
          <category>technical_issue</category>
          <priority>high</priority>
          <tags>
            <tag>urgent</tag>
            <tag>security</tag>
          </tags>
          <metadata>
            <source>web_form</source>
            <device_type>desktop</device_type>
          </metadata>
        </ticket>
      </tickets>
    `);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample.xml');

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(1);
    const [stored] = ticketStore.getAll();
    expect(stored.tags).toEqual(['urgent', 'security']);
    expect(stored.metadata).toEqual({ source: 'web_form', device_type: 'desktop' });
  });
});
