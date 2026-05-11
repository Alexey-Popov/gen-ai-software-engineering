import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);

function read(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name));
}

describe('sample fixtures', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  it('imports the full CSV fixture (50 rows, all valid)', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.csv'), 'sample_tickets.csv');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(50);
    expect(res.body.successful).toBe(50);
    expect(res.body.failed).toEqual([]);
  });

  it('imports the full JSON fixture (20 tickets, all valid)', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.json'), 'sample_tickets.json');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(20);
    expect(res.body.successful).toBe(20);
  });

  it('imports the full XML fixture (30 tickets, all valid)', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.xml'), 'sample_tickets.xml');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(30);
    expect(res.body.successful).toBe(30);
  });

  it('rejects malformed CSV with 400', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('invalid_sample.csv'), 'invalid_sample.csv');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed CSV/);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('invalid_sample.json'), 'invalid_sample.json');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed JSON/);
  });

  it('rejects malformed XML with 400', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('invalid_sample.xml'), 'invalid_sample.xml');

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/Malformed XML/);
  });

  it('parses invalid_rows.csv but reports per-row failures (1 valid out of 6)', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', read('invalid_rows.csv'), 'invalid_rows.csv');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    expect(res.body.successful).toBe(1);
    expect(res.body.failed).toHaveLength(5);
  });

  it('importing all three valid fixtures yields 100 tickets total', async () => {
    await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.csv'), 'sample_tickets.csv');
    await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.json'), 'sample_tickets.json');
    await request(app)
      .post('/tickets/import')
      .attach('file', read('sample_tickets.xml'), 'sample_tickets.xml');

    expect(ticketStore.getAll()).toHaveLength(100);
  });
});
