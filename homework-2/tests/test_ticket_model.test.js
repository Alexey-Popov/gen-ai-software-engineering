const Ticket = require('../src/models/ticket');

describe('Ticket Model', () => {
  test('should create ticket with all fields', () => {
    const ticketData = {
      customer_id: 'CUST-001',
      customer_email: 'john@example.com',
      customer_name: 'John Doe',
      subject: 'Test Subject',
      description: 'This is a test description with enough characters',
      category: 'technical_issue',
      priority: 'high',
      status: 'in_progress',
      tags: ['test', 'urgent'],
      metadata: {
        source: 'web_form',
        browser: 'Chrome',
        device_type: 'desktop'
      }
    };

    const ticket = new Ticket(ticketData);

    expect(ticket.customer_id).toBe('CUST-001');
    expect(ticket.customer_email).toBe('john@example.com');
    expect(ticket.customer_name).toBe('John Doe');
    expect(ticket.subject).toBe('Test Subject');
    expect(ticket.description).toBe('This is a test description with enough characters');
    expect(ticket.category).toBe('technical_issue');
    expect(ticket.priority).toBe('high');
    expect(ticket.status).toBe('in_progress');
    expect(ticket.tags).toEqual(['test', 'urgent']);
    expect(ticket.metadata.source).toBe('web_form');
  });

  test('should auto-generate UUID if not provided', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here'
    });

    expect(ticket.id).toBeDefined();
    expect(typeof ticket.id).toBe('string');
    expect(ticket.id.length).toBeGreaterThan(0);
  });

  test('should auto-generate timestamps', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here'
    });

    expect(ticket.created_at).toBeDefined();
    expect(ticket.updated_at).toBeDefined();
    expect(new Date(ticket.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(ticket.updated_at).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('should default status to new', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here'
    });

    expect(ticket.status).toBe('new');
  });

  test('should handle metadata object properly', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here',
      metadata: {
        source: 'email',
        browser: 'Firefox',
        device_type: 'mobile'
      }
    });

    expect(ticket.metadata).toBeDefined();
    expect(ticket.metadata.source).toBe('email');
    expect(ticket.metadata.browser).toBe('Firefox');
    expect(ticket.metadata.device_type).toBe('mobile');
  });

  test('should handle tags array', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here',
      tags: ['urgent', 'bug', 'critical']
    });

    expect(Array.isArray(ticket.tags)).toBe(true);
    expect(ticket.tags).toHaveLength(3);
    expect(ticket.tags).toContain('urgent');
  });

  test('toJSON should return proper format', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here'
    });

    const json = ticket.toJSON();

    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('customer_email');
    expect(json).toHaveProperty('created_at');
    expect(json).toHaveProperty('metadata');
  });

  test('should normalize enums to lowercase', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here',
      category: 'TECHNICAL_ISSUE',
      priority: 'HIGH',
      status: 'NEW'
    });

    expect(ticket.category).toBe('technical_issue');
    expect(ticket.priority).toBe('high');
    expect(ticket.status).toBe('new');
  });

  test('should handle nullable fields', () => {
    const ticket = new Ticket({
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Test',
      description: 'Test description here'
    });

    expect(ticket.resolved_at).toBeNull();
    expect(ticket.assigned_to).toBeNull();
  });
});
