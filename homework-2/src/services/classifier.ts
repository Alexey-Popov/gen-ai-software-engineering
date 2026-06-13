import { Ticket, Category, Priority, ClassificationResult, ClassificationLog } from '../models/ticket';

const CATEGORY_KEYWORDS: Array<{ category: Category; keywords: string[] }> = [
  {
    category: Category.BugReport,
    keywords: [
      'steps to reproduce',
      'reproduction steps',
      'reproducible',
      'expected behavior',
      'actual behavior',
      'defect',
    ],
  },
  {
    category: Category.AccountAccess,
    keywords: [
      'login',
      'password',
      '2fa',
      'two-factor',
      "can't log in",
      'sign in',
      'authentication',
      'locked out',
      'forgot password',
    ],
  },
  {
    category: Category.BillingQuestion,
    keywords: [
      'payment',
      'invoice',
      'refund',
      'charge',
      'billing',
      'subscription',
      'cost',
      'pricing',
      'receipt',
    ],
  },
  {
    category: Category.FeatureRequest,
    keywords: [
      'enhancement',
      'suggestion',
      'feature request',
      'would like',
      'please add',
      'improve',
      'new feature',
    ],
  },
  {
    category: Category.TechnicalIssue,
    keywords: [
      'error',
      'crash',
      'not working',
      'broken',
      'exception',
      '500',
      'timeout',
      'fails',
      'bug',
    ],
  },
];

const PRIORITY_KEYWORDS: Array<{ priority: Priority; keywords: string[] }> = [
  {
    priority: Priority.Urgent,
    keywords: [
      "can't access",
      'critical',
      'production down',
      'security',
      'urgent',
      'emergency',
      'data loss',
    ],
  },
  {
    priority: Priority.High,
    keywords: ['important', 'blocking', 'asap', 'blocker', 'high priority'],
  },
  {
    priority: Priority.Low,
    keywords: ['minor', 'cosmetic', 'suggestion', 'low priority', 'nice to have', 'whenever'],
  },
];

const logStore = new Map<string, ClassificationLog[]>();

export function classifyTicket(ticket: Ticket): ClassificationResult {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();

  let matchedCategory: Category = Category.Other;
  let categoryKeywordsFound: string[] = [];

  for (const entry of CATEGORY_KEYWORDS) {
    const matched = entry.keywords.filter(kw => text.includes(kw));
    if (matched.length > 0) {
      matchedCategory = entry.category;
      categoryKeywordsFound = matched;
      break;
    }
  }

  let matchedPriority: Priority = Priority.Medium;
  let priorityKeywordsFound: string[] = [];

  for (const entry of PRIORITY_KEYWORDS) {
    const matched = entry.keywords.filter(kw => text.includes(kw));
    if (matched.length > 0) {
      matchedPriority = entry.priority;
      priorityKeywordsFound = matched;
      break;
    }
  }

  let confidence = 0.5 + categoryKeywordsFound.length * 0.15;
  if (priorityKeywordsFound.length > 0) confidence += 0.05;
  if (matchedCategory === Category.Other) {
    confidence = Math.min(confidence, 0.55);
    confidence = Math.max(confidence, 0.40);
  }
  confidence = Math.min(confidence, 0.95);
  confidence = Math.round(confidence * 100) / 100;

  const categoryPart =
    categoryKeywordsFound.length > 0
      ? `Category '${matchedCategory}' matched keywords: ${categoryKeywordsFound.join(', ')}.`
      : `No category keywords matched; defaulted to '${matchedCategory}'.`;

  const priorityPart =
    priorityKeywordsFound.length > 0
      ? ` Priority '${matchedPriority}' matched keywords: ${priorityKeywordsFound.join(', ')}.`
      : ` No priority keywords matched; defaulted to '${matchedPriority}'.`;

  return {
    category: matchedCategory,
    priority: matchedPriority,
    confidence,
    reasoning: categoryPart + priorityPart,
    keywords_found: [...categoryKeywordsFound, ...priorityKeywordsFound],
  };
}

export function logDecision(ticketId: string, ticket: Ticket, result: ClassificationResult): void {
  const timestamp = new Date().toISOString();
  const entry: ClassificationLog = {
    ticket_id: ticketId,
    timestamp,
    subject: ticket.subject,
    description: ticket.description,
    result,
  };

  const existing = logStore.get(ticketId) ?? [];
  logStore.set(ticketId, [...existing, entry]);

  const keywords = result.keywords_found.join(',') || '(none)';
  console.log(
    `[${timestamp}] AUTO-CLASSIFY ticket=${ticketId} category=${result.category} priority=${result.priority} confidence=${result.confidence} keywords=${keywords}`
  );
}

export function getClassificationLog(ticketId: string): ClassificationLog[] {
  return logStore.get(ticketId) ?? [];
}

export function clearClassificationLogs(): void {
  logStore.clear();
}
