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
        description: 'D1',
      });

      const t2 = await request(app).post('/tickets').send({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
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
});
