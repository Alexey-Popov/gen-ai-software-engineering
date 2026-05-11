import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { record, clear } from '../../src/classifier/decisionLog.js';

describe('GET /classifier/log', () => {
  beforeEach(() => {
    clear();
  });

  it('returns an empty array when nothing has been classified', async () => {
    const res = await request(app).get('/classifier/log');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns previously recorded entries (oldest first)', async () => {
    record({
      ticket_id: 't1',
      subject: 'Login broken',
      result: { category: 'account_access', priority: 'high', confidence: 0.4, keywords: ['login'], reasoning: 'x' },
      trigger: 'manual',
    });
    record({
      ticket_id: 't2',
      subject: 'Refund please',
      result: { category: 'billing_question', priority: 'medium', confidence: 0.2, keywords: ['refund'], reasoning: 'x' },
      trigger: 'auto-on-create',
    });

    const res = await request(app).get('/classifier/log');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].ticket_id).toBe('t1');
    expect(res.body[1].ticket_id).toBe('t2');
    expect(res.body[1].trigger).toBe('auto-on-create');
  });
});
