import { describe, it, expect, beforeEach } from 'vitest';
import ticketStore from '../../src/store/ticketStore.js';

describe('TicketStore', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  describe('create', () => {
    it('creates a ticket with server-generated fields', () => {
      const ticket = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test Issue',
        description: 'This is a test issue',
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.customer_email).toBe('test@example.com');
      expect(ticket.subject).toBe('Test Issue');
      expect(ticket.status).toBe('new');
      expect(ticket.created_at).toBeDefined();
      expect(ticket.updated_at).toBeDefined();
    });

    it('generates unique IDs', () => {
      const t1 = ticketStore.create({ customer_email: 'a@ex.com', subject: 'T1', description: 'D1' });
      const t2 = ticketStore.create({ customer_email: 'b@ex.com', subject: 'T2', description: 'D2' });
      expect(t1.id).not.toBe(t2.id);
    });

    it('sets status to provided value or defaults to "new"', () => {
      const t1 = ticketStore.create({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'D1',
      });
      expect(t1.status).toBe('new');

      const t2 = ticketStore.create({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
        status: 'in_progress',
      });
      expect(t2.status).toBe('in_progress');
    });

    it('stores the ticket in the Map', () => {
      const ticket = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
      });
      expect(ticketStore.getById(ticket.id)).toEqual(ticket);
    });
  });

  describe('getAll', () => {
    it('returns empty array when no tickets exist', () => {
      expect(ticketStore.getAll()).toEqual([]);
    });

    it('returns all created tickets', () => {
      const t1 = ticketStore.create({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'D1',
      });
      const t2 = ticketStore.create({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
      });

      const all = ticketStore.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(t1);
      expect(all).toContainEqual(t2);
    });
  });

  describe('getById', () => {
    it('returns the ticket by ID', () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
      });

      const retrieved = ticketStore.getById(created.id);
      expect(retrieved).toEqual(created);
    });

    it('returns undefined for non-existent ID', () => {
      expect(ticketStore.getById('non-existent-id')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates ticket fields and bumps updated_at', async () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
      });

      const createdAt = created.created_at;
      const updatedAt = created.updated_at;

      // Wait a tiny bit to ensure timestamps differ
      await new Promise((r) => setTimeout(r, 10));

      const updated = ticketStore.update(created.id, {
        subject: 'Updated Subject',
      });

      expect(updated.subject).toBe('Updated Subject');
      expect(updated.customer_email).toBe('test@example.com');
      expect(updated.created_at).toBe(createdAt);
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(updatedAt).getTime()
      );
    });

    it('preserves id and created_at on update', () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
      });

      const updated = ticketStore.update(created.id, { status: 'in_progress' });

      expect(updated.id).toBe(created.id);
      expect(updated.created_at).toBe(created.created_at);
    });

    it('sets resolved_at when status changes to resolved', () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
        status: 'new',
      });

      expect(created.resolved_at).toBeUndefined();

      const updated = ticketStore.update(created.id, {
        status: 'resolved',
      });

      expect(updated.resolved_at).toBeDefined();
      expect(updated.status).toBe('resolved');
    });

    it('does not set resolved_at on other status changes', () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
        status: 'new',
      });

      const updated = ticketStore.update(created.id, {
        status: 'in_progress',
      });

      expect(updated.resolved_at).toBeUndefined();
    });

    it('returns undefined for non-existent ID', () => {
      expect(ticketStore.update('non-existent-id', { status: 'in_progress' })).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes a ticket', () => {
      const created = ticketStore.create({
        customer_email: 'test@example.com',
        subject: 'Test',
        description: 'Test description',
      });

      const deleted = ticketStore.delete(created.id);
      expect(deleted).toBe(true);
      expect(ticketStore.getById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent ID', () => {
      expect(ticketStore.delete('non-existent-id')).toBe(false);
    });

    it('removes from getAll', () => {
      const t1 = ticketStore.create({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'D1',
      });
      const t2 = ticketStore.create({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
      });

      ticketStore.delete(t1.id);

      const all = ticketStore.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(t2);
    });
  });

  describe('filter', () => {
    beforeEach(() => {
      ticketStore.create({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'D1',
        category: 'billing',
        priority: 'high',
        status: 'new',
      });
      ticketStore.create({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
        category: 'technical',
        priority: 'low',
        status: 'in_progress',
      });
      ticketStore.create({
        customer_email: 'c@ex.com',
        subject: 'T3',
        description: 'D3',
        category: 'billing',
        priority: 'high',
        status: 'resolved',
      });
    });

    it('filters by single criterion', () => {
      const filtered = ticketStore.filter({ category: 'billing' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((t) => t.category === 'billing')).toBe(true);
    });

    it('filters by multiple criteria', () => {
      const filtered = ticketStore.filter({ category: 'billing', priority: 'high' });
      expect(filtered).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      const filtered = ticketStore.filter({ category: 'other' });
      expect(filtered).toEqual([]);
    });

    it('returns all tickets when filter is empty', () => {
      const filtered = ticketStore.filter({});
      expect(filtered).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('removes all tickets', () => {
      ticketStore.create({
        customer_email: 'a@ex.com',
        subject: 'T1',
        description: 'D1',
      });
      ticketStore.create({
        customer_email: 'b@ex.com',
        subject: 'T2',
        description: 'D2',
      });

      ticketStore.clear();
      expect(ticketStore.getAll()).toEqual([]);
    });
  });
});
