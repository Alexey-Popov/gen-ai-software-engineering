# Codebase Research — Bug 001

## Bug A — Pagination returns the wrong page

- **Location**: `src/notes.js:18-21`
- **Snippet**:
  ```js
  export function listNotes(page, perPage) {
    const start = page * perPage;
    return notes.slice(start, start + perPage);
  }
  ```
- **Root cause hypothesis**: `listNotes` computes `start = page * perPage` using a 0-indexed
  formula even though callers pass a 1-based `page` (default `1` in `src/index.js`), so the
  slice begins one full page too far (`page=1` skips notes 1–2 and returns notes 3–4). The
  offset must be `(page - 1) * perPage`.
- **Related code paths**:
  - Caller: `src/index.js` — `app.get('/notes', ...)` parses `page` and defaults to `1`,
    confirming the 1-based contract.
  - Exported from `src/notes.js:18` and imported in `src/index.js`.

## Bug B — `/notes/search` returns 500 for every query

- **Location**: `src/notes.js:23-25`
- **Snippet**:
  ```js
  export function searchNotes(q) {
    return notes.filter(n => n.title.includes(q) || n.tags.includes(q));
  }
  ```
- **Root cause hypothesis**: `searchNotes` calls `n.tags.includes(q)` unconditionally, but
  the seeded note id 5 (`'Random thoughts'`) has no `tags` field, so `n.tags` is `undefined`
  and `.includes` throws `TypeError: Cannot read properties of undefined (reading 'includes')`,
  surfacing as HTTP 500. Guard with `(n.tags || []).includes(q)` or `Array.isArray(n.tags)`.
- **Related code paths**:
  - Caller: `src/index.js` — `app.get('/notes/search', ...)` invokes `searchNotes(q)` with no
    try/catch, so the thrown `TypeError` propagates to Express's default error handler (500).
  - Seed data: `src/notes.js:3-11` — note id 5 deliberately omits `tags`.

## References

- `context/bugs/001/bug-context.md`
- `src/index.js`
- `src/notes.js`
- `src/auth.js`
