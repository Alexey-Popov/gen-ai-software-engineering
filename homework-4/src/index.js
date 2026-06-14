import express from 'express';
import { listNotes, searchNotes, deleteNote } from './notes.js';
import { checkAdmin } from './auth.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/notes', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.perPage, 10) || 10;
    res.json(listNotes(page, perPage));
  });

  app.get('/notes/search', (req, res) => {
    const q = req.query.q || '';
    res.json(searchNotes(q));
  });

  app.delete('/notes/:id', (req, res) => {
    if (!checkAdmin(req.headers.authorization)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const id = parseInt(req.params.id, 10);
    deleteNote(id);
    res.status(204).end();
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`notes-api running on http://localhost:${port}`);
  });
}
