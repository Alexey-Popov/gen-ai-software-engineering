# CLAUDE.md — Project rules for the Virtual Card Lifecycle service

These are the binding editor/AI rules for this repository (Claude Code). They distill
[`specification.md`](../specification.md) §5–§6 and [`agents.md`](../agents.md) §3 into the
always-loaded defaults Claude must follow on every edit. When a prompt conflicts with this file,
**follow this file and ask**.

> Companion docs: `specification.md` = the *what* · `agents.md` = the *how* · this file = the
> *where/now* (the always-on defaults applied while editing).

---

## Core rules (always apply)

**Sensitive data**
- NEVER log, persist, return, or hard-code a **PAN** (card number) or **CVV**. Store only
  `pan_token`, `last4`, `brand`, expiry. No `pan` / `card_number` / `cvv` column, field, or variable.
- NEVER put a real / Luhn-valid issuer PAN, secret, or production PII in code, tests, or fixtures —
  use synthetic test BINs (e.g. `4242…`).
- Redact PII/PAN at the logger; structured JSON logs carry a `correlation_id`, never raw secrets.

**Money**
- Money is ALWAYS `amount_minor` (integer) + `currency` (ISO-4217). Never `float`/`number` for money.
- Do arithmetic in minor units; format only at the presentation edge. Reject mixed-currency ops.

**Naming & vocabulary**
- Use the spec's domain terms verbatim so code, contracts, and audit events line up: `card_id`,
  `amount_minor`, `currency`, `pan_token`, `last4`, `freeze_reason`, `closure_reason`, `version`,
  `correlation_id`. Use snake_case for JSON/API fields and DB columns; ULIDs for ids; opaque cursors
  for pagination. Never invent a synonym for an existing term.

**Mutations — Standard Mutation Contract (spec §6.1)**
Any state change MUST, in order: authN + RBAC (default-deny, tenant-scoped) → idempotency-key →
optimistic-concurrency (`expected_version`/`If-Match`, stale ⇒ `409`) → state-machine guard →
capture reason code → persist + emit audit **in the same DB transaction** → dispatch notification
(best-effort, retried) → return the new `version`.

**Audit & time**
- Audit is APPEND-ONLY and tamper-evident. Never `UPDATE`/`DELETE` audit rows. No transition is
  "done" without its audit record. Audit payloads never contain PAN/CVV/full PII.
- All timestamps are UTC ISO-8601.

**Access & safety**
- RBAC least-privilege, default-deny. Cross-tenant access returns **404** (not 403) + a security
  audit event. Lifting a compliance/fraud freeze and revealing PII require **dual control**.
- **Fail-closed**: if a money-protecting control (freeze push, token revoke) can't be confirmed,
  treat it as NOT effective (pending) — never report a protection as active when it isn't.

**Scope & process**
- Do NOT implement authorization/settlement/ledger/KYC — push controls and consume webhooks only.
- Do NOT `git commit` or `git push` unless the user explicitly asks.

---

## API & contracts — when editing `contracts/**` or `src/http/**`

(See spec §6.2 and tasks T3/T7/T16/T17.)

- Every mutating endpoint REQUIRES an `Idempotency-Key` header (missing ⇒ `400 IDEMPOTENCY_KEY_REQUIRED`)
  and optimistic concurrency via `If-Match`/`expected_version` (stale ⇒ `409 STALE_VERSION`).
- Validate every input against its JSON Schema before touching domain logic.
- IDs are opaque ULIDs/cursors — never expose DB primary keys. Money fields are
  `{ amount_minor, currency }`; cards expose `last4` + brand only.
- Errors use the typed catalog (T17): `{ "error": { "code", "message", "correlation_id", "details" } }`
  — stable `code`s; no PAN/CVV, secrets, or stack traces in any error body.
- Status codes: `201` create · `409` conflict (transition/version/idempotency-in-progress) ·
  `422` validation/idempotency-conflict · `404` not-found & cross-tenant · `429` rate-limited.
- Pagination is cursor-based: `limit` default 25, **max 100**, always return `next_cursor`
  (null when done); empty result ⇒ `200` with `[]`. Stable ordering (e.g. `occurred_at, id`).
- Changing a handler's shape REQUIRES updating `contracts/` + the contract tests in the same change.

---

## Testing & fixtures — when editing `test/**`, `**/*.test.ts`, or `fixtures/**`

(See spec §10.)

- Add the happy path PLUS the relevant edge cases from spec §9 (EC1–EC19) the code touches.
- Keep 100% of the state-machine table (T1) exercised. Add an idempotency-replay test (EC12) and a
  concurrency race test (EC3) for mutations; assert cross-tenant access returns `404` (EC6); add a
  no-PAN-in-logs assertion for new code paths.
- Fixtures: synthetic test BINs ONLY. A guard test scans `fixtures/**` for forbidden real-issuer /
  Luhn-valid PAN patterns and any `cvv`-shaped field — keep it passing. No secrets/PII in fixtures.
- Do NOT lower coverage; keep overall ≥ 85% lines. Validate handlers against `contracts/`.
- Reconciliation (T20) and audit-completeness (T19) get tests that inject drift / a missing audit
  record and assert detection.
- Determinism: freeze clock + ULID generation; assert UTC ISO-8601; stub the processor/vault (no real network).
