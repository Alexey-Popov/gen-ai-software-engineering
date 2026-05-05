/**
 * Performance benchmarks (Stage 13) — 5 tests with generous upper bounds.
 *
 * Numbers below are far higher than what we observe locally; they're chosen
 * so CI doesn't flake while still catching genuine regressions (e.g. an
 * accidental O(n²) somewhere in the filter path).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';
import { classify } from '../../src/classifier/classify.js';

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);

const VALID_DESC = 'this is a valid description ten plus chars';

const validTicket = (i) => ({
  customer_email: `user${i}@ex.com`,
  subject: `T${i}`,
  description: VALID_DESC,
  category: i % 2 === 0 ? 'technical_issue' : 'billing_question',
  priority: i % 3 === 0 ? 'high' : 'medium',
});

describe('Performance (Stage 13)', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  it('handles 20+ concurrent POST /tickets without errors', async () => {
    const N = 25;
    const start = performance.now();

    const responses = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request(app).post('/tickets').send(validTicket(i))
      )
    );

    const duration = performance.now() - start;

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(ticketStore.getAll()).toHaveLength(N);
    expect(duration).toBeLessThan(2000); // 2 s upper bound
  });

  it('imports 50 CSV rows in under 1 second', async () => {
    const file = fs.readFileSync(path.join(FIXTURES_DIR, 'sample_tickets.csv'));

    const start = performance.now();
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', file, 'sample_tickets.csv');
    const duration = performance.now() - start;

    expect(res.body.successful).toBe(50);
    expect(duration).toBeLessThan(1000);
  });

  it('classifies a single ticket in under 50 ms (averaged over 100 calls)', () => {
    const ticket = {
      subject: 'Production down — critical security issue',
      description: "We can't access the dashboard. This is blocking the whole team and needs to be fixed asap.",
    };

    // warm-up
    classify(ticket);

    const N = 100;
    const start = performance.now();
    for (let i = 0; i < N; i += 1) classify(ticket);
    const avg = (performance.now() - start) / N;

    expect(avg).toBeLessThan(50);
  });

  it('filtered list over 1000 tickets returns in under 100 ms', async () => {
    for (let i = 0; i < 1000; i += 1) {
      ticketStore.create(validTicket(i));
    }

    const start = performance.now();
    const res = await request(app).get('/tickets?category=technical_issue&priority=high');
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100);
  });

  it('mixed read/write load (10 readers + 5 writers) all succeed', async () => {
    // seed a small base so reads have something to return
    for (let i = 0; i < 10; i += 1) ticketStore.create(validTicket(i));

    const reads = Array.from({ length: 10 }, () => request(app).get('/tickets'));
    const writes = Array.from({ length: 5 }, (_, i) =>
      request(app).post('/tickets').send(validTicket(100 + i))
    );

    const results = await Promise.all([...reads, ...writes]);

    const readResults = results.slice(0, 10);
    const writeResults = results.slice(10);

    expect(readResults.every((r) => r.status === 200)).toBe(true);
    expect(writeResults.every((r) => r.status === 201)).toBe(true);
    expect(ticketStore.getAll()).toHaveLength(15);
  });
});
