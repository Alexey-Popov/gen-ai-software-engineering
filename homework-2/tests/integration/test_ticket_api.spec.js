/**
 * API contract spec — exactly the 11 tests Stage 12 asks for.
 *
 * Locks the public HTTP contract in one place so a reviewer can audit it at
 * a glance. Detailed CRUD/filter behaviour lives in `crud.test.js` /
 * `filtering.test.js`; this file is intentionally minimal and per-status.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';

const VALID_DESC = 'this is a valid description ten plus chars';

const validTicket = (overrides = {}) => ({
  customer_email: 'a@example.com',
  subject: 'Test',
  description: VALID_DESC,
  ...overrides,
});

describe('Ticket API contract (Stage 12)', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  it('POST /tickets — valid body returns 201 with the created ticket', async () => {
    const res = await request(app).post('/tickets').send(validTicket());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });

  it('POST /tickets — invalid body returns 400 with details[]', async () => {
    const res = await request(app).post('/tickets').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('GET /tickets — returns 200 and an array', async () => {
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /tickets with a valid filter — returns 200 (narrowed list)', async () => {
    await request(app).post('/tickets').send(validTicket({ category: 'technical_issue' }));
    await request(app).post('/tickets').send(validTicket({ category: 'billing_question' }));

    const res = await request(app).get('/tickets?category=technical_issue');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('technical_issue');
  });

  it('GET /tickets with a bad filter — returns 400', async () => {
    const res = await request(app).get('/tickets?category=not_a_real_category');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('GET /tickets/:id (existing) — returns 200 with the ticket', async () => {
    const created = await request(app).post('/tickets').send(validTicket());
    const res = await request(app).get(`/tickets/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('GET /tickets/:id (unknown) — returns 404 "Ticket not found"', async () => {
    const res = await request(app).get('/tickets/no-such-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ticket not found');
  });

  it('PUT /tickets/:id (existing) — returns 200 with the updated ticket', async () => {
    const created = await request(app).post('/tickets').send(validTicket());
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ subject: 'updated subject' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('updated subject');
  });

  it('PUT /tickets/:id (unknown) — returns 404', async () => {
    const res = await request(app)
      .put('/tickets/no-such-id')
      .send({ subject: 'updated' });
    expect(res.status).toBe(404);
  });

  it('DELETE /tickets/:id (existing) — returns 204 with no body', async () => {
    const created = await request(app).post('/tickets').send(validTicket());
    const res = await request(app).delete(`/tickets/${created.body.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('DELETE /tickets/:id (unknown) — returns 404', async () => {
    const res = await request(app).delete('/tickets/no-such-id');
    expect(res.status).toBe(404);
  });
});
