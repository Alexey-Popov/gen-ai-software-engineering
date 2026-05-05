import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';

const VALID_DESC = 'this is a valid description ten plus chars';

async function create(overrides = {}) {
  const res = await request(app)
    .post('/tickets')
    .send({
      customer_email: 'a@ex.com',
      subject: 'T',
      description: VALID_DESC,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('GET /tickets — filtering', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  describe('single filters', () => {
    it('filters by category', async () => {
      await create({ category: 'technical_issue' });
      await create({ category: 'billing_question' });
      await create({ category: 'technical_issue' });

      const res = await request(app).get('/tickets?category=technical_issue');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((t) => t.category === 'technical_issue')).toBe(true);
    });

    it('filters by priority', async () => {
      await create({ priority: 'urgent' });
      await create({ priority: 'low' });

      const res = await request(app).get('/tickets?priority=urgent');

      expect(res.body).toHaveLength(1);
      expect(res.body[0].priority).toBe('urgent');
    });

    it('filters by status', async () => {
      await create({ status: 'new' });
      const t2 = await create({ status: 'new' });
      await request(app).put(`/tickets/${t2.id}`).send({ status: 'resolved' });

      const res = await request(app).get('/tickets?status=resolved');

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('resolved');
    });

    it('filters by customer_id', async () => {
      await create({ customer_id: 'CUST-001' });
      await create({ customer_id: 'CUST-002' });

      const res = await request(app).get('/tickets?customer_id=CUST-001');

      expect(res.body).toHaveLength(1);
      expect(res.body[0].customer_id).toBe('CUST-001');
    });

    it('filters by assigned_to', async () => {
      const t1 = await create();
      await request(app).put(`/tickets/${t1.id}`).send({ assigned_to: 'agent-42' });
      await create();

      const res = await request(app).get('/tickets?assigned_to=agent-42');

      expect(res.body).toHaveLength(1);
      expect(res.body[0].assigned_to).toBe('agent-42');
    });
  });

  describe('combined filters (AND)', () => {
    it('combines category + priority', async () => {
      await create({ category: 'technical_issue', priority: 'high' });
      await create({ category: 'technical_issue', priority: 'low' });
      await create({ category: 'billing_question', priority: 'high' });

      const res = await request(app).get('/tickets?category=technical_issue&priority=high');

      expect(res.body).toHaveLength(1);
      expect(res.body[0].category).toBe('technical_issue');
      expect(res.body[0].priority).toBe('high');
    });

    it('combines category + priority + status', async () => {
      await create({ category: 'bug_report', priority: 'urgent', status: 'new' });
      await create({ category: 'bug_report', priority: 'urgent', status: 'closed' });

      const res = await request(app).get(
        '/tickets?category=bug_report&priority=urgent&status=new'
      );

      expect(res.body).toHaveLength(1);
    });

    it('returns empty array when no ticket matches all filters', async () => {
      await create({ category: 'technical_issue', priority: 'low' });

      const res = await request(app).get('/tickets?category=technical_issue&priority=urgent');

      expect(res.body).toEqual([]);
    });
  });

  describe('date range', () => {
    it('filters by date-only from/to (inclusive day bounds)', async () => {
      const t = await create();

      // Today's date in UTC, derived from the actual created_at
      const today = t.created_at.slice(0, 10);

      const inRange = await request(app).get(`/tickets?from=${today}&to=${today}`);
      expect(inRange.body).toHaveLength(1);

      const outOfRange = await request(app).get('/tickets?from=2099-01-01&to=2099-12-31');
      expect(outOfRange.body).toEqual([]);
    });

    it('400 when to < from', async () => {
      const res = await request(app).get('/tickets?from=2026-12-31&to=2026-01-01');

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('from must be earlier than or equal to to');
    });
  });

  describe('400 errors', () => {
    it('returns 400 with details[] for invalid enum', async () => {
      const res = await request(app).get('/tickets?category=invalid');

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/category must be one of/);
    });

    it('collects multiple invalid params in details[]', async () => {
      const res = await request(app).get('/tickets?category=bad&priority=bad&from=not-a-date');

      expect(res.status).toBe(400);
      expect(res.body.details).toHaveLength(3);
    });
  });
});
