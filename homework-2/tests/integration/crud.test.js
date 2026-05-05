import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import ticketStore from '../../src/store/ticketStore.js';

describe('CRUD Endpoints', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  describe('POST /tickets', () => {
    it('creates a ticket and returns 201', async () => {
      const res = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.customer_email).toBe('test@example.com');
      expect(res.body.subject).toBe('Test Issue');
      expect(res.body.status).toBe('new');
      expect(res.body.created_at).toBeDefined();
      expect(res.body.updated_at).toBeDefined();
    });

    it('stores the ticket in the store', async () => {
      const res = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      const stored = ticketStore.getById(res.body.id);
      expect(stored).toEqual(res.body);
    });

    describe('Validation', () => {
      it('returns 400 with details[] for invalid email', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'invalid-email',
          subject: 'Test Issue',
          description: 'This is a test issue',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
        expect(Array.isArray(res.body.details)).toBe(true);
        expect(res.body.details).toContain('customer_email must be a valid email address');
      });

      it('returns 400 for missing required fields', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
        expect(Array.isArray(res.body.details)).toBe(true);
        expect(res.body.details.length).toBeGreaterThan(0);
      });

      it('collects multiple errors in details[]', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'invalid',
          subject: '', // too short
          description: 'short', // too short
          category: 'invalid_category',
          priority: 'critical', // invalid
        });

        expect(res.status).toBe(400);
        expect(res.body.details.length).toBeGreaterThan(2);
        expect(res.body.details.some((e) => e.includes('customer_email'))).toBe(true);
        expect(res.body.details.some((e) => e.includes('subject'))).toBe(true);
        expect(res.body.details.some((e) => e.includes('description'))).toBe(true);
        expect(res.body.details.some((e) => e.includes('category'))).toBe(true);
        expect(res.body.details.some((e) => e.includes('priority'))).toBe(true);
      });

      it('returns 400 for oversized subject', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'x'.repeat(201),
          description: 'This is a test issue',
        });

        expect(res.status).toBe(400);
        expect(res.body.details).toContain('subject must be 1-200 characters');
      });

      it('returns 400 for oversized description', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'x'.repeat(2001),
        });

        expect(res.status).toBe(400);
        expect(res.body.details).toContain('description must be 10-2000 characters');
      });

      it('returns 400 for invalid category enum', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'Test description',
          category: 'invalid_cat',
        });

        expect(res.status).toBe(400);
        expect(res.body.details.some((e) => e.includes('category'))).toBe(true);
      });

      it('returns 400 for invalid priority enum', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'Test description',
          priority: 'super_urgent',
        });

        expect(res.status).toBe(400);
        expect(res.body.details.some((e) => e.includes('priority'))).toBe(true);
      });

      it('returns 400 for invalid metadata.source', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'Test description',
          metadata: { source: 'fax' },
        });

        expect(res.status).toBe(400);
        expect(res.body.details.some((e) => e.includes('metadata.source'))).toBe(true);
      });

      it('returns 400 for invalid metadata.device_type', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'Test description',
          metadata: { device_type: 'smartwatch' },
        });

        expect(res.status).toBe(400);
        expect(res.body.details.some((e) => e.includes('device_type'))).toBe(true);
      });

      it('accepts valid enums', async () => {
        const res = await request(app).post('/tickets').send({
          customer_email: 'test@example.com',
          subject: 'Test',
          description: 'Test description',
          category: 'technical_issue',
          priority: 'high',
          status: 'new',
          metadata: {
            source: 'web_form',
            device_type: 'mobile',
          },
        });

        expect(res.status).toBe(201);
        expect(res.body.category).toBe('technical_issue');
        expect(res.body.priority).toBe('high');
      });
    });
  });

  describe('PUT /tickets/:id — Validation', () => {
    it('returns 400 with details[] for invalid email in update', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      const res = await request(app)
        .put(`/tickets/${created.body.id}`)
        .send({
          customer_email: 'invalid-email',
          subject: 'Updated',
          description: 'Updated description',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('collects multiple errors in PUT update', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      const res = await request(app)
        .put(`/tickets/${created.body.id}`)
        .send({
          customer_email: 'bad',
          subject: '', // too short
          description: 'short',
          priority: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.details.length).toBeGreaterThan(2);
    });
  });

  describe('GET /tickets', () => {
    it('returns empty list when no tickets exist', async () => {
      const res = await request(app).get('/tickets');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tickets', async () => {
      const t1 = await request(app).post('/tickets').send({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'This is a valid description for D1',
      });

      const t2 = await request(app).post('/tickets').send({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'This is a valid description for D2',
      });

      const res = await request(app).get('/tickets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toContainEqual(t1.body);
      expect(res.body).toContainEqual(t2.body);
    });
  });

  describe('GET /tickets/:id', () => {
    it('returns a ticket by ID', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      const res = await request(app).get(`/tickets/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(app).get('/tickets/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  describe('PUT /tickets/:id', () => {
    it('updates a ticket and returns 200', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Original Subject',
        description: 'This is a test issue',
      });

      const res = await request(app)
        .put(`/tickets/${created.body.id}`)
        .send({
          subject: 'Updated Subject',
        });

      expect(res.status).toBe(200);
      expect(res.body.subject).toBe('Updated Subject');
      expect(res.body.customer_email).toBe('test@example.com');
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.created_at).toBe(created.body.created_at);
      expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(
        new Date(created.body.updated_at).getTime()
      );
    });

    it('sets resolved_at when status changes to resolved', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
        status: 'new',
      });

      const res = await request(app)
        .put(`/tickets/${created.body.id}`)
        .send({
          status: 'resolved',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.resolved_at).toBeDefined();
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(app)
        .put('/tickets/non-existent-id')
        .send({
          subject: 'Updated Subject',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  describe('DELETE /tickets/:id', () => {
    it('deletes a ticket and returns 204', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      const res = await request(app).delete(`/tickets/${created.body.id}`);

      expect(res.status).toBe(204);
    });

    it('removes the ticket from the store', async () => {
      const created = await request(app).post('/tickets').send({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      await request(app).delete(`/tickets/${created.body.id}`);

      const retrieved = await request(app).get(`/tickets/${created.body.id}`);
      expect(retrieved.status).toBe(404);
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(app).delete('/tickets/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  describe('Round-trip (CRUD cycle)', () => {
    it('create → read → update → delete works end-to-end', async () => {
      // CREATE
      const createRes = await request(app).post('/tickets').send({
        customer_email: 'cycle@example.com',
        subject: 'Cycle Test',
        description: 'Testing full cycle',
      });
      expect(createRes.status).toBe(201);
      const ticketId = createRes.body.id;

      // READ
      const readRes = await request(app).get(`/tickets/${ticketId}`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.id).toBe(ticketId);

      // UPDATE
      const updateRes = await request(app).put(`/tickets/${ticketId}`).send({
        subject: 'Updated Cycle Test',
        status: 'in_progress',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.subject).toBe('Updated Cycle Test');

      // DELETE
      const deleteRes = await request(app).delete(`/tickets/${ticketId}`);
      expect(deleteRes.status).toBe(204);

      // VERIFY DELETED
      const finalRes = await request(app).get(`/tickets/${ticketId}`);
      expect(finalRes.status).toBe(404);
    });
  });
})
