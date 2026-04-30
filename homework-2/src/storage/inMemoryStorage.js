/**
 * Converts a date to end-of-day (23:59:59.999) to ensure inclusive date filtering.
 * Without this, tickets occurring ON the 'to' date would be excluded from date range queries.
 * @param {string|Date} date - The date to convert
 * @returns {Date} Date set to 23:59:59.999
 */
const getEndOfDay = (date) => {
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
};

/**
 * In-memory storage for tickets using singleton pattern.
 * Follows the pattern from Homework-1 InMemoryStorage.
 */
class InMemoryStorage {
  constructor() {
    this.tickets = [];
  }

  /**
   * Adds a new ticket to storage.
   * @param {Object} ticket - Ticket object to add
   * @returns {Object} The added ticket
   */
  addTicket = (ticket) => {
    this.tickets.push(ticket);
    return ticket;
  };

  /**
   * Adds multiple tickets to storage in bulk.
   * @param {Array} tickets - Array of ticket objects
   * @returns {number} Number of tickets added
   */
  addTickets = (tickets) => {
    this.tickets.push(...tickets);
    return tickets.length;
  };

  /**
   * Retrieves all tickets from storage.
   * @returns {Array} All tickets
   */
  getAllTickets = () => this.tickets;

  /**
   * Retrieves a ticket by ID.
   * @param {string} id - Ticket ID
   * @returns {Object|null} Ticket object or null if not found
   */
  getTicketById = (id) => this.tickets.find(t => t.id === id) || null;

  /**
   * Updates a ticket by ID.
   * @param {string} id - Ticket ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated ticket or null if not found
   */
  updateTicket = (id, updates) => {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        ticket[key] = updates[key];
      }
    });

    ticket.updated_at = new Date().toISOString();

    return ticket;
  };

  /**
   * Deletes a ticket by ID.
   * @param {string} id - Ticket ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteTicket = (id) => {
    const index = this.tickets.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.tickets.splice(index, 1);
    return true;
  };

  /**
   * Retrieves tickets filtered by various criteria.
   * @param {Object} filters - Filter criteria
   * @param {string} filters.category - Filter by category
   * @param {string} filters.priority - Filter by priority
   * @param {string} filters.status - Filter by status
   * @param {string} filters.from - Start date (inclusive)
   * @param {string} filters.to - End date (inclusive)
   * @returns {Array} Filtered tickets
   */
  getFilteredTickets = (filters = {}) => {
    return this.tickets.filter(t => {
      // Filter by category (case-insensitive)
      if (filters.category &&
          t.category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }

      // Filter by priority (case-insensitive)
      if (filters.priority &&
          t.priority.toLowerCase() !== filters.priority.toLowerCase()) {
        return false;
      }

      // Filter by status (case-insensitive)
      if (filters.status &&
          t.status.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Filter by date range
      const ticketDate = new Date(t.created_at);
      if (isNaN(ticketDate.getTime())) {
        console.error(`Invalid timestamp in ticket ${t.id}: ${t.created_at}`);
        return false;
      }

      if (filters.from && ticketDate < new Date(filters.from)) {
        return false;
      }

      if (filters.to && ticketDate > getEndOfDay(filters.to)) {
        return false;
      }

      return true;
    });
  };

  /**
   * Clears all tickets from storage.
   * Useful for testing.
   */
  clear = () => {
    this.tickets = [];
  };
}

// Export singleton instance
module.exports = new InMemoryStorage();
