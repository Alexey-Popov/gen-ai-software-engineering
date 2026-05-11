/**
 * In-memory ring buffer for classifier decisions.
 * Keeps the last `MAX_ENTRIES` entries; oldest is dropped on overflow.
 * Exposed via `GET /classifier/log` for grading/debug visibility.
 */

const MAX_ENTRIES = 1000;
const entries = [];

/**
 * Record a classification decision.
 *
 * @param {{
 *   ticket_id: string | null,
 *   subject?: string,
 *   result: { category, priority, confidence, reasoning, keywords },
 *   trigger: 'auto-on-create' | 'manual' | 'reclassify',
 * }} entry
 */
export function record(entry) {
  entries.push({ at: new Date().toISOString(), ...entry });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/** @returns {Array} a shallow copy of the log (oldest first) */
export function getAll() {
  return [...entries];
}

/** Clear the log (intended for tests). */
export function clear() {
  entries.length = 0;
}

export const _MAX_ENTRIES = MAX_ENTRIES;
