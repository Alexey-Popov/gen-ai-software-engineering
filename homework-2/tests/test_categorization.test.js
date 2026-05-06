const { classifyTicket } = require('../src/services/classificationService');

describe('Classification Service', () => {
  test('Classify login issue as account_access', () => {
    const res = classifyTicket({ subject: 'login problem', description: 'Cannot login' });
    expect(res.category).toBe('account_access');
  });

  test('Classify crash as bug_report', () => {
    const res = classifyTicket({ subject: 'app crash', description: 'It crashes on start' });
    expect(res.category).toBe('bug_report');
  });

  test('Classify refund as billing_question', () => {
    const res = classifyTicket({ subject: 'refund', description: 'I want a refund' });
    expect(res.category).toBe('billing_question');
  });

  test('Classify feature as feature_request', () => {
    const res = classifyTicket({ subject: 'feature', description: 'Please add dark mode' });
    expect(res.category).toBe('feature_request');
  });

  test('Classify unknown as other', () => {
    const res = classifyTicket({ subject: 'hello', description: 'general inquiry about stuff' });
    expect(res.category).toBe('other');
  });

  test('Priority urgent for critical issues', () => {
    const res = classifyTicket({ subject: 'critical', description: 'server is down' });
    expect(res.priority).toBe('urgent');
  });

  test('Priority high for important issues', () => {
    const res = classifyTicket({ subject: 'important', description: 'blocking bug' });
    expect(res.priority).toBe('high');
  });

  test('Priority low for minor issues', () => {
    const res = classifyTicket({ subject: 'minor suggestion', description: 'change color' });
    expect(res.priority).toBe('low');
  });

  test('Priority medium by default', () => {
    const res = classifyTicket({ subject: 'question', description: 'how to do this?' });
    expect(res.priority).toBe('medium');
  });

  test('Confidence is capped at 1.0', () => {
    const res = classifyTicket({ subject: 'login crash refund feature critical minor', description: 'login crash refund feature critical minor login crash refund feature critical minor' });
    expect(res.confidence).toBeLessThanOrEqual(1.0);
  });
});
