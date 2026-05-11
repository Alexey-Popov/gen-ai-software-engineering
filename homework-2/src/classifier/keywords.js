/**
 * Keyword maps for category and priority classification.
 *
 * Phrases (containing a space) are matched as substrings on the lowercased
 * full text; single words are matched against the tokenized set.
 *
 * Category keywords are derived from the spec (TASKS.md → Categories section).
 * Priority keywords are taken verbatim from the spec's Priority Rules.
 */

export const CATEGORY_KEYWORDS = {
  account_access: [
    'login', 'log in', 'sign in', 'signin',
    'password', 'reset password', 'forgot password',
    '2fa', 'two-factor', 'two factor', 'mfa',
    'authenticate', 'authentication',
    'locked out', 'lockout',
    "can't access", 'cannot access', 'access account',
  ],
  technical_issue: [
    'error', 'crash', 'crashed', 'crashing',
    'broken', 'not working', 'doesn\'t work', 'does not work',
    'fail', 'failed', 'failure',
    'timeout', 'timing out', 'slow', 'unresponsive',
    'freezing', 'frozen', 'hang', 'hanging',
  ],
  billing_question: [
    'payment', 'invoice', 'refund', 'refunded',
    'charge', 'charged', 'overcharge',
    'billing', 'bill', 'subscription',
    'pay', 'paid', 'card', 'credit card',
  ],
  feature_request: [
    'feature request', 'enhancement', 'enhance',
    'would like', 'wish you', 'could you add',
    'suggestion to add', 'improvement',
    'please add', 'add support',
  ],
  bug_report: [
    'steps to reproduce', 'reproduction steps', 'reproduce',
    'expected behavior', 'actual behavior',
    'expected result', 'actual result',
    'repro steps',
  ],
  other: [],
};

export const PRIORITY_KEYWORDS = {
  urgent: ["can't access", 'cannot access', 'critical', 'production down', 'security'],
  high: ['important', 'blocking', 'asap'],
  medium: [],
  low: ['minor', 'cosmetic', 'suggestion'],
};

export const CATEGORIES = [
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other',
];

export const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
