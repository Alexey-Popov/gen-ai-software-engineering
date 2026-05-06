const { createTicket, getTickets, getTicketById, updateTicket, deleteTicket, clearTickets, validateTicket } = require('../src/models/ticket');

beforeEach(() => {
  clearTickets();
});

describe('Ticket Model', () => {
  const validData = {
    customer_email: 'test@example.com',
    subject: 'Valid Subject',
    description: 'This is a valid description that is long enough.'
  };

  test('validateTicket: valid data returns no errors', () => {
    expect(validateTicket(validData)).toEqual([]);
  });

  test('validateTicket: invalid email', () => {
    expect(validateTicket({ ...validData, customer_email: 'invalid' })).toContain('Invalid customer_email');
  });

  test('validateTicket: invalid subject length', () => {
    expect(validateTicket({ ...validData, subject: '' })).toContain('Subject must be 1-200 chars');
  });

  test('validateTicket: invalid description length', () => {
    expect(validateTicket({ ...validData, description: 'short' })).toContain('Description must be 10-2000 chars');
  });

  test('validateTicket: invalid category', () => {
    expect(validateTicket({ ...validData, category: 'invalid_cat' })).toContain('Invalid category. Must be one of: account_access, technical_issue, billing_question, feature_request, bug_report, other');
  });

  test('validateTicket: invalid priority', () => {
    expect(validateTicket({ ...validData, priority: 'super_urgent' })).toContain('Invalid priority. Must be one of: urgent, high, medium, low');
  });

  test('createTicket: creates a ticket and adds to array', () => {
    const ticket = createTicket(validData);
    expect(ticket).toBeDefined();
    expect(ticket.id).toBeDefined();
    expect(getTickets().length).toBe(1);
  });

  test('updateTicket: updates properties and updated_at', () => {
    const ticket = createTicket(validData);
    const updated = updateTicket(ticket.id, { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');
  });

  test('deleteTicket: removes ticket from array', () => {
    const ticket = createTicket(validData);
    const res = deleteTicket(ticket.id);
    expect(res).toBe(true);
    expect(getTickets().length).toBe(0);
  });
});
