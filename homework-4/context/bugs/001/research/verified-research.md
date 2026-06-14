# Verified Research — Bug 001

## Verification Summary

- Status: PASS — all file:line references and code snippets in `codebase-research.md` match current source.
- Research Quality: HIGH (4/4)
- Pipeline action: PROCEED

## Verified Claims

1. **Bug A — `src/notes.js:18-21`** — `listNotes(page, perPage)` is defined with body `const start = page * perPage;` and `return notes.slice(start, start + perPage);`. Snippet matches verbatim. Confirmed.
2. **Bug A caller — `src/index.js:9-13`** — `app.get('/notes', ...)` parses `page` with `parseInt(req.query.page, 10) || 1` and passes it to `listNotes(page, perPage)`. The 1-based default is confirmed. Confirmed.
3. **Bug B — `src/notes.js:23-25`** — `searchNotes(q)` body is `return notes.filter(n => n.title.includes(q) || n.tags.includes(q));`. Snippet matches verbatim. Confirmed.
4. **Bug B trigger — `src/notes.js:3-11`** — Seed defines five notes; note id 5 (`'Random thoughts'`, line 9) deliberately omits the `tags` field, so `n.tags` is `undefined` and `.includes` throws `TypeError`. Confirmed.
5. **Bug B caller — `src/index.js:15-18`** — `app.get('/notes/search', ...)` calls `searchNotes(q)` with no try/catch, so the thrown `TypeError` reaches Express's default error handler and produces HTTP 500. Confirmed.
6. **Export/import wiring** — `listNotes` and `searchNotes` are exported from `src/notes.js` (lines 18, 23) and imported in `src/index.js:2`. Confirmed.

## Discrepancies Found

None. No file:line references were off, and no snippet differed from source.

## Research Quality Assessment

- **Selected level**: HIGH (4/4)
- **Counts**: refs checked = 5 distinct file:line ranges; valid = 5; invalid = 0.
- **Snippet mismatches**: 0.
- **Per-finding levels**:
  - Bug A: HIGH — file, function, line range, and mechanism (`start = page * perPage` instead of `(page - 1) * perPage`) all present.
  - Bug B: HIGH — file, function, line range, and mechanism (`n.tags` undefined for seeded id 5, unguarded `.includes` throws `TypeError` → Express default 500 handler) all present.
- **Aggregate**: lowest = HIGH, so overall = HIGH.

## References

- `context/bugs/001/research/codebase-research.md`
- `src/notes.js` (full file)
- `src/index.js` (full file)
- `src/auth.js` (existence check only)

---

Pipeline action: PROCEED
