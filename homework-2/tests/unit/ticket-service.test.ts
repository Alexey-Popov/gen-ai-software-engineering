import {
  createTicket,
  getTicket,
  getAllTickets,
  updateTicket,
  deleteTicket,
  resolveTicket,
  clearStore,
} from '../../src/services/ticket-service';
import { Category, Priority, Status } from '../../src/models/ticket';
import { ValidationError } from '../../src/validators/ticket-validator';

const basePayload = {
  customer_id: 'cust-001',
  customer_email: 'test@example.com',
  customer_name: 'Test User',
  subject: 'Cannot access my account',
  description: 'I have been locked out of my account for two days.',
  category: Category.AccountAccess,
  priority: Priority.High,
};

beforeEach(() => {
  clearStore();
});

// ─── createTicket ──────────────────────────────────────────────────────────

describe('createTicket', () => {
  it('creates a ticket and returns it with auto-generated fields', () => {
    const ticket = createTicket(basePayload);
    expect(ticket.id).toBeTruthy();
    expect(ticket.customer_id).toBe('cust-001');
    expect(ticket.status).toBe(Status.New);
    expect(ticket.created_at).toBeTruthy();
    expect(ticket.updated_at).toBeTruthy();
  });

  it('stores the created ticket so it can be retrieved', () => {
    const ticket = createTicket(basePayload);
    expect(getTicket(ticket.id)).toEqual(ticket);
  });

  it('uses the provided status when supplied', () => {
    const ticket = createTicket({ ...basePayload, status: Status.InProgress });
    expect(ticket.status).toBe(Status.InProgress);
  });

  it('includes optional fields when provided', () => {
    const ticket = createTicket({
      ...basePayload,
      assigned_to: 'agent-1',
      tags: ['vip'],
    });
    expect(ticket.assigned_to).toBe('agent-1');
    expect(ticket.tags).toEqual(['vip']);
  });

  it('generates unique IDs for successive tickets', () => {
    const t1 = createTicket(basePayload);
    const t2 = createTicket(basePayload);
    expect(t1.id).not.toBe(t2.id);
  });

  it('throws ValidationError for an invalid payload', () => {
    expect(() =>
      createTicket({ ...basePayload, customer_email: 'not-an-email' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when required fields are missing', () => {
    expect(() => createTicket({} as Parameters<typeof createTicket>[0])).toThrow(ValidationError);
  });
});

// ─── getTicket ─────────────────────────────────────────────────────────────

describe('getTicket', () => {
  it('returns the ticket when it exists', () => {
    const ticket = createTicket(basePayload);
    expect(getTicket(ticket.id)).toEqual(ticket);
  });

  it('returns null for a non-existent id', () => {
    expect(getTicket('does-not-exist')).toBeNull();
  });
});

// ─── getAllTickets ─────────────────────────────────────────────────────────

describe('getAllTickets', () => {
  it('returns all tickets when no filters are provided', () => {
    createTicket(basePayload);
    createTicket(basePayload);
    expect(getAllTickets()).toHaveLength(2);
  });

  it('returns an empty array when the store is empty', () => {
    expect(getAllTickets()).toHaveLength(0);
  });

  it('filters by category', () => {
    createTicket({ ...basePayload, category: Category.BillingQuestion });
    createTicket({ ...basePayload, category: Category.TechnicalIssue });
    const result = getAllTickets({ category: Category.BillingQuestion });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe(Category.BillingQuestion);
  });

  it('filters by priority', () => {
    createTicket({ ...basePayload, priority: Priority.Urgent });
    createTicket({ ...basePayload, priority: Priority.Low });
    expect(getAllTickets({ priority: Priority.Urgent })).toHaveLength(1);
  });

  it('filters by status', () => {
    createTicket({ ...basePayload, status: Status.Resolved });
    createTicket(basePayload);
    expect(getAllTickets({ status: Status.Resolved })).toHaveLength(1);
  });

  it('filters by customer_id', () => {
    createTicket({ ...basePayload, customer_id: 'cust-A' });
    createTicket({ ...basePayload, customer_id: 'cust-B' });
    expect(getAllTickets({ customer_id: 'cust-A' })).toHaveLength(1);
  });

  it('filters by assigned_to', () => {
    createTicket({ ...basePayload, assigned_to: 'agent-1' });
    createTicket({ ...basePayload, assigned_to: 'agent-2' });
    expect(getAllTickets({ assigned_to: 'agent-1' })).toHaveLength(1);
  });

  it('returns empty when filter matches nothing', () => {
    createTicket(basePayload);
    expect(getAllTickets({ status: Status.Closed })).toHaveLength(0);
  });
});

// ─── updateTicket ──────────────────────────────────────────────────────────

describe('updateTicket', () => {
  it('updates specified fields and returns the updated ticket', () => {
    const ticket = createTicket(basePayload);
    const updated = updateTicket(ticket.id, { subject: 'New subject here' });
    expect(updated).not.toBeNull();
    expect(updated!.subject).toBe('New subject here');
  });

  it('leaves unspecified fields unchanged', () => {
    const ticket = createTicket(basePayload);
    const updated = updateTicket(ticket.id, { priority: Priority.Low });
    expect(updated!.customer_email).toBe(basePayload.customer_email);
    expect(updated!.category).toBe(basePayload.category);
  });

  it('updates the updated_at timestamp', async () => {
    const ticket = createTicket(basePayload);
    await new Promise(r => setTimeout(r, 5));
    const updated = updateTicket(ticket.id, { priority: Priority.Low });
    expect(updated!.updated_at).not.toBe(ticket.updated_at);
  });

  it('persists the update in the store', () => {
    const ticket = createTicket(basePayload);
    updateTicket(ticket.id, { priority: Priority.Urgent });
    expect(getTicket(ticket.id)!.priority).toBe(Priority.Urgent);
  });

  it('returns null for a non-existent id', () => {
    expect(updateTicket('ghost-id', { priority: Priority.Low })).toBeNull();
  });

  it('throws ValidationError for invalid update data', () => {
    const ticket = createTicket(basePayload);
    expect(() =>
      updateTicket(ticket.id, { customer_email: 'bad-email' })
    ).toThrow(ValidationError);
  });
});

// ─── deleteTicket ──────────────────────────────────────────────────────────

describe('deleteTicket', () => {
  it('removes the ticket and returns true', () => {
    const ticket = createTicket(basePayload);
    expect(deleteTicket(ticket.id)).toBe(true);
    expect(getTicket(ticket.id)).toBeNull();
  });

  it('returns false when the ticket does not exist', () => {
    expect(deleteTicket('not-here')).toBe(false);
  });
});

// ─── resolveTicket ─────────────────────────────────────────────────────────

describe('resolveTicket', () => {
  it('sets status to resolved and adds resolved_at', () => {
    const ticket = createTicket(basePayload);
    const resolved = resolveTicket(ticket.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe(Status.Resolved);
    expect(resolved!.resolved_at).toBeTruthy();
  });

  it('optionally sets assigned_to', () => {
    const ticket = createTicket(basePayload);
    const resolved = resolveTicket(ticket.id, 'supervisor');
    expect(resolved!.assigned_to).toBe('supervisor');
  });

  it('updates updated_at', async () => {
    const ticket = createTicket(basePayload);
    await new Promise(r => setTimeout(r, 5));
    const resolved = resolveTicket(ticket.id);
    expect(resolved!.updated_at).not.toBe(ticket.updated_at);
  });

  it('persists resolved state in the store', () => {
    const ticket = createTicket(basePayload);
    resolveTicket(ticket.id);
    expect(getTicket(ticket.id)!.status).toBe(Status.Resolved);
  });

  it('returns null for a non-existent id', () => {
    expect(resolveTicket('no-ticket')).toBeNull();
  });
});
