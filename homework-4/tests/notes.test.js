import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { resetNotes } from '../src/notes.js';

describe('notes-api', () => {
  let app;

  beforeEach(() => {
    resetNotes();
    app = createApp();
  });

  describe('GET /notes (pagination)', () => {
    it('page=1, perPage=2 returns the first two notes', async () => {
      const res = await request(app).get('/notes?page=1&perPage=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map(n => n.id)).toEqual([1, 2]);
    });

    it('page=2, perPage=2 returns notes 3 and 4', async () => {
      const res = await request(app).get('/notes?page=2&perPage=2');
      expect(res.status).toBe(200);
      expect(res.body.map(n => n.id)).toEqual([3, 4]);
    });
  });

  describe('GET /notes/search', () => {
    it('finds a note by title substring', async () => {
      const res = await request(app).get('/notes/search?q=Meeting');
      expect(res.status).toBe(200);
      expect(res.body.map(n => n.id)).toEqual([2]);
    });

    it('finds notes by tag', async () => {
      const res = await request(app).get('/notes/search?q=work');
      expect(res.status).toBe(200);
      expect(res.body.map(n => n.id)).toEqual([2]);
    });
  });

  describe('DELETE /notes/:id', () => {
    it('rejects requests without a valid token', async () => {
      const res = await request(app).delete('/notes/1');
      expect(res.status).toBe(401);
    });
  });
});
