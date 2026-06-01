# Implementation Plan — Bug 001

## Plan Summary

Two bugs exist in `src/notes.js`. Bug A: `listNotes` computes the slice start as `page * perPage` instead of `(page - 1) * perPage`, so a 1-based page parameter (the default sent by the `/notes` route) skips the first page entirely and returns wrong results. Bug B: `searchNotes` calls `n.tags.includes(q)` unconditionally, but the seed note with id 5 has no `tags` field, making `n.tags` undefined and causing a `TypeError` that propagates as HTTP 500. Both fixes are single-line changes confined to `src/notes.js`; no changes to `src/index.js` are required.

## Test Command

```
npm test
```

## Risks / Flags

None. Pipeline action was PROCEED with no flags.

## Changes

### file: src/notes.js

#### Change 1 — Bug A: off-by-one in `listNotes`

Location: line 19, function `listNotes`

Before:
```js
  const start = page * perPage;
```

After:
```js
  const start = (page - 1) * perPage;
```

Rationale: The route in `src/index.js` defaults `page` to `1` (1-based), so the first page must map to index `0`; the original formula skipped the entire first page and shifted every subsequent page by one.

#### Change 2 — Bug B: unguarded `n.tags.includes` in `searchNotes`

Location: line 24, function `searchNotes`

Before:
```js
  return notes.filter(n => n.title.includes(q) || n.tags.includes(q));
```

After:
```js
  return notes.filter(n => n.title.includes(q) || (Array.isArray(n.tags) && n.tags.includes(q)));
```

Rationale: Note id 5 in the seed data has no `tags` property, so `n.tags` is `undefined`; wrapping the tag check with `Array.isArray(n.tags)` prevents the `TypeError` without altering behaviour for notes that do carry tags.

## References

- Verified finding 1 (Bug A mechanism): `context/bugs/001/research/verified-research.md` — Verified Claims 1 and 2.
- Verified finding 2 (Bug B mechanism): `context/bugs/001/research/verified-research.md` — Verified Claims 3, 4, and 5.
- Source: `src/notes.js` lines 18–25.
- Source: `src/index.js` lines 9–18 (no changes required here).
