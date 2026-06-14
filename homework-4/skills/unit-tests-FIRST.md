---
name: unit-tests-FIRST
description: FIRST principles for unit tests (Fast, Independent, Repeatable, Self-validating, Timely). Use when generating or reviewing unit tests for the notes-api.
---

# FIRST — Unit Test Principles

| Letter | Principle | Practical check |
|--------|-----------|-----------------|
| **F** | **Fast** | A single test runs in milliseconds. No real network/db/sleep. |
| **I** | **Independent** | Tests do not share state. Any subset can run in any order with the same result. |
| **R** | **Repeatable** | Same inputs → same outputs on any machine, any time. No reliance on `Date.now()`, randomness, env-specific paths. |
| **S** | **Self-validating** | Each test asserts a boolean outcome (pass/fail). No human reading of console output to decide. |
| **T** | **Timely** | Generated **immediately after** the Bug Fixer applies the fix, **for the changed functions only** — not for the whole module. |

## Stack & conventions (this project)

- Test runner: **vitest** + **supertest** for HTTP requests against the Express app.
- Test files live in `tests/*.test.js` (matches `vitest run` discovery).
- Import the app via `createApp()` from `src/index.js`; do not start a real server.
- Reset in-memory state in `beforeEach` via `resetNotes()` from `src/notes.js` (covers **I**).
- Naming: outer `describe('<module or endpoint>')`, inner `it('<verb phrase describing behavior>')` — e.g. `it('returns the first page when page=1')`.

## Coverage minimum (per changed function)

At least **two** tests per function the Bug Fixer touched:
1. **Happy path** — typical valid input, asserts expected output.
2. **Edge case** — one of: boundary value, missing/empty input, type-coercion case, the exact input that triggered the original bug.

If the fix changed branching, add one test per new branch.

## Required usage in test-report.md

Per test file, include a FIRST checklist:
```
F: [x]  runs in-process, < 50ms
I: [x]  resetNotes() in beforeEach; no shared globals
R: [x]  no Date.now / Math.random / external I/O
S: [x]  expect(...) assertions only
T: [x]  written for functions changed in fix-summary.md
```

## Disallowed patterns
- `setTimeout` / `setInterval` without fake timers
- Hitting real HTTP endpoints (use `supertest(createApp())`)
- Reading from real filesystem outside `tmp` fixtures
- Snapshot tests for non-deterministic output
- Tests that depend on order (e.g. relying on a previous test's mutation)

## Reference example

A FIRST-compliant test against `searchNotes` (after the fix):

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { resetNotes } from '../src/notes.js';

describe('GET /notes/search', () => {
  let app;
  beforeEach(() => { resetNotes(); app = createApp(); });

  it('returns notes whose tag matches the query', async () => {       // happy path
    const res = await request(app).get('/notes/search?q=work');
    expect(res.status).toBe(200);
    expect(res.body.map(n => n.id)).toEqual([2]);
  });

  it('skips notes without a tags field instead of throwing', async () => { // edge case (was the bug)
    const res = await request(app).get('/notes/search?q=thoughts');
    expect(res.status).toBe(200);
    expect(res.body.map(n => n.id)).toEqual([5]);
  });
});
```

Why this satisfies FIRST: in-process supertest (**F**), `beforeEach` reset (**I**), pure inputs (**R**), `expect` assertions (**S**), targeted at the just-fixed function (**T**).
