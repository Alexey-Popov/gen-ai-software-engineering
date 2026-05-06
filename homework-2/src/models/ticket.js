const crypto = require('crypto');

let tickets = [];

const CATEGORIES = ['account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

function validateTicket(data) {
  const errors = [];
  if (!data.customer_email || !/^.+@.+\..+$/.test(data.customer_email)) {
    errors.push('Invalid customer_email');
  }
  if (!data.subject || data.subject.length < 1 || data.subject.length > 200) {
    errors.push('Subject must be 1-200 chars');
  }
  if (!data.description || data.description.length < 10 || data.description.length > 2000) {
    errors.push('Description must be 10-2000 chars');
  }
  if (data.category && !CATEGORIES.includes(data.category)) {
    errors.push(`Invalid category. Must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (data.priority && !PRIORITIES.includes(data.priority)) {
    errors.push(`Invalid priority. Must be one of: ${PRIORITIES.join(', ')}`);
  }
  return errors;
}

function createTicket(data) {
  const errors = validateTicket(data);
  if (errors.length > 0) throw new Error(errors.join(', '));

  const ticket = {
    id: crypto.randomUUID(),
    customer_id: data.customer_id || '',
    customer_email: data.customer_email,
    customer_name: data.customer_name || '',
    subject: data.subject,
    description: data.description,
    category: data.category || 'other',
    priority: data.priority || 'medium',
    status: data.status || 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resolved_at: null,
    assigned_to: data.assigned_to || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    metadata: {
      source: data.metadata?.source || 'api',
      browser: data.metadata?.browser || '',
      device_type: data.metadata?.device_type || 'desktop'
    }
  };
  tickets.push(ticket);
  return ticket;
}

function getTickets(filters = {}) {
  let result = tickets;
  if (filters.category) result = result.filter(t => t.category === filters.category);
  if (filters.priority) result = result.filter(t => t.priority === filters.priority);
  return result;
}

function getTicketById(id) {
  return tickets.find(t => t.id === id);
}

function updateTicket(id, data) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  
  Object.assign(ticket, data);
  ticket.updated_at = new Date().toISOString();
  if (data.status === 'resolved' || data.status === 'closed') {
    if (!ticket.resolved_at) ticket.resolved_at = new Date().toISOString();
  }
  return ticket;
}

function deleteTicket(id) {
  const idx = tickets.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tickets.splice(idx, 1);
  return true;
}

function clearTickets() {
  tickets = [];
}

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  clearTickets,
  validateTicket
};
