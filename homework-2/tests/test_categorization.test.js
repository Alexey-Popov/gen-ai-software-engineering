const { classifyTicket } = require('../src/classification/autoClassifier');

describe('Auto-Classification', () => {
  test('should classify account_access category', () => {
    const ticket = {
      subject: 'Cannot login to my account',
      description: 'I forgot my password and cannot access my account. Need help with password reset.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('account_access');
    expect(result.keywords_found.length).toBeGreaterThan(0);
    expect(result.keywords_found).toContain('login');
    expect(result.keywords_found).toContain('password');
  });

  test('should classify technical_issue category', () => {
    const ticket = {
      subject: 'Application crashes on startup',
      description: 'The app is not working and crashes every time I try to open it. Getting error 500.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('technical_issue');
    expect(result.keywords_found).toEqual(
      expect.arrayContaining(['crash', 'not working', 'error'])
    );
  });

  test('should classify billing_question category', () => {
    const ticket = {
      subject: 'Question about recent charge',
      description: 'I see a payment on my credit card but did not receive an invoice. Need refund information.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('billing_question');
    expect(result.keywords_found).toEqual(
      expect.arrayContaining(['charge', 'payment', 'invoice', 'refund'])
    );
  });

  test('should classify feature_request category', () => {
    const ticket = {
      subject: 'Feature request: Dark mode',
      description: 'Would be nice if you could add dark mode to the app. This enhancement would really improve the user experience.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('feature_request');
    expect(result.keywords_found).toEqual(
      expect.arrayContaining(['feature', 'add', 'would be nice', 'enhancement'])
    );
  });

  test('should classify bug_report category', () => {
    const ticket = {
      subject: 'Bug: Incorrect calculation',
      description: 'Steps to reproduce: 1. Enter values 2. Click calculate. Expected: correct result. Actual: incorrect behavior, defect in the calculation logic.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('bug_report');
    expect(result.keywords_found).toEqual(
      expect.arrayContaining(['steps', 'reproduce', 'expected', 'actual', 'incorrect behavior', 'defect'])
    );
  });

  test('should default to other category when no keywords match', () => {
    const ticket = {
      subject: 'General inquiry',
      description: 'I have a question about something unrelated to specific categories.'
    };

    const result = classifyTicket(ticket);

    expect(result.category).toBe('other');
  });

  test('should assign urgent priority', () => {
    const ticket = {
      subject: 'URGENT: Production down',
      description: 'Critical security issue! Cannot access anything. This is an emergency, need immediate help!'
    };

    const result = classifyTicket(ticket);

    expect(result.priority).toBe('urgent');
    expect(result.keywords_found.length).toBeGreaterThan(0);
    expect(result.keywords_found).toContain('critical');
    expect(result.keywords_found).toContain('urgent');
    expect(result.keywords_found).toContain('emergency');
  });

  test('should assign high priority', () => {
    const ticket = {
      subject: 'Important: Need help quickly',
      description: 'This is blocking my work and I need it resolved asap. High priority issue with tight deadline.'
    };

    const result = classifyTicket(ticket);

    expect(result.priority).toBe('high');
    expect(result.keywords_found).toEqual(
      expect.arrayContaining(['important', 'quickly', 'blocking', 'asap', 'high priority', 'deadline'])
    );
  });

  test('should default to medium priority when no keywords match', () => {
    const ticket = {
      subject: 'Regular question',
      description: 'I have a normal inquiry about the product features.'
    };

    const result = classifyTicket(ticket);

    expect(result.priority).toBe('medium');
  });

  test('should calculate confidence score', () => {
    const ticket = {
      subject: 'Cannot login',
      description: 'Password not working'
    };

    const result = classifyTicket(ticket);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.confidence).toBe('number');
  });
});
