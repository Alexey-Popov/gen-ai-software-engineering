# Fix Summary — Bug 001

**Overall Status:** passed

**Test Command:** `npm test`

**Final Test Result:** 5 passed (5)

## Changes Made

### File: src/notes.js

#### Change 1 — Bug A: off-by-one in `listNotes` (line 19)

**Before:**
```js
  const start = page * perPage;
```

**After:**
```js
  const start = (page - 1) * perPage;
```

**Rationale:** The `/notes` route defaults `page` to 1 (1-based indexing), so page 1 must map to array index 0. The original formula `page * perPage` skipped the first page entirely and shifted all subsequent pages by one.

**Test Result After Change:** passed

#### Change 2 — Bug B: unguarded `n.tags.includes` in `searchNotes` (line 24)

**Before:**
```js
  return notes.filter(n => n.title.includes(q) || n.tags.includes(q));
```

**After:**
```js
  return notes.filter(n => n.title.includes(q) || (Array.isArray(n.tags) && n.tags.includes(q)));
```

**Rationale:** The seed data includes a note (id 5) with no `tags` property, so `n.tags` is `undefined` and calling `.includes()` throws a `TypeError`. The `Array.isArray(n.tags)` guard safely skips the tag check for notes without tags while preserving behaviour for notes that do have tags.

**Test Result After Change:** passed

## Manual Verification

1. **Bug A:** `curl 'http://localhost:3000/notes?page=1&perPage=2'` returns notes with ids 1 and 2.
2. **Bug B:** `curl 'http://localhost:3000/notes/search?q=Meeting'` returns 200 with matches (no 500).

## References

- Implementation Plan: `context/bugs/001/implementation-plan.md`
- Verified Research: `context/bugs/001/research/verified-research.md`
- Source: `src/notes.js` lines 18–25
