# Security Report — Bug 001

## Summary
- Findings: CRITICAL: 1, HIGH: 2, MEDIUM: 2, LOW: 2, INFO: 1
- Files reviewed: 4 (`src/notes.js`, `src/index.js`, `src/auth.js`, `package.json`)
- Overall verdict: BLOCKING (pre-existing issues outside the bug-001 fix scope)

> Note: The two bugs fixed in `src/notes.js` (off-by-one slice; unguarded `.includes` on a
> possibly-undefined `tags`) are not security defects, and the patches do not introduce new
> vulnerabilities. The blocking findings predate the fix and live in `src/auth.js` and
> `src/index.js`, which are on the same request path as the fixed module.

## Findings

### F-1 — Hardcoded admin bearer token in source
- Severity: CRITICAL
- File: `src/auth.js:1`
- Class: Hardcoded credential / secret in source code (CWE-798)
- Description: `ADMIN_TOKEN` is a literal string baked into the source. Anyone with read access to
  the repo (including git history) can impersonate the admin and call `DELETE /notes/:id`. No
  rotation, no env-var indirection.
- Evidence:
  ```js
  const ADMIN_TOKEN = 'super-secret-admin-token-do-not-share';
  ```
- Remediation: Load from an environment variable / secrets manager, fail closed if unset, rotate the leaked value, and purge it from git history.
- References: CWE-798, OWASP ASVS V2.10, OWASP Top 10 A07:2021.

### F-2 — Admin token comparison uses non-constant-time `===`
- Severity: HIGH
- File: `src/auth.js:6`
- Class: Timing side-channel in authentication (CWE-208)
- Description: `token === ADMIN_TOKEN` short-circuits at the first differing character, allowing
  byte-by-byte timing recovery. The guarded endpoint (`DELETE /notes/:id`) is destructive and
  has no rate-limiting, so unlimited timing samples can be collected.
- Remediation: Use `crypto.timingSafeEqual` on equal-length SHA-256 digests of the tokens.
- References: CWE-208, OWASP ASVS V2.4.

### F-3 — Destructive admin endpoint has no rate-limit, audit log, or CSRF protection
- Severity: HIGH
- File: `src/index.js:20-27`
- Class: Missing security controls on privileged operation (CWE-307, CWE-352, CWE-778)
- Description: `DELETE /notes/:id` accepts unlimited requests, has no audit log, and relies only
  on a static shared secret. Absence of throttling/logging lets an attacker sweep the token
  space (via F-2) with no forensic trail; no CORS allowlist is configured.
- Remediation: Add rate-limiting to admin routes, log auth failures and deletions with source IP and request id, configure CORS deny-by-default, and prefer per-actor tokens.
- References: CWE-307, CWE-778, OWASP Top 10 A09:2021.

### F-4 — Missing input validation on `id` allows silent no-ops and NaN propagation
- Severity: MEDIUM
- File: `src/index.js:24-25`
- Class: Improper input validation (CWE-20)
- Description: `parseInt(req.params.id, 10)` returns `NaN` for non-numeric input; `deleteNote(NaN)`
  silently no-ops yet returns `204`, masquerading as success. Similar gaps on `page`/`perPage`
  and unbounded `q`.
- Remediation: Reject non-integer/out-of-range params with 400; cap `perPage`, require `page >= 1` and positive integer `id`, bound `q` length. Use a schema validator.
- References: CWE-20, OWASP API Security Top 10 API6:2023.

### F-5 — `searchNotes` accepts non-string `q`, enabling type-confusion
- Severity: MEDIUM
- File: `src/notes.js:23-25`, `src/index.js:15-18`
- Class: Improper input validation / type confusion (CWE-1287)
- Description: `req.query.q` can be an array (`?q=a&q=b`) or object (`?q[$ne]=x`). Array compares
  against a stringified array; object throws a `TypeError` → 500. The symmetric type guard for
  `q` is missing.
- Remediation: Coerce at the boundary: `const q = typeof req.query.q === 'string' ? req.query.q : '';` else reject with 400.
- References: CWE-1287, OWASP ASVS V5.1.

### F-6 — `express.json()` has no explicit body size limit / unnecessary attack surface
- Severity: LOW
- File: `src/index.js:7`
- Class: Resource exhaustion (CWE-770)
- Description: No route consumes JSON, yet `express.json()` is registered globally, buffering
  bodies before route resolution.
- Remediation: Remove `express.json()` or scope it with an explicit small limit (e.g. `{ limit: '16kb' }`).
- References: CWE-770.

### F-7 — No global error handler — uncaught exceptions leak stack traces
- Severity: LOW
- File: `src/index.js` (missing middleware)
- Class: Information exposure through error message (CWE-209)
- Description: No error-handling middleware and no `NODE_ENV` default, so uncaught exceptions
  return full stack traces and source paths, aiding fingerprinting.
- Remediation: Add a final error-handling middleware returning a generic message; set `NODE_ENV=production` in prod.
- References: CWE-209, OWASP Top 10 A05:2021.

### F-8 — Dependency posture not verified in this review
- Severity: INFO
- File: `package.json`
- Class: Vulnerable and outdated components (CWE-1104)
- Description: Pins `express ^4.21.0`, `supertest ^7.0.0`, `vitest ^2.1.4`. Read-only review
  could not run `npm audit`; confirm in CI and consider Express 5 migration.
- Remediation: Run `npm audit --omit=dev` and `npm outdated` in CI; commit a `package-lock.json`.
- References: CWE-1104, OWASP Top 10 A06:2021.

## Files Reviewed
- `src/notes.js`
- `src/index.js`
- `src/auth.js`
- `package.json`
