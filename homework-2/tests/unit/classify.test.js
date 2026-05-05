import { describe, it, expect } from 'vitest';
import { classify } from '../../src/classifier/classify.js';

describe('classify', () => {
  describe('categories', () => {
    it('detects account_access via "login" keyword', () => {
      const out = classify({
        subject: 'Cannot log in',
        description: 'Login form fails when I press submit',
      });
      expect(out.category).toBe('account_access');
      expect(out.keywords).toContain('login');
    });

    it('detects account_access via "reset password" phrase', () => {
      const out = classify({
        subject: 'Password help',
        description: 'I tried to reset password yesterday and the email never arrived',
      });
      expect(out.category).toBe('account_access');
    });

    it('detects technical_issue via "error" + "crash"', () => {
      const out = classify({
        subject: 'App crash',
        description: 'I get an error and the dashboard crashes when filtering',
      });
      expect(out.category).toBe('technical_issue');
    });

    it('detects billing_question via "refund" + "invoice"', () => {
      const out = classify({
        subject: 'Refund please',
        description: 'I was charged twice on the same invoice last month',
      });
      expect(out.category).toBe('billing_question');
    });

    it('detects feature_request via "would like" phrase', () => {
      const out = classify({
        subject: 'Wishlist',
        description: 'I would like CSV export to include the metadata column',
      });
      expect(out.category).toBe('feature_request');
    });

    it('detects bug_report via "steps to reproduce" phrase', () => {
      const out = classify({
        subject: 'Defect with reproduction',
        description: 'Steps to reproduce: open dashboard, click filter, see error',
      });
      expect(out.category).toBe('bug_report');
    });

    it('falls back to "other" when no category keyword matches', () => {
      const out = classify({
        subject: 'Just saying hi',
        description: 'No particular topic, just wanted to say hello to your team',
      });
      expect(out.category).toBe('other');
    });
  });

  describe('priorities', () => {
    it('detects urgent via "production down" phrase', () => {
      const out = classify({
        subject: 'Outage',
        description: 'Production down — none of our users can access the dashboard',
      });
      expect(out.priority).toBe('urgent');
    });

    it('detects high via "asap" keyword', () => {
      const out = classify({
        subject: 'Need help asap',
        description: 'This is blocking the demo we have tomorrow morning',
      });
      expect(out.priority).toBe('high');
    });

    it('detects low via "minor" keyword', () => {
      const out = classify({
        subject: 'Cosmetic tweak',
        description: 'Minor copy issue on the about page footer area',
      });
      expect(out.priority).toBe('low');
    });
  });

  describe('output shape', () => {
    it('returns confidence in [0, 1]', () => {
      const out = classify({ subject: 'Login error', description: 'Cannot log in to my account' });
      expect(out.confidence).toBeGreaterThanOrEqual(0);
      expect(out.confidence).toBeLessThanOrEqual(1);
    });

    it('returns reasoning that mentions the chosen labels', () => {
      const out = classify({ subject: 'Login fails', description: 'Cannot access my account' });
      expect(out.reasoning).toMatch(/category=account_access/);
    });

    it('handles empty / missing input gracefully', () => {
      const out = classify({});
      expect(out.category).toBe('other');
      expect(out.priority).toBe('medium');
      expect(out.confidence).toBe(0);
      expect(out.keywords).toEqual([]);
    });
  });
});
