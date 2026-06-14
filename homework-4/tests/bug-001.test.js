/**
 * Regression tests for Bug 001
 *
 * Covers two fixes applied to src/notes.js:
 *   1. Pagination off-by-one: `(page - 1) * perPage` correctly maps 1-based
 *      page numbers to 0-based array indices.
 *   2. searchNotes guard: `Array.isArray(n.tags)` prevents a TypeError when a
 *      note has no `tags` property (seed note id 5).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { resetNotes } from '../src/notes.js';

describe('bug-001 regressions', () => {
  let app;

  beforeEach(() => {
    resetNotes();
    app = createApp();
  });

  // -------------------------------------------------------------------------
  // Bug A — pagination off-by-one in listNotes
  // -------------------------------------------------------------------------

  describe('GET /notes — pagination off-by-one fix', () => {
    it('page=1&perPage=2 returns the FIRST two notes (ids 1 and 2)', async () => {
      // Happy path: first page must start at index 0, not index perPage.
      const res = await request(app).get('/notes?page=1&perPage=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map(n => n.id)).toEqual([1, 2]);
    });

    it('page=2&perPage=2 returns the SECOND page of notes (ids 3 and 4)', async () => {
      // Second page must follow immediately after the first; with the old
      // formula page=2 would have returned ids [3,4] but page=1 would have
      // returned [3,4] too (skipping ids 1 and 2 entirely).
      const res = await request(app).get('/notes?page=2&perPage=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map(n => n.id)).toEqual([3, 4]);
    });

    it('page=1&perPage=2 and page=2&perPage=2 return non-overlapping sets', async () => {
      // Edge case: the two pages must be disjoint — no note appears twice.
      const page1 = await request(app).get('/notes?page=1&perPage=2');
      const page2 = await request(app).get('/notes?page=2&perPage=2');
      const ids1 = page1.body.map(n => n.id);
      const ids2 = page2.body.map(n => n.id);
      const overlap = ids1.filter(id => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Bug B — unguarded n.tags.includes in searchNotes
  // -------------------------------------------------------------------------

  describe('GET /notes/search — Array.isArray(n.tags) guard fix', () => {
    it('searching by title returns 200 and the matching note (q=Meeting → [2])', async () => {
      // Happy path: title match must work even though note id 5 has no tags.
      const res = await request(app).get('/notes/search?q=Meeting');
      expect(res.status).toBe(200);
      expect(res.body.map(n => n.id)).toEqual([2]);
    });

    it('searching by tag returns 200 and the matching note (q=work → [2])', async () => {
      // Tag match must still work for notes that do have tags.
      const res = await request(app).get('/notes/search?q=work');
      expect(res.status).toBe(200);
      expect(res.body.map(n => n.id)).toEqual([2]);
    });

    it('searching with a term that matches nothing returns 200 with an empty array', async () => {
      // Edge case / crash guard: a query that does not match any title or tag
      // must pass through the filter for note id 5 (which has no tags) without
      // throwing a TypeError.  The old code would 500 here.
      const res = await request(app).get('/notes/search?q=zzznomatch');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('searching with an empty string returns 200 with all notes (no crash on tagless note)', async () => {
      // Edge case: empty query matches every title string via ''.includes(''),
      // so all 5 notes are returned.  This also exercises the Array.isArray
      // guard for note id 5 without throwing.
      const res = await request(app).get('/notes/search?q=');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
    });
  });
});
