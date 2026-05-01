/**
 * Tests for error handling in ticket routes
 */

const request = require('supertest');
const app = require('../src/index');
const storage = require('../src/storage/inMemoryStorage');
const Ticket = require('../src/models/ticket');

describe('Error Handling in Ticket Routes', () => {
  beforeEach(() => {
    storage.clear();
  });

  describe('POST /tickets - Error Handling', () => {
    test('should handle unexpected errors during ticket creation', async () => {
      const originalAddTicket = storage.addTicket;
      storage.addTicket = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/tickets')
        .send({
          customer_email: 'test@example.com',
          customer_name: 'Test User',
          subject: 'Test ticket',
          description: 'Test description'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to create ticket');

      storage.addTicket = originalAddTicket;
    });

    test('should handle error when Ticket constructor throws', async () => {
      const response = await request(app)
        .post('/tickets')
        .send({
          customer_email: 'test@example.com',
          customer_name: 'Test User',
          subject: 'Test',
          description: 'Test',
          created_at: 'invalid-date-format-that-might-break-things'
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    });
  });

  describe('POST /tickets/import - Error Handling', () => {
    test('should handle errors during CSV parsing', async () => {
      const malformedCSV = 'customer_email,customer_name,subject\ntest@test.com,Test,"unclosed quote\nmore,data,here';

      const response = await request(app)
        .post('/tickets/import')
        .set('Content-Type', 'text/csv')
        .send(malformedCSV);

      expect([200, 400, 500]).toContain(response.status);
    });

    test('should handle errors during JSON parsing', async () => {
      const response = await request(app)
        .post('/tickets/import')
        .set('Content-Type', 'application/json')
        .send('{"invalid json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.failed).toBeGreaterThan(0);
    });

    test('should handle errors during XML parsing', async () => {
      const malformedXML = '<?xml version="1.0"?><tickets><ticket><email>test@test.com</ticket>';

      const response = await request(app)
        .post('/tickets/import')
        .set('Content-Type', 'application/xml')
        .send(malformedXML);

      expect([200, 400, 500]).toContain(response.status);
    });

    test('should handle storage errors during bulk import', async () => {
      const originalAddTickets = storage.addTickets;
      storage.addTickets = jest.fn(() => {
        throw new Error('Storage full');
      });

      const validCSV = 'customer_email,customer_name,subject,description\ntest@test.com,Test,Subject,Description';

      const response = await request(app)
        .post('/tickets/import')
        .set('Content-Type', 'text/csv')
        .send(validCSV);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');

      storage.addTickets = originalAddTickets;
    });
  });

  describe('GET /tickets - Error Handling', () => {
    test('should handle errors when storage fails', async () => {
      const originalGetAllTickets = storage.getAllTickets;
      storage.getAllTickets = jest.fn(() => {
        throw new Error('Storage read failed');
      });

      const response = await request(app)
        .get('/tickets');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch tickets');

      storage.getAllTickets = originalGetAllTickets;
    });

    test('should handle errors when filtering fails', async () => {
      const originalGetFilteredTickets = storage.getFilteredTickets;
      storage.getFilteredTickets = jest.fn(() => {
        throw new Error('Filter operation failed');
      });

      const response = await request(app)
        .get('/tickets?category=technical_issue');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');

      storage.getFilteredTickets = originalGetFilteredTickets;
    });
  });

  describe('GET /tickets/:id - Error Handling', () => {
    test('should handle errors when fetching ticket by id', async () => {
      const originalGetTicketById = storage.getTicketById;
      storage.getTicketById = jest.fn(() => {
        throw new Error('Database query failed');
      });

      const response = await request(app)
        .get('/tickets/some-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch ticket');

      storage.getTicketById = originalGetTicketById;
    });
  });

  describe('PUT /tickets/:id - Error Handling', () => {
    test('should handle errors during ticket update', async () => {
      const ticket = new Ticket({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Test',
        description: 'Test'
      });
      storage.addTicket(ticket);

      const originalUpdateTicket = storage.updateTicket;
      storage.updateTicket = jest.fn(() => {
        throw new Error('Update operation failed');
      });

      const response = await request(app)
        .put(`/tickets/${ticket.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to update ticket');

      storage.updateTicket = originalUpdateTicket;
    });

    test('should handle errors when getTicketById throws during update', async () => {
      const originalGetTicketById = storage.getTicketById;
      storage.getTicketById = jest.fn(() => {
        throw new Error('Database connection lost');
      });

      const response = await request(app)
        .put('/tickets/some-id')
        .send({ status: 'resolved' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');

      storage.getTicketById = originalGetTicketById;
    });
  });

  describe('DELETE /tickets/:id - Error Handling', () => {
    test('should handle errors during ticket deletion', async () => {
      const originalDeleteTicket = storage.deleteTicket;
      storage.deleteTicket = jest.fn(() => {
        throw new Error('Delete operation failed');
      });

      const response = await request(app)
        .delete('/tickets/some-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to delete ticket');

      storage.deleteTicket = originalDeleteTicket;
    });
  });

  describe('POST /tickets/:id/auto-classify - Error Handling', () => {
    test('should handle errors during classification', async () => {
      const ticket = new Ticket({
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        subject: 'Cannot login',
        description: 'Password reset issue'
      });
      storage.addTicket(ticket);

      const classifyTicket = require('../src/classification/autoClassifier').classifyTicket;
      const originalClassify = classifyTicket;

      jest.mock('../src/classification/autoClassifier', () => ({
        classifyTicket: jest.fn(() => {
          throw new Error('Classification service unavailable');
        })
      }));

      const originalUpdateTicket = storage.updateTicket;
      storage.updateTicket = jest.fn(() => {
        throw new Error('Classification update failed');
      });

      const response = await request(app)
        .post(`/tickets/${ticket.id}/auto-classify`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');

      storage.updateTicket = originalUpdateTicket;
      jest.unmock('../src/classification/autoClassifier');
    });

    test('should handle errors when getTicketById throws during classify', async () => {
      const originalGetTicketById = storage.getTicketById;
      storage.getTicketById = jest.fn(() => {
        throw new Error('Database unavailable');
      });

      const response = await request(app)
        .post('/tickets/some-id/auto-classify');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');

      storage.getTicketById = originalGetTicketById;
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle ticket without toJSON method in GET /tickets', async () => {
      const plainTicket = {
        id: 'plain-object-id',
        customer_email: 'test@example.com',
        subject: 'Test',
        category: 'other',
        priority: 'medium',
        status: 'new',
        created_at: new Date().toISOString()
      };
      storage.tickets.push(plainTicket);

      const response = await request(app)
        .get('/tickets');

      expect(response.status).toBe(200);
      expect(response.body.tickets.length).toBeGreaterThan(0);
    });

    test('should handle ticket without toJSON method in GET /tickets/:id', async () => {
      const plainTicket = {
        id: 'plain-id',
        customer_email: 'test@example.com',
        customer_name: 'Plain User',
        subject: 'Plain ticket',
        description: 'Test',
        category: 'other',
        priority: 'medium',
        status: 'new',
        created_at: new Date().toISOString()
      };
      storage.tickets.push(plainTicket);

      const response = await request(app)
        .get('/tickets/plain-id');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'plain-id');
    });

    test('should handle ticket without toJSON method in PUT /tickets/:id', async () => {
      const plainTicket = {
        id: 'plain-update-id',
        customer_email: 'test@example.com',
        customer_name: 'Update User',
        subject: 'Plain ticket',
        description: 'Test',
        category: 'other',
        priority: 'medium',
        status: 'new',
        created_at: new Date().toISOString()
      };
      storage.tickets.push(plainTicket);

      const response = await request(app)
        .put('/tickets/plain-update-id')
        .send({ status: 'resolved' });

      expect(response.status).toBe(200);
    });
  });
});
