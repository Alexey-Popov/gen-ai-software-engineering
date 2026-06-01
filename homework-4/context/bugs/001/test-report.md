# Test Report — Bug 001

## Files Covered

| Changed source file | Test file added |
|---|---|
| `src/notes.js` | `tests/bug-001.test.js` |

---

## Test Cases Added

| Test name | Intent | Function under test |
|---|---|---|
| page=1&perPage=2 returns the FIRST two notes (ids 1 and 2) | Happy path: first page starts at index 0 after the off-by-one fix | `listNotes` |
| page=2&perPage=2 returns the SECOND page of notes (ids 3 and 4) | Happy path: second page immediately follows the first | `listNotes` |
| page=1&perPage=2 and page=2&perPage=2 return non-overlapping sets | Edge case: adjacent pages are disjoint (no duplicate ids) | `listNotes` |
| searching by title returns 200 and the matching note (q=Meeting → [2]) | Happy path: title match works while note id 5 (no tags) is present | `searchNotes` |
| searching by tag returns 200 and the matching note (q=work → [2]) | Happy path: tag match still works for notes that have tags | `searchNotes` |
| searching with a term that matches nothing returns 200 with an empty array | Crash guard: query that touches note id 5 (no tags) must not 500 | `searchNotes` |
| searching with an empty string returns 200 with all notes | Edge case: empty query matches all 5 notes including the tagless one | `searchNotes` |

---

## FIRST Checklist — tests/bug-001.test.js

**F — Fast**
All tests are in-process; no real network I/O, no disk access. The suite completes in ~40 ms for the 7 new tests.

**I — Isolated / Independent**
`resetNotes()` is called in `beforeEach`, and `createApp()` is re-instantiated each time, so no test can leak state to another. Tests may run in any order.

**R — Repeatable**
The seed data is deterministic (fixed array in `seed()`). No randomness, no external services, no time-dependent logic. Results are identical on every run.

**S — Self-Validating**
Every test uses `expect()` assertions that produce a clear pass/fail signal. No manual inspection required.

**T — Timely**
Tests are written against the fixed implementation as regression guards, authored immediately after the fix was confirmed. They will catch any future reintroduction of either bug.

---

## Run Result

```
 RUN  v2.1.9

 ✓ tests/notes.test.js (5 tests) 35ms
 ✓ tests/bug-001.test.js (7 tests) 40ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  18:51:00
   Duration  599ms
```

- **Total tests:** 12 (5 pre-existing + 7 new)
- **Passed:** 12
- **Failed:** 0

---

## Iterations

**1** — Tests passed on the first run. No retry was needed.
