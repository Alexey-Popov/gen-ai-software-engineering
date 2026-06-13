import { v4 as uuidv4 } from 'uuid';
import { Ticket, CreateTicketPayload, UpdateTicketPayload, Status, Category, Priority } from '../models/ticket';
import { validateCreateTicket, validateUpdateTicket } from '../validators/ticket-validator';

export interface FilterOptions {
  category?: Category;
  priority?: Priority;
  status?: Status;
  customer_id?: string;
  assigned_to?: string;
}

const store = new Map<string, Ticket>();

export function createTicket(payload: CreateTicketPayload): Ticket {
  const validated = validateCreateTicket(payload);
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: uuidv4(),
    customer_id: validated.customer_id,
    customer_email: validated.customer_email,
    customer_name: validated.customer_name,
    subject: validated.subject,
    description: validated.description,
    status: validated.status ?? Status.New,
    created_at: now,
    updated_at: now,
    ...(validated.category != null && { category: validated.category }),
    ...(validated.priority != null && { priority: validated.priority }),
    ...(validated.assigned_to !== undefined && { assigned_to: validated.assigned_to }),
    ...(validated.tags !== undefined && { tags: validated.tags }),
    ...(validated.metadata !== undefined && { metadata: validated.metadata }),
  };
  store.set(ticket.id, ticket);
  return ticket;
}

export function getTicket(id: string): Ticket | null {
  return store.get(id) ?? null;
}

export function getAllTickets(filters?: FilterOptions): Ticket[] {
  let tickets = Array.from(store.values());
  if (!filters) return tickets;

  if (filters.category !== undefined) {
    tickets = tickets.filter(t => t.category === filters.category);
  }
  if (filters.priority !== undefined) {
    tickets = tickets.filter(t => t.priority === filters.priority);
  }
  if (filters.status !== undefined) {
    tickets = tickets.filter(t => t.status === filters.status);
  }
  if (filters.customer_id !== undefined) {
    tickets = tickets.filter(t => t.customer_id === filters.customer_id);
  }
  if (filters.assigned_to !== undefined) {
    tickets = tickets.filter(t => t.assigned_to === filters.assigned_to);
  }
  return tickets;
}

export function updateTicket(id: string, updates: Partial<UpdateTicketPayload>): Ticket | null {
  const existing = store.get(id);
  if (!existing) return null;

  const validated = validateUpdateTicket(updates, existing);
  const updated: Ticket = {
    ...existing,
    ...validated,
    updated_at: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

export function deleteTicket(id: string): boolean {
  return store.delete(id);
}

export function resolveTicket(id: string, assignedTo?: string): Ticket | null {
  const existing = store.get(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Ticket = {
    ...existing,
    status: Status.Resolved,
    resolved_at: now,
    updated_at: now,
    ...(assignedTo !== undefined && { assigned_to: assignedTo }),
  };
  store.set(id, updated);
  return updated;
}

// Exposed for testing: clear all tickets from the store
export function clearStore(): void {
  store.clear();
}
