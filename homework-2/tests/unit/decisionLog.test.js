import { describe, it, expect, beforeEach } from 'vitest';
import { record, getAll, clear, _MAX_ENTRIES } from '../../src/classifier/decisionLog.js';

describe('decisionLog', () => {
  beforeEach(() => {
    clear();
  });

  it('starts empty', () => {
    expect(getAll()).toEqual([]);
  });

  it('records entries with a timestamp', () => {
    record({ ticket_id: 't1', subject: 'x', result: { category: 'other' }, trigger: 'manual' });
    const all = getAll();

    expect(all).toHaveLength(1);
    expect(all[0].ticket_id).toBe('t1');
    expect(all[0].at).toBeDefined();
    expect(new Date(all[0].at).toString()).not.toBe('Invalid Date');
  });

  it('keeps insertion order (oldest first)', () => {
    record({ ticket_id: 't1', result: {}, trigger: 'manual' });
    record({ ticket_id: 't2', result: {}, trigger: 'manual' });
    record({ ticket_id: 't3', result: {}, trigger: 'manual' });

    expect(getAll().map((e) => e.ticket_id)).toEqual(['t1', 't2', 't3']);
  });

  it('drops the oldest entry when size exceeds the cap', () => {
    for (let i = 0; i < _MAX_ENTRIES + 5; i += 1) {
      record({ ticket_id: `t${i}`, result: {}, trigger: 'manual' });
    }

    const all = getAll();
    expect(all).toHaveLength(_MAX_ENTRIES);
    expect(all[0].ticket_id).toBe('t5');
    expect(all[all.length - 1].ticket_id).toBe(`t${_MAX_ENTRIES + 4}`);
  });

  it('getAll returns a copy (mutating it does not affect the buffer)', () => {
    record({ ticket_id: 't1', result: {}, trigger: 'manual' });

    const snapshot = getAll();
    snapshot.push({ ticket_id: 'fake' });

    expect(getAll()).toHaveLength(1);
  });
});
