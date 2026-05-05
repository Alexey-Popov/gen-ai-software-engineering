import { describe, it, expect, beforeEach } from 'vitest';
import ticketStore from '../../src/store/ticketStore.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const baseTicket = {
  customer_email: 'a@example.com',
  subject: 'Subject',
  description: 'A valid description over ten characters',
};

describe('Ticket model contract', () => {
  beforeEach(() => {
    ticketStore.clear();
  });

  describe('defaults', () => {
    it('defaults status to "new" when not provided', () => {
      const ticket = ticketStore.create(baseTicket);
      expect(ticket.status).toBe('new');
    });

    it('preserves a caller-provided status', () => {
      const ticket = ticketStore.create({ ...baseTicket, status: 'in_progress' });
      expect(ticket.status).toBe('in_progress');
    });

    it('does not invent fields the caller did not provide (no metadata, no tags, no resolved_at)', () => {
      const ticket = ticketStore.create(baseTicket);
      expect(ticket.metadata).toBeUndefined();
      expect(ticket.tags).toBeUndefined();
      expect(ticket.resolved_at).toBeUndefined();
    });
  });

  describe('server-generated fields', () => {
    it('generates id in UUID v4 format', () => {
      const ticket = ticketStore.create(baseTicket);
      expect(ticket.id).toMatch(UUID_V4);
    });

    it('generates ISO 8601 created_at and updated_at timestamps', () => {
      const ticket = ticketStore.create(baseTicket);
      expect(ticket.created_at).toMatch(ISO_8601);
      expect(ticket.updated_at).toMatch(ISO_8601);
    });

    it('sets created_at and updated_at to the same value on create', () => {
      const ticket = ticketStore.create(baseTicket);
      expect(ticket.created_at).toBe(ticket.updated_at);
    });
  });

  describe('immutability', () => {
    it('ignores caller-supplied id on create (always uses server-generated)', () => {
      const ticket = ticketStore.create({ ...baseTicket, id: 'caller-supplied-id' });
      expect(ticket.id).not.toBe('caller-supplied-id');
      expect(ticket.id).toMatch(UUID_V4);
    });

    it('preserves id and created_at across updates', () => {
      const created = ticketStore.create(baseTicket);
      const updated = ticketStore.update(created.id, {
        id: 'attempted-rewrite',
        created_at: '1999-01-01T00:00:00.000Z',
        subject: 'Updated subject',
      });
      expect(updated.id).toBe(created.id);
      expect(updated.created_at).toBe(created.created_at);
      expect(updated.subject).toBe('Updated subject');
    });
  });

  describe('lifecycle timestamps', () => {
    it('bumps updated_at on update and stamps resolved_at when status flips to "resolved"', async () => {
      const created = ticketStore.create(baseTicket);
      // small wait so the next ISO timestamp differs from created_at
      await new Promise((r) => setTimeout(r, 5));

      const updated = ticketStore.update(created.id, { status: 'resolved' });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(created.updated_at).getTime()
      );
      expect(updated.resolved_at).toMatch(ISO_8601);
      expect(updated.status).toBe('resolved');
    });
  });
});
