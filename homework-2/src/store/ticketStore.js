import { v4 as uuidv4 } from 'uuid';

class TicketStore {
  constructor() {
    this.tickets = new Map();
  }

  /**
   * Create a new ticket with server-generated fields
   * @param {object} ticket - ticket data (customer_email, subject, description, etc.)
   * @returns {object} created ticket with id, created_at, updated_at, status
   */
  create(ticket) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const fullTicket = {
      id,
      ...ticket,
      status: ticket.status || 'new',
      created_at: now,
      updated_at: now,
    };
    this.tickets.set(id, fullTicket);
    return fullTicket;
  }

  /**
   * Get all tickets
   * @returns {array} array of all tickets
   */
  getAll() {
    return Array.from(this.tickets.values());
  }

  /**
   * Get a ticket by ID
   * @param {string} id - ticket ID
   * @returns {object|undefined} ticket or undefined if not found
   */
  getById(id) {
    return this.tickets.get(id);
  }

  /**
   * Update a ticket
   * @param {string} id - ticket ID
   * @param {object} updates - fields to update
   * @returns {object|undefined} updated ticket or undefined if not found
   */
  update(id, updates) {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;

    const updated = {
      ...ticket,
      ...updates,
      updated_at: new Date().toISOString(),
      id: ticket.id, // preserve original id
      created_at: ticket.created_at, // preserve original created_at
    };

    // Track resolved_at when status changes to 'resolved'
    if (updates.status === 'resolved' && ticket.status !== 'resolved') {
      updated.resolved_at = new Date().toISOString();
    }

    this.tickets.set(id, updated);
    return updated;
  }

  /**
   * Delete a ticket
   * @param {string} id - ticket ID
   * @returns {boolean} true if deleted, false if not found
   */
  delete(id) {
    return this.tickets.delete(id);
  }

  /**
   * Filter tickets by criteria
   * @param {object} criteria - filter criteria (category, priority, status, etc.)
   * @returns {array} filtered tickets
   */
  filter(criteria) {
    return this.getAll().filter((ticket) => {
      for (const [key, value] of Object.entries(criteria)) {
        if (ticket[key] !== value) return false;
      }
      return true;
    });
  }

  /**
   * Clear all tickets (for testing)
   */
  clear() {
    this.tickets.clear();
  }
}

export default new TicketStore();
