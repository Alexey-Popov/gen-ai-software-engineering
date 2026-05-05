import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';
import { clear as clearLog } from '../../src/classifier/decisionLog.js';

const VALID_DESC =
  'Cannot log in to my account after the password reset email arrived';

async function create(overrides = {}, query = '') {
  const res = await request(app)
    .post(`/tickets${query}`)
    .send({
      customer_email: 'a@ex.com',
      subject: 'Cannot log in',
      description: VALID_DESC,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

describe('POST /tickets/:id/auto-classify', () => {
  beforeEach(() => {
    ticketStore.clear();
    clearLog();
  });

  it('classifies an existing ticket and updates it in place', async () => {
    const created = await create();

    const res = await request(app).post(`/tickets/${created.id}/auto-classify`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.id).toBe(created.id);
    expect(res.body.ticket.category).toBe('account_access');
    expect(res.body.ticket.classification).toBeDefined();
    expect(res.body.ticket.classification.confidence).toBeGreaterThan(0);
    expect(res.body.ticket.classification.classified_at).toBeDefined();
    expect(res.body.classification.keywords.length).toBeGreaterThan(0);
    expect(res.body.classification.reasoning).toMatch(/category=account_access/);
  });

  it('persists the classification (subsequent GET returns it)', async () => {
    const created = await create();
    await request(app).post(`/tickets/${created.id}/auto-classify`);

    const res = await request(app).get(`/tickets/${created.id}`);

    expect(res.body.category).toBe('account_access');
    expect(res.body.classification.keywords).toEqual(
      expect.arrayContaining(['log in', 'password'])
    );
  });

  it('records a "manual" entry in the decision log', async () => {
    const created = await create();
    await request(app).post(`/tickets/${created.id}/auto-classify`);

    const log = await request(app).get('/classifier/log');

    expect(log.body).toHaveLength(1);
    expect(log.body[0].trigger).toBe('manual');
    expect(log.body[0].ticket_id).toBe(created.id);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app).post('/tickets/no-such-id/auto-classify');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ticket not found');
  });
});

describe('POST /tickets?autoClassify=true', () => {
  beforeEach(() => {
    ticketStore.clear();
    clearLog();
  });

  it('runs the classifier on creation when the flag is true', async () => {
    const ticket = await create({}, '?autoClassify=true');

    expect(ticket.category).toBe('account_access');
    expect(ticket.classification).toBeDefined();
    expect(ticket.classification.confidence).toBeGreaterThan(0);
  });

  it('records an "auto-on-create" entry in the decision log', async () => {
    await create({}, '?autoClassify=true');

    const log = await request(app).get('/classifier/log');

    expect(log.body).toHaveLength(1);
    expect(log.body[0].trigger).toBe('auto-on-create');
  });

  it('does NOT classify when the flag is missing', async () => {
    const ticket = await create();

    expect(ticket.category).toBeUndefined();
    expect(ticket.classification).toBeUndefined();
  });

  it('does NOT classify when the flag is anything other than "true"', async () => {
    const ticket = await create({}, '?autoClassify=yes');
    expect(ticket.classification).toBeUndefined();
  });
});

describe('Manual override after auto-classify', () => {
  beforeEach(() => {
    ticketStore.clear();
    clearLog();
  });

  it('PUT can override auto-classified category without re-classifying', async () => {
    const created = await create({}, '?autoClassify=true');
    expect(created.category).toBe('account_access');

    const res = await request(app)
      .put(`/tickets/${created.id}`)
      .send({ category: 'feature_request', priority: 'low' });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('feature_request');
    expect(res.body.priority).toBe('low');
    // Log still has only the original auto-on-create entry — no re-classification
    const log = await request(app).get('/classifier/log');
    expect(log.body).toHaveLength(1);
    expect(log.body[0].trigger).toBe('auto-on-create');
  });

  it('explicit POST /:id/auto-classify after manual override re-classifies', async () => {
    const created = await create({}, '?autoClassify=true');
    await request(app)
      .put(`/tickets/${created.id}`)
      .send({ category: 'feature_request' });

    const res = await request(app).post(`/tickets/${created.id}/auto-classify`);

    expect(res.body.ticket.category).toBe('account_access');
    const log = await request(app).get('/classifier/log');
    expect(log.body).toHaveLength(2);
    expect(log.body.map((e) => e.trigger)).toEqual([
      'auto-on-create',
      'manual',
    ]);
  });
});
