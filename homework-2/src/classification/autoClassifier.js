/**
 * Rule-based auto-classification engine for support tickets.
 * Uses keyword matching to categorize tickets and assign priorities.
 */
const CATEGORY_KEYWORDS = {
  account_access: [
    'login', 'password', 'access denied', '2fa', 'authentication',
    'sign in', 'locked out', 'cannot access', 'forgot password',
    'reset password', 'username', 'credential', 'signin', 'log in'
  ],
  technical_issue: [
    'error', 'crash', 'bug', 'not working', 'broken', 'fails',
    'issue', 'problem', 'malfunction', 'freeze', 'hang', 'slow',
    'performance', 'loading', 'timeout'
  ],
  billing_question: [
    'payment', 'invoice', 'refund', 'charge', 'billing', 'subscription',
    'price', 'cost', 'fee', 'credit card', 'transaction', 'receipt',
    'payment method', 'overcharge', 'cancel subscription'
  ],
  feature_request: [
    'feature', 'enhancement', 'suggestion', 'could you add', 'would be nice',
    'request', 'improve', 'add', 'new feature', 'functionality', 'wish',
    'propose', 'idea', 'recommend'
  ],
  bug_report: [
    'reproduce', 'steps', 'expected', 'actual', 'defect', 'incorrect behavior',
    'should', 'instead', 'steps to reproduce', 'reproduction', 'happens when',
    'scenario', 'consistently'
  ],
  other: []
};

const PRIORITY_KEYWORDS = {
  urgent: [
    'critical', 'production down', 'can\'t access', 'security', 'urgent',
    'emergency', 'immediately', 'asap', 'cannot work', 'blocking all',
    'severe', 'catastrophic', 'crisis'
  ],
  high: [
    'important', 'blocking', 'asap', 'high priority', 'need soon',
    'quickly', 'priority', 'soon as possible', 'time sensitive',
    'deadline', 'crucial'
  ],
  medium: [], // default priority
  low: [
    'minor', 'cosmetic', 'suggestion', 'nice to have', 'whenever',
    'low priority', 'not urgent', 'eventual', 'someday', 'trivial',
    'small', 'tiny'
  ]
};

/**
 * Classifies a ticket based on subject and description keywords.
 * @param {Object} ticket - Ticket object with subject and description
 * @returns {Object} Classification result with category, priority, confidence, reasoning
 */
const classifyTicket = (ticket) => {
  if (!ticket || !ticket.subject || !ticket.description) {
    throw new Error('Ticket must have subject and description for classification');
  }

  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();

  const categoryResult = findBestMatch(text, CATEGORY_KEYWORDS);
  const priorityResult = findBestMatch(text, PRIORITY_KEYWORDS);

  const reasoning = generateReasoning(
    categoryResult.category,
    priorityResult.category,
    [...categoryResult.keywords, ...priorityResult.keywords]
  );

  return {
    category: categoryResult.category,
    priority: priorityResult.category,
    confidence: calculateOverallConfidence(categoryResult.confidence, priorityResult.confidence),
    reasoning: reasoning,
    keywords_found: [...categoryResult.keywords, ...priorityResult.keywords]
  };
};

/**
 * Finds the best matching category/priority based on keyword counts.
 * @param {string} text - Text to search for keywords
 * @param {Object} keywordMap - Map of categories to keyword arrays
 * @returns {Object} Best match with category, confidence, and keywords found
 */
const findBestMatch = (text, keywordMap) => {
  let bestCategory = null;
  let maxMatches = 0;
  let matchedKeywords = [];

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.length === 0) continue;

    const foundKeywords = keywords.filter(keyword => text.includes(keyword));
    const matchCount = foundKeywords.length;

    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestCategory = category;
      matchedKeywords = foundKeywords;
    }
  }

  if (!bestCategory) {
    bestCategory = keywordMap.other !== undefined ? 'other' : 'medium';
  }

  const totalKeywords = keywordMap[bestCategory]?.length || 1;
  const confidence = totalKeywords > 0 ? maxMatches / totalKeywords : 0;

  return {
    category: bestCategory,
    confidence: Math.min(confidence, 1.0),
    keywords: matchedKeywords
  };
};

/**
 * Calculates overall confidence from category and priority confidence scores.
 * @param {number} categoryConfidence - Category confidence (0-1)
 * @param {number} priorityConfidence - Priority confidence (0-1)
 * @returns {number} Overall confidence (0-1)
 */
const calculateOverallConfidence = (categoryConfidence, priorityConfidence) => {
  return (categoryConfidence + priorityConfidence) / 2;
};

/**
 * Generates human-readable reasoning for classification.
 * @param {string} category - Classified category
 * @param {string} priority - Classified priority
 * @param {Array} keywords - Keywords found
 * @returns {string} Reasoning text
 */
const generateReasoning = (category, priority, keywords) => {
  if (keywords.length === 0) {
    return `No specific keywords found. Defaulted to category '${category}' and priority
'${priority}'.`;
  }

  const uniqueKeywords = [...new Set(keywords)];
  const keywordList = uniqueKeywords.slice(0, 5).join(', ');

  return `Found keywords: [${keywordList}] in subject and description. ` +
         `Classified as '${category}' category with '${priority}' priority.`;
};

module.exports = {
  classifyTicket,
  CATEGORY_KEYWORDS,
  PRIORITY_KEYWORDS
};
