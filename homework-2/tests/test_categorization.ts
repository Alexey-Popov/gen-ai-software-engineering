import {
  classifyTicket,
  logDecision,
  getClassificationLog,
  clearClassificationLogs,
} from '../src/services/classifier';
import { Category, Priority, Status } from '../src/models/ticket';

function makeTicket(subject: string, description: string) {
  return {
    id: 'test-id',
    customer_id: 'cust-001',
    customer_email: 'test@example.com',
    customer_name: 'Test User',
    subject,
    description,
    status: Status.New,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  clearClassificationLogs();
});

// Test 1
it('ticket mentioning "password" is classified as account_access', () => {
  const result = classifyTicket(makeTicket('Login issue', 'I forgot my password and cannot reset it.'));
  expect(result.category).toBe(Category.AccountAccess);
});

// Test 2
it('ticket mentioning "crash" is classified as technical_issue', () => {
  const result = classifyTicket(makeTicket('App crash', 'The application crash every time I open it.'));
  expect(result.category).toBe(Category.TechnicalIssue);
});

// Test 3
it('ticket mentioning "invoice" is classified as billing_question', () => {
  const result = classifyTicket(makeTicket('Invoice wrong', 'My latest invoice shows the wrong amount.'));
  expect(result.category).toBe(Category.BillingQuestion);
});

// Test 4
it('ticket mentioning "new feature" is classified as feature_request', () => {
  const result = classifyTicket(makeTicket('Suggestion', 'I would like a new feature to export data.'));
  expect(result.category).toBe(Category.FeatureRequest);
});

// Test 5
it('ticket mentioning "steps to reproduce" is classified as bug_report', () => {
  const result = classifyTicket(
    makeTicket('Bug found', 'Here are the steps to reproduce the problem I found.')
  );
  expect(result.category).toBe(Category.BugReport);
});

// Test 6
it('ticket with no matching keywords defaults to category "other"', () => {
  const result = classifyTicket(makeTicket('General inquiry', 'I have a general question about the service.'));
  expect(result.category).toBe(Category.Other);
});

// Test 7
it('ticket mentioning "urgent" maps to urgent priority', () => {
  const result = classifyTicket(makeTicket('Urgent help needed', 'This is urgent, please help me now.'));
  expect(result.priority).toBe(Priority.Urgent);
});

// Test 8
it('ticket mentioning "minor cosmetic" maps to low priority', () => {
  const result = classifyTicket(makeTicket('Minor cosmetic issue', 'The button color looks slightly off.'));
  expect(result.priority).toBe(Priority.Low);
});

// Test 9
it('classifier result includes reasoning and keywords_found fields', () => {
  const result = classifyTicket(makeTicket('Login failure', 'I cannot sign in to my account today.'));
  expect(typeof result.reasoning).toBe('string');
  expect(result.reasoning.length).toBeGreaterThan(0);
  expect(Array.isArray(result.keywords_found)).toBe(true);
  expect(typeof result.confidence).toBe('number');
});

// Test 10
it('ticket with no priority keywords defaults to medium priority', () => {
  const result = classifyTicket(makeTicket('Invoice incorrect', 'My billing amount looks wrong this month.'));
  expect(result.priority).toBe(Priority.Medium);
});

// Test 11: logDecision stores an entry
it('logDecision stores a classification log entry for the ticket', () => {
  const ticket = makeTicket('Cannot login', 'I keep getting a password error when signing in.');
  const result = classifyTicket(ticket);
  logDecision(ticket.id, ticket, result);
  const logs = getClassificationLog(ticket.id);
  expect(logs).toHaveLength(1);
  expect(logs[0].ticket_id).toBe(ticket.id);
  expect(logs[0].result.category).toBe(result.category);
});

// Test 12: getClassificationLog returns empty array for unknown ticket
it('getClassificationLog returns empty array for a ticket with no log entries', () => {
  const logs = getClassificationLog('nonexistent-ticket-id');
  expect(logs).toHaveLength(0);
});

// Test 13: multiple logDecision calls accumulate entries
it('multiple logDecision calls accumulate entries for the same ticket', () => {
  const ticket = makeTicket('App crash', 'The app crash on every startup.');
  const r1 = classifyTicket(ticket);
  const r2 = classifyTicket(makeTicket('Invoice', 'My billing charge looks wrong.'));
  logDecision(ticket.id, ticket, r1);
  logDecision(ticket.id, ticket, r2);
  expect(getClassificationLog(ticket.id)).toHaveLength(2);
});
