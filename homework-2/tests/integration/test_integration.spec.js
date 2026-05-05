/**
 * End-to-end integration narratives — exactly the 5 workflows Stage 13 asks for.
 * Each test reads as a small story: how a real consumer would chain endpoints
 * together. Granular per-endpoint assertions live in `crud.test.js`,
 * `filtering.test.js`, `autoClassify.test.js`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';
import { clear as clearLog } from '../../src/classifier/decisionLog.js';

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures'
);
const VALID_DESC = 'Cannot log in to my account after the password reset email arrived';
const fixture = (name) => fs.readFileSync(path.join(FIXTURES_DIR, name));

describe('Integration narratives (Stage 13)', () => {
  beforeEach(() => {
    ticketStore.clear();
    clearLog();
  });

  it('full ticket lifecycle: create → classify → update → resolve → delete', async () => {
    const created = await request(app)
      .post('/tickets?autoClassify=true')
      .send({
        customer_email: 'a@example.com',
        subject: 'Cannot log in',
        description: VALID_DESC,
      });
    expect(created.status).toBe(201);
    expect(created.body.category).toBe('account_access');
    expect(created.body.classification).toBeDefined();

    const inProgress = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ status: 'in_progress', assigned_to: 'agent-1' });
    expect(inProgress.body.status).toBe('in_progress');
    expect(inProgress.body.assigned_to).toBe('agent-1');

    const resolved = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ status: 'resolved' });
    expect(resolved.body.status).toBe('resolved');
    expect(resolved.body.resolved_at).toBeDefined();

    const deleted = await request(app).delete(`/tickets/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const gone = await request(app).get(`/tickets/${created.body.id}`);
    expect(gone.status).toBe(404);
  });

  it('bulk CSV import + manual auto-classify on imported tickets', async () => {
    const importRes = await request(app)
      .post('/tickets/import')
      .attach('file', fixture('sample_tickets.csv'), 'sample_tickets.csv');
    expect(importRes.body.successful).toBe(50);

    // pick a known-classifiable ticket and run auto-classify on it
    const list = await request(app).get('/tickets?category=account_access');
    expect(list.body.length).toBeGreaterThan(0);
    const target = list.body[0];

    const classifyRes = await request(app).post(`/tickets/${target.id}/auto-classify`);
    expect(classifyRes.status).toBe(200);
    expect(classifyRes.body.ticket.classification.confidence).toBeGreaterThan(0);
    expect(classifyRes.body.classification.keywords.length).toBeGreaterThan(0);

    // verify the decision was logged
    const log = await request(app).get('/classifier/log');
    expect(log.body).toHaveLength(1);
    expect(log.body[0].ticket_id).toBe(target.id);
  });

  it('combined filter: category AND priority narrows correctly', async () => {
    await request(app).post('/tickets').send({
      customer_email: 'a@ex.com', subject: 'A', description: VALID_DESC,
      category: 'technical_issue', priority: 'high',
    });
    await request(app).post('/tickets').send({
      customer_email: 'b@ex.com', subject: 'B', description: VALID_DESC,
      category: 'technical_issue', priority: 'low',
    });
    await request(app).post('/tickets').send({
      customer_email: 'c@ex.com', subject: 'C', description: VALID_DESC,
      category: 'billing_question', priority: 'high',
    });

    const res = await request(app).get('/tickets?category=technical_issue&priority=high');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('technical_issue');
    expect(res.body[0].priority).toBe('high');
  });

  it('manual override after auto-classify is preserved (no implicit re-classify)', async () => {
    const created = await request(app)
      .post('/tickets?autoClassify=true')
      .send({
        customer_email: 'a@ex.com', subject: 'Cannot log in',
        description: VALID_DESC,
      });
    expect(created.body.category).toBe('account_access');

    const overridden = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ category: 'feature_request', priority: 'low' });
    expect(overridden.body.category).toBe('feature_request');
    expect(overridden.body.priority).toBe('low');

    // subsequent GET still shows the override (no implicit re-classify)
    const fetched = await request(app).get(`/tickets/${created.body.id}`);
    expect(fetched.body.category).toBe('feature_request');

    // log still has only the original auto-on-create entry
    const log = await request(app).get('/classifier/log');
    expect(log.body).toHaveLength(1);
    expect(log.body[0].trigger).toBe('auto-on-create');
  });

  it('mixed-format batch: CSV + JSON + XML in sequence yields combined total', async () => {
    const csv = await request(app)
      .post('/tickets/import')
      .attach('file', fixture('sample_tickets.csv'), 'sample_tickets.csv');
    expect(csv.body.successful).toBe(50);

    const json = await request(app)
      .post('/tickets/import')
      .attach('file', fixture('sample_tickets.json'), 'sample_tickets.json');
    expect(json.body.successful).toBe(20);

    const xml = await request(app)
      .post('/tickets/import')
      .attach('file', fixture('sample_tickets.xml'), 'sample_tickets.xml');
    expect(xml.body.successful).toBe(30);

    const all = await request(app).get('/tickets');
    expect(all.body).toHaveLength(100);
  });
});
