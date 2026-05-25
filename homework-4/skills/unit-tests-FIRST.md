---
name: unit-tests-FIRST
description: FIRST principles for unit tests (Fast, Independent, Repeatable, Self-validating, Timely). Use when generating or reviewing unit tests.
---

# FIRST — Unit Test Principles

| Letter | Principle | Practical check |
|--------|-----------|-----------------|
| **F** | **Fast** | A single test runs in milliseconds. No real network/db/sleep. |
| **I** | **Independent** | Tests do not share state. Any subset can run in any order with the same result. |
| **R** | **Repeatable** | Same inputs → same outputs on any machine, any time. No reliance on `Date.now()`, randomness, env-specific paths. |
| **S** | **Self-validating** | Each test asserts a boolean outcome (pass/fail). No human reading of console output to decide. |
| **T** | **Timely** | Written alongside (or just before) the code under test, not weeks later. For this pipeline: generated immediately after the fix. |

## Required usage in test-report.md

Per test file, include a FIRST checklist:
```
F: [x]  no I/O, runs < 50ms
I: [x]  no shared globals
R: [x]  fake timer / fixed seed
S: [x]  expect(...) assertions
T: [x]  written for the just-applied fix
```

## Disallowed patterns
- `setTimeout` without fake timers
- Hitting real HTTP endpoints
- Reading from real filesystem outside `tmp` fixtures
- Snapshot tests for non-deterministic output
