import { describe, it, expect } from 'vitest';
import {
  validateTicket,
  validateTicketOrThrow,
  validateTicketPartial,
  validateTicketPartialOrThrow,
} from '../../src/validators/ticketValidator.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('Ticket Validator', () => {
  describe('validateTicket', () => {
    it('returns empty array for valid ticket', () => {
      const ticket = {
        customer_email: 'test@example.com',
        customer_name: 'John Doe',
        customer_id: 'cust123',
        subject: 'Test Subject',
        description: 'This is a detailed description of the issue',
        category: 'technical_issue',
        priority: 'high',
        status: 'new',
        assigned_to: 'agent1',
        tags: ['urgent', 'security'],
        metadata: {
          source: 'web_form',
          device_type: 'mobile',
          browser: 'Chrome',
        },
      };

      const errors = validateTicket(ticket);
      expect(errors).toEqual([]);
    });

    describe('customer_email', () => {
      it('requires customer_email', () => {
        const errors = validateTicket({ subject: 'Test', description: 'Test description' });
        expect(errors).toContain('customer_email is required');
      });

      it('validates email format', () => {
        const errors = validateTicket({
          customer_email: 'invalid-email',
          subject: 'Test',
          description: 'Test description',
        });
        expect(errors).toContain('customer_email must be a valid email address');
      });

      it('accepts valid emails', () => {
        const errors = validateTicket({
          customer_email: 'valid@example.com',
          subject: 'Test',
          description: 'Test description',
        });
        expect(errors).not.toContain('customer_email must be a valid email address');
      });
    });

    describe('subject', () => {
      it('requires subject', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          description: 'Test description',
        });
        expect(errors).toContain('subject is required');
      });

      it('validates subject length (1-200)', () => {
        const tooLong = 'x'.repeat(201);
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: tooLong,
          description: 'Test description',
        });
        expect(errors).toContain('subject must be 1-200 characters');
      });

      it('accepts valid subject', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Valid Subject',
          description: 'Test description',
        });
        expect(errors).not.toContain('subject must be 1-200 characters');
      });
    });

    describe('description', () => {
      it('requires description', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
        });
        expect(errors).toContain('description is required');
      });

      it('validates description length (10-2000)', () => {
        const tooShort = 'short';
        const errors1 = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: tooShort,
        });
        expect(errors1).toContain('description must be 10-2000 characters');

        const tooLong = 'x'.repeat(2001);
        const errors2 = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: tooLong,
        });
        expect(errors2).toContain('description must be 10-2000 characters');
      });

      it('accepts valid description', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Valid description that is 10-2000 chars',
        });
        expect(errors).not.toContain('description must be 10-2000 characters');
      });
    });

    describe('category enum', () => {
      it('accepts valid categories', () => {
        const categories = [
          'account_access',
          'technical_issue',
          'billing_question',
          'feature_request',
          'bug_report',
          'other',
        ];
        categories.forEach((cat) => {
          const errors = validateTicket({
            customer_email: 'test@ex.com',
            subject: 'Test',
            description: 'Test description',
            category: cat,
          });
          expect(errors).not.toContain(`category must be one of:`);
        });
      });

      it('rejects invalid category', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
          category: 'invalid_category',
        });
        expect(errors.some((e) => e.includes('category must be one of:'))).toBe(true);
      });

      it('allows null/undefined category', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
        });
        expect(errors.some((e) => e.includes('category'))).toBe(false);
      });
    });

    describe('priority enum', () => {
      it('accepts valid priorities', () => {
        const priorities = ['urgent', 'high', 'medium', 'low'];
        priorities.forEach((pri) => {
          const errors = validateTicket({
            customer_email: 'test@ex.com',
            subject: 'Test',
            description: 'Test description',
            priority: pri,
          });
          expect(errors).not.toContain(`priority must be one of:`);
        });
      });

      it('rejects invalid priority', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
          priority: 'super_urgent',
        });
        expect(errors.some((e) => e.includes('priority must be one of:'))).toBe(true);
      });
    });

    describe('status enum', () => {
      it('accepts valid statuses', () => {
        const statuses = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
        statuses.forEach((status) => {
          const errors = validateTicket({
            customer_email: 'test@ex.com',
            subject: 'Test',
            description: 'Test description',
            status,
          });
          expect(errors).not.toContain(`status must be one of:`);
        });
      });

      it('rejects invalid status', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
          status: 'completed',
        });
        expect(errors.some((e) => e.includes('status must be one of:'))).toBe(true);
      });
    });

    describe('metadata.source', () => {
      it('accepts valid sources', () => {
        const sources = ['web_form', 'email', 'api', 'chat', 'phone'];
        sources.forEach((source) => {
          const errors = validateTicket({
            customer_email: 'test@ex.com',
            subject: 'Test',
            description: 'Test description',
            metadata: { source },
          });
          expect(errors).not.toContain(`metadata.source must be one of:`);
        });
      });

      it('rejects invalid source', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
          metadata: { source: 'fax' },
        });
        expect(errors.some((e) => e.includes('metadata.source'))).toBe(true);
      });
    });

    describe('metadata.device_type', () => {
      it('accepts valid device types', () => {
        const types = ['desktop', 'mobile', 'tablet'];
        types.forEach((type) => {
          const errors = validateTicket({
            customer_email: 'test@ex.com',
            subject: 'Test',
            description: 'Test description',
            metadata: { device_type: type },
          });
          expect(errors).not.toContain(`metadata.device_type must be one of:`);
        });
      });

      it('rejects invalid device type', () => {
        const errors = validateTicket({
          customer_email: 'test@ex.com',
          subject: 'Test',
          description: 'Test description',
          metadata: { device_type: 'watch' },
        });
        expect(errors.some((e) => e.includes('metadata.device_type'))).toBe(true);
      });
    });

    it('collects multiple errors (no fail-fast)', () => {
      const errors = validateTicket({
        customer_email: 'invalid',
        subject: '', // too short
        description: 'short', // too short
        category: 'invalid',
        priority: 'critical',
        status: 'pending',
      });

      expect(errors.length).toBeGreaterThan(3);
      expect(errors.some((e) => e.includes('customer_email'))).toBe(true);
      expect(errors.some((e) => e.includes('subject'))).toBe(true);
      expect(errors.some((e) => e.includes('description'))).toBe(true);
      expect(errors.some((e) => e.includes('category'))).toBe(true);
      expect(errors.some((e) => e.includes('priority'))).toBe(true);
      expect(errors.some((e) => e.includes('status'))).toBe(true);
    });
  });

  describe('validateTicketOrThrow', () => {
    it('throws ValidationError with details array', () => {
      expect(() => {
        validateTicketOrThrow({
          customer_email: 'invalid',
          subject: 'x',
          description: 'short',
        });
      }).toThrow(ValidationError);
    });

    it('does not throw for valid ticket', () => {
      expect(() => {
        validateTicketOrThrow({
          customer_email: 'test@ex.com',
          subject: 'Valid Subject',
          description: 'Valid description here',
        });
      }).not.toThrow();
    });

    it('thrown error has details array with all errors', () => {
      try {
        validateTicketOrThrow({
          customer_email: 'invalid',
          subject: '',
          description: 'short',
        });
      } catch (err) {
        expect(err instanceof ValidationError).toBe(true);
        expect(Array.isArray(err.details)).toBe(true);
        expect(err.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateTicketPartial (for updates)', () => {
    it('allows partial updates with only some fields', () => {
      const errors = validateTicketPartial({ subject: 'Updated Subject' });
      expect(errors).toEqual([]);
    });

    it('allows multiple partial fields', () => {
      const errors = validateTicketPartial({
        subject: 'Updated',
        priority: 'high',
        status: 'in_progress',
      });
      expect(errors).toEqual([]);
    });

    it('validates provided fields without requiring all', () => {
      const errors = validateTicketPartial({
        customer_email: 'invalid-email',
      });
      expect(errors).toContain('customer_email must be a valid email address');
    });

    it('allows empty object (no-op update)', () => {
      const errors = validateTicketPartial({});
      expect(errors).toEqual([]);
    });

    it('validates enum fields in partial updates', () => {
      const errors = validateTicketPartial({
        priority: 'invalid_priority',
      });
      expect(errors.some((e) => e.includes('priority'))).toBe(true);
    });

    it('does not require missing fields', () => {
      const errors = validateTicketPartial({
        subject: 'Valid Subject',
      });
      expect(errors).not.toContain('description is required');
      expect(errors).not.toContain('customer_email is required');
    });

    it('validates length constraints on provided fields', () => {
      const errors = validateTicketPartial({
        subject: 'x'.repeat(201),
      });
      expect(errors).toContain('subject must be 1-200 characters');
    });
  });

  describe('validateTicketPartialOrThrow', () => {
    it('does not throw for valid partial update', () => {
      expect(() => {
        validateTicketPartialOrThrow({ subject: 'Updated', priority: 'high' });
      }).not.toThrow();
    });

    it('throws ValidationError for invalid partial data', () => {
      expect(() => {
        validateTicketPartialOrThrow({ priority: 'invalid' });
      }).toThrow(ValidationError);
    });

    it('allows empty object (no-op update)', () => {
      expect(() => {
        validateTicketPartialOrThrow({});
      }).not.toThrow();
    });
  });
});
