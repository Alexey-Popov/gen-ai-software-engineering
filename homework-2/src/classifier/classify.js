import {
  CATEGORY_KEYWORDS,
  PRIORITY_KEYWORDS,
  CATEGORIES,
  PRIORITIES,
} from './keywords.js';

/**
 * Lowercase, split on non-alphanumerics, drop short tokens, deduplicate.
 * Used for word-level keyword matching.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2)
  );
}

/**
 * Match a list of keywords against `text` and `tokens`.
 * Phrases (contain a space) → substring match on `text`.
 * Single words → membership in `tokens`.
 *
 * @returns {string[]} the keywords (originals) that matched
 */
function findMatches(text, tokens, keywords) {
  const matched = [];
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const hit = lower.includes(' ') ? text.includes(lower) : tokens.has(lower);
    if (hit) matched.push(kw);
  }
  return matched;
}

/**
 * Pick the label with the most matches, falling back to `defaultLabel`.
 * Ties resolve to the first label in `ordering` (stable, deterministic).
 *
 * @returns {{ label: string, matches: string[] }}
 */
function pickWinner(scores, defaultLabel, ordering) {
  let bestLabel = defaultLabel;
  let bestCount = 0;
  for (const label of ordering) {
    const count = (scores[label] || []).length;
    if (count > bestCount) {
      bestCount = count;
      bestLabel = label;
    }
  }
  return { label: bestLabel, matches: scores[bestLabel] || [] };
}

function buildReasoning(cat, pri) {
  const parts = [];
  parts.push(
    cat.matches.length > 0
      ? `category=${cat.label} (matched: ${cat.matches.join(', ')})`
      : `category=other (no category keywords matched)`
  );
  parts.push(
    pri.matches.length > 0
      ? `priority=${pri.label} (matched: ${pri.matches.join(', ')})`
      : `priority=medium (default; no priority keywords matched)`
  );
  return parts.join('; ');
}

/**
 * Classify a ticket based on its subject + description.
 * Pure function — does NOT mutate the ticket or write to the decision log.
 *
 * @param {{ subject?: string, description?: string }} ticket
 * @returns {{
 *   category: string,
 *   priority: string,
 *   confidence: number,   // 0–1
 *   reasoning: string,    // human-readable explanation
 *   keywords: string[],   // all matched keywords (category + priority)
 * }}
 */
export function classify(ticket) {
  const subject = String(ticket?.subject || '');
  const description = String(ticket?.description || '');
  const text = `${subject} ${description}`.toLowerCase();
  const tokens = tokenize(text);

  const categoryMatches = {};
  for (const cat of CATEGORIES) {
    categoryMatches[cat] = findMatches(text, tokens, CATEGORY_KEYWORDS[cat]);
  }
  const cat = pickWinner(categoryMatches, 'other', CATEGORIES);

  const priorityMatches = {};
  for (const pri of PRIORITIES) {
    priorityMatches[pri] = findMatches(text, tokens, PRIORITY_KEYWORDS[pri]);
  }
  const pri = pickWinner(priorityMatches, 'medium', PRIORITIES);

  const allMatched = [...new Set([...cat.matches, ...pri.matches])];
  const confidence =
    tokens.size > 0 ? Math.min(1, allMatched.length / tokens.size) : 0;

  return {
    category: cat.label,
    priority: pri.label,
    confidence: Number(confidence.toFixed(3)),
    reasoning: buildReasoning(cat, pri),
    keywords: allMatched,
  };
}
