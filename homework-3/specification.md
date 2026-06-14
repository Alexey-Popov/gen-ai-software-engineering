# Virtual Card Lifecycle — Feature Specification

> Ingest this file, implement the Low-Level Tasks (§9), and generate code that satisfies the High and Mid-Level Objectives. This document is the source of truth for both humans and AI agents on this feature.

---

## §1. High-Level Objective

Let end-users **instantly issue, control, and observe virtual payment cards** while giving compliance and operations full auditability and PCI-DSS-aligned data boundaries.

**Scope** — *in:* virtual card lifecycle for retail customers (issue, freeze/unfreeze, limits, view transactions). *Out:* physical issuance, FX, P2P or card-to-card transfers, KYC (Know-Your-Customer) onboarding itself.

---

## §2. Stakeholders

| Persona | Goal | Surface |
|---|---|---|
| End-user (cardholder) | Issue card, freeze/unfreeze, set limits, view own transactions | Mobile / web app |
| Ops analyst | Investigate flagged cards, manual freeze, read audit trail | Admin console (bounded write) |
| Compliance officer | Pull audit log; prove control coverage to regulators | Read-only audit interface |
| Fraud service (automated) | Auto-freeze on risk signal | Internal service API (mTLS) |
| Support agent | Read-only card metadata; initiate freeze on user request | Support console |

Authorization is enforced server-side per request; UI role rendering is convenience only, never a security boundary.

---

## §3. Mid-Level Objectives *(observable outcomes)*

- **M-1 Issue card** — A user can issue a virtual card and use it for authorizations.
- **M-2 Freeze / Unfreeze** — A user or authorized ops actor can transition a card between ACTIVE and FROZEN; new authorizations are rejected once frozen.
- **M-3 Spending limits** — A user can set daily, monthly, and per-transaction caps that the authorization engine enforces.
- **M-4 Transaction visibility** — A user sees their own transactions with merchant metadata, status, and dispute eligibility; ops sees the same plus internal risk score.
- **M-5 Audit completeness** — Every state-changing action emits an immutable audit record with actor, reason, before/after state, and request correlation.
- **M-6 Fraud auto-controls** — The risk service can freeze a card or reject specific authorizations through a documented contract; the user is notified.
- **M-7 Data minimization** — Surfaces outside the PCI zone never expose full PAN (Primary Account Number) or CVV (Card Verification Value).

Concrete timing, security, and privacy constraints for each are in §4. Each M-N maps to tasks in §9 and verification in §8.

---

## §4. Non-Functional & Policy

### 4.1 Security

- PCI-DSS scope reduction via tokenization — issuer vault holds the PAN; this service stores only the opaque vault token plus last-4.
- TLS 1.3 everywhere; mTLS (mutual TLS) for service-to-service inside the PCI zone.
- Secrets via KMS-backed HSM (Hardware Security Module); no static creds in source or committed env files.
- Auth: OIDC (OpenID Connect) for end-users; mTLS + short-lived JWT for internal services.
- Step-up auth (re-auth + biometric or OTP) required for issuance, raising any limit, and one-time full-PAN view.
- Authorization is role-based, evaluated server-side per request.
- Replay protection on every state-changing endpoint: 24-h idempotency key + request nonce; ±5 s clock-skew tolerance.

### 4.2 Privacy

- GDPR Art. 15 / 17 supported via per-card data export and pseudonymized deletion; audit log retained 7 years for AML (Anti-Money-Laundering) — documented exception to right-to-erasure.
- Cardholder name is never stored in the same row as the PAN token; joined at presentation only.
- Data stays in the user's home region; cross-region replication is encrypted in transit and at rest.

### 4.3 Audit & Logging

- Append-only audit log on WORM (Write-Once-Read-Many) storage. INSERT-only role enforced at the database layer.
- Every state transition logs: `actor_id, actor_role, action, card_id_token, before_state, after_state, reason, request_id, ip_masked, user_agent, ts_utc`.
- **No-fly list** — PAN, CVV, expiry, magstripe data, full cardholder name, and full IP outside the PCI zone must never reach any log, metric label, trace attribute, or analytics payload. This is policy; §5 and §9 implement it.
- Retention: hot 90 days, cold 7 years (AML floor); transition is automated and itself audited.

### 4.4 Reliability SLOs

| Surface | Target |
|---|---|
| Issue card | P50 ≤ 1.2 s · P95 ≤ 5 s · P99 ≤ 8 s |
| Freeze (tap → next authorization rejected) | P95 ≤ 800 ms |
| Unfreeze | P95 ≤ 1 s |
| List transactions (50 items, cursor-paginated) | P95 ≤ 400 ms |
| Set limits | P95 ≤ 600 ms |
| Availability — end-user surfaces | 99.95 % monthly |
| Availability — authorization decision path | 99.99 % monthly |
| RTO / RPO — card state DB | 15 min / 1 min |

*v1 assumption — single-region deployment; cross-region targets in §4.5 are forward design constraints, not launch commitments.*

### 4.5 Performance Budgets *(assumed targets — basis in line)*

- **200 freeze/sec per region** — sized for a fraud-incident burst at ~10M-user scale, based on peer-fintech reports.
- **5 000 authorization decisions/sec** — derived from `50 tx/day/active-card × 5M active cards / 86 400 s × peak factor 1.8`.
- **Read-after-write consistency ≤ 500 ms** for card state across replicas — beyond this, "my freeze didn't work" becomes a measurable UX defect.
- **800 ms freeze P95** — below the user's "didn't work" perception threshold relative to a 1–2 s payment-terminal interaction.
- **Pagination** — cursor-based, hard cap 200 items/page. Offset pagination is forbidden (enables enumeration probes).
- **Rate limits per user** — 5 issue/hour, 60 freeze-toggle/hour, 10 limit-changes/day. Surfaced via `Retry-After`.

Numbers are reviewed quarterly against telemetry; >20 % drift triggers a spec update.

---

## §5. Implementation Notes *(non-negotiable guardrails)*

- **Money** — minor units in `BIGINT`, arithmetic via a Decimal library (never `float`), always paired with ISO 4217 currency; mixed-currency arithmetic rejected at the type level.
- **Identifiers** — `card_id` is an opaque ULID; the PAN token is a vault-issued opaque string; internal surrogate ids never appear in APIs or logs.
- **Idempotency** — every write endpoint requires `Idempotency-Key`; 24-h deduplication; same key + different body returns 422.
- **State machine** — explicit FSM: `PENDING → ACTIVE → {FROZEN ↔ ACTIVE} → CLOSED`. CLOSED is terminal. Each transition has a role-allowlist. Direct UPDATE on the `state` column is forbidden — the FSM module is the only writer.
- **Errors** — RFC 7807 `application/problem+json`. No stack traces, internal hostnames, or PII in error bodies.
- **Encryption at rest** — application-layer field encryption (envelope, KMS-wrapped) for limit configs, reasons, and PII columns.
- **Time** — UTC everywhere; ISO 8601 with offset on the wire.
- **Concurrency** — optimistic locking on the card row via a `version` column; mismatch returns 409.
- **Logging** — see §4.3 *No-fly list*. The PII scrubber in L-15 is the runtime enforcement.

---

## §6. Context

**Beginning** — `services/issuer-vault/` (PAN tokenization, third-party-style boundary), `services/auth-engine/` (authorization decisions, consumes a card-state cache), `services/risk/` (publishes signals on `risk.signals`), `infra/kms/` (one master key per env, workload-identity access), `db/cards` and `db/audit_log` (empty; INSERT-only role wired for audit), OIDC identity provider with roles `customer`, `ops`, `compliance`, `support`, `fraud_service`. `services/card-lifecycle/` exists empty.

**Ending** — `services/card-lifecycle/` populated (REST API, FSM module, vault adapter, audit logger, fraud webhook, PII scrubber). `db/cards` and `db/card_limits` migrated. `events/card.*` topics emit `card.issued | frozen | unfrozen | limit_changed | closed` with PII-safe payloads. OpenAPI doc published. Runbooks at `docs/runbooks/freeze-storm.md` and `docs/runbooks/audit-export.md`.

---

## §7. Edge Cases & Failure Modes

| # | Scenario | Expected behavior | Audit / compliance |
|---|---|---|---|
| E-1 | User taps Freeze while a transaction is in-flight at the network | Auth engine rejects new auths within 2 s. Already-cleared auths settle as pending with note "occurred before freeze". | Log `FREEZE_RACE_WITH_AUTH` with both timestamps. |
| E-2 | Concurrent Freeze + Unfreeze from same user within 1 s | Idempotency-key dedup; final state = last server-received request. UI reflects authoritative state, not optimistic. | Log both attempts; not a defect. |
| E-3 | Set daily limit below already-spent-today | 422 with `effective_tomorrow` hint; do not retroactively block cleared spend. | Log policy-change attempt with current spend snapshot. |
| E-4 | Issue request — vault times out after our call | Roll back card insert; return retryable error; compensating revoke if vault later acks. No orphan token. | Compensating event with vault correlation id. |
| E-5 | EU user requests GDPR Art. 17 erasure | Pseudonymize PII columns within 30 days; retain audit log with anonymized actor reference per AML. | Compliance approval workflow runs first; the deletion is itself an audited event. |
| E-6 | Full-PAN view request without step-up auth in last 5 min | 403; force step-up; one-time reveal with 30-s visible window, no browser cache. | Log sensitive-data-access with reason + actor. |
| E-7 | Rate limit exceeded on freeze toggle (>60/h) | 429 with `Retry-After`; do not consume the idempotency key. | Log; trigger UX cooldown hint. |
| E-8 | Stale card-state cache after region failover | Auth engine falls back to authoritative store within 200 ms. UI shows "syncing" badge if delta > 2 s. | Log cache-miss-after-failover; surface on dashboard. |
| E-9 | KYC status flips to FAIL between issue request and commit | Roll back card insert; surface generic "cannot issue at this time". Never disclose KYC failure to the remote caller. | Log KYC-race; compliance counter. |
| E-10 | Negative, zero, or overflow limit | 422 with documented per-currency min/max bounds; server-side enforced. | Log validation failure. |

Lower-priority edges (denied transitions on CLOSED cards, unknown card_id from fraud service, tampered pagination cursor, concurrent limit change during in-flight auth, post-account-close transaction read) are handled by the §5 guardrails plus the standard error semantics; no special row.

---

## §8. Verification

Per mid-level objective: what tests prove it works. Test types are listed as **documentation of expected verification**, not as a coding requirement of this homework.

| Objective | Unit | Integration | End-to-end / chaos | Compliance check |
|---|---|---|---|---|
| **M-1** Issue | FSM accepts only `PENDING → ACTIVE` on issue | Vault stub: success / timeout / reject branches | Issue → list → see card with last-4 only | Grep 7 days of staging logs: no PAN anywhere |
| **M-2** Freeze | FSM transition table exhaustive | Freeze → attempt auth → rejected within SLO | Chaos: kill auth-engine mid-freeze; assert eventual consistency ≤ 500 ms | — |
| **M-3** Limits | Property-based Decimal arithmetic across currencies | Spend up to and 1-minor-unit over cap → rejected | Concurrency: 50 parallel limit changes; last-write-wins | Limits audit trail complete |
| **M-4** Transactions | Pure-function dispute-eligibility (day 60 vs 61) | Contract test on response shape; redaction snapshot | Cursor stability under concurrent inserts | Snapshot has no PAN/CVV fields |
| **M-5** Audit | Every transition emits required field set | Insert-only role: UPDATE/DELETE attempts fail at DB level | — | Random 30-day audit sample: every state change has a row |
| **M-6** Fraud | HMAC signature + nonce validation | Replay attack rejected even with valid signature | — | Notification delivered within 30 s |
| **M-7** PII | PAN-shaped value redacted by scrubber | Log lint rule fails CI on a fixture logging `pan: card.pan` | — | Scrubber idempotent; latency p99 < 50 µs |

**Definition of Done (cross-cutting)** — every L-task in §9 ends with explicit `Acceptance criteria` checkboxes. A PR closing an L-task ticks each box.

---

## §9. Low-Level Tasks

Each task uses the template's prompt / file / function / details shape plus `Acceptance criteria` and `Out of scope`. 15 tasks, grouped by mid-objective.

---

### M-1 — Issue card

#### L-01. Define `cards` table schema and migration

**Prompt:** Create the `cards` table migration with FSM state, version column, vault token ref, last-4, currency, owner_id, timestamps; reversible.

**File:** `services/card-lifecycle/migrations/0001_create_cards.sql` · **Function:** migration + reverse migration

**Details:**
- Columns: `id ULID PK`, `owner_id ULID FK`, `state TEXT CHECK (state IN ('PENDING','ACTIVE','FROZEN','CLOSED'))`, `version BIGINT NOT NULL DEFAULT 0`, `vault_token TEXT NOT NULL`, `last_four CHAR(4) NOT NULL`, `currency CHAR(3) NOT NULL`, `created_at`, `updated_at`, `closed_at NULL`.
- Indexes: `(owner_id, updated_at DESC)`; partial index on `state = 'ACTIVE'`.
- No PAN column (compile-time leak prevention).

**Acceptance criteria:**
- [ ] Migration applies and reverses cleanly.
- [ ] `currency` is NOT NULL.
- [ ] No PAN column exists.

**Out of scope:** seed data, views, audit-log schema (L-13).

---

#### L-02. `POST /v1/cards` endpoint

**Prompt:** Implement card issuance: validate, honor `Idempotency-Key`, insert as PENDING, call vault (L-03), transition to ACTIVE on success, emit `card.issued` (L-04).

**File:** `services/card-lifecycle/api/cards_create.ts` · **Function:** `createCardHandler`

**Details:**
- Step-up auth required (§4.1).
- Rate limit 5/hour/user (§4.5).
- On vault failure → compensating delete + retryable problem+json.
- Response: `card_id, last_four, state, currency, created_at`. Never the vault token.

**Acceptance criteria:**
- [ ] Duplicate idempotency key within 24 h returns the original response.
- [ ] Missing step-up returns 403 with `step_up_required` problem type.
- [ ] Vault timeout leaves no orphan row.

**Out of scope:** vault adapter internals (L-03).

---

#### L-03. Vault integration adapter

**Prompt:** Implement an issuer-vault client with `mintToken(currency)` and `revokeToken(token)`, 3 s timeout, compensating revoke on timeout, mTLS.

**File:** `services/card-lifecycle/integrations/vault.ts` · **Function:** `VaultClient`

**Details:**
- Retry: 1 on 5xx, none on 4xx, none on timeout (compensate instead).
- All calls traced with `vault_correlation_id`; never exposed externally.

**Acceptance criteria:**
- [ ] Timeout enqueues compensating revoke within 1 s.
- [ ] Only `mintToken` / `revokeToken` exported.
- [ ] mTLS handshake failure → structured alert, no stack trace.

**Out of scope:** vault server.

---

#### L-04. Emit `card.issued` via outbox

**Prompt:** Publish `card.issued` to `events.card` via outbox, transactionally with FSM commit. Payload PII-safe.

**File:** `services/card-lifecycle/api/cards_create.ts` (update) and `services/card-lifecycle/events/card_events.ts` (create) · **Function:** `emitCardIssued`

**Details:**
- Payload: `card_id, owner_id, last_four, currency, issued_at, request_id, schema_version: 1`.
- Outbox table written in the same DB transaction; relayer publishes async.

**Acceptance criteria:**
- [ ] FSM rollback → no event published.
- [ ] Payload schema contract-tested against a consumer fixture.

**Out of scope:** consumers.

---

### M-2 — Freeze / Unfreeze

#### L-05. FSM module

**Prompt:** Implement the FSM with declarative transition table; `transition(card, action, actor, expectedVersion)` returns committed row or structured `TransitionDenied`.

**File:** `services/card-lifecycle/domain/card_fsm.ts` · **Function:** `transition`

**Details:**
- Transition table is the only place state rules live.
- Role allowlist per transition (e.g. freeze: `customer`, `ops`, `fraud_service`; close: `ops`, `compliance`).
- `version` mismatch → `TransitionDenied{ reason: 'version_conflict' }`.

**Acceptance criteria:**
- [ ] Disallowed transitions return `TransitionDenied`, never throw.
- [ ] Transition table is exported for doc generation.

**Out of scope:** API surface (L-06).

---

#### L-06. `POST /v1/cards/{id}/freeze` and `/unfreeze`

**Prompt:** Implement freeze and unfreeze endpoints routed through the FSM (L-05) and invalidating the auth-engine cache (L-07).

**File:** `services/card-lifecycle/api/cards_freeze.ts` · **Function:** `freezeCardHandler`, `unfreezeCardHandler`

**Details:**
- Rate limit 60/hour/user.
- `reason` is free-text, encrypted at rest.
- Step-up auth NOT required for freeze (must stay frictionless); IS required when unfreezing a fraud-frozen card.
- Version conflict → 409 with current version.

**Acceptance criteria:**
- [ ] Freeze meets §4.4 SLO in green-path test.
- [ ] Unfreezing fraud-frozen card without step-up returns 403.

**Out of scope:** cache contract (L-07).

---

#### L-07. Auth-engine cache invalidation

**Prompt:** Publish card-state invalidation to the auth-engine within the §4.4 SLO; retry up to 3 s; on failure, anomaly-log and continue (auth engine has a store fallback).

**File:** `services/card-lifecycle/integrations/auth_cache.ts` · **Function:** `invalidateCard(cardId, version)`

**Details:**
- Include `version` so consumer ignores stale invalidations.
- 3 retries with exponential backoff; then anomaly alert.

**Acceptance criteria:**
- [ ] Lost invalidation increments anomaly counter (not silent).
- [ ] Version-decreasing invalidation is ignored at consumer.

**Out of scope:** auth-engine internals.

---

#### L-08. Freeze-race concurrency test fixture

**Prompt:** Integration test simulating 50 parallel Freeze/Unfreeze from one user; assert final state = server-time-latest request and audit log contains all attempts.

**File:** `services/card-lifecycle/tests/freeze_race.test.ts` · **Function:** `freeze_race`

**Details:**
- Ephemeral DB.
- Documents E-2.

**Acceptance criteria:**
- [ ] Test deterministically reproduces and passes.
- [ ] All 50 attempts visible in audit log.

**Out of scope:** load / stress testing.

---

### M-3 — Spending limits

#### L-09. `card_limits` table + `PUT /v1/cards/{id}/limits` endpoint

**Prompt:** Add the `card_limits` table (daily / monthly / per-tx caps in minor units, currency matches card) and the limits update endpoint with per-currency policy and KYC-tier ceilings.

**File:** `services/card-lifecycle/migrations/0002_create_card_limits.sql` and `services/card-lifecycle/api/cards_limits.ts` · **Function:** migration + `updateLimitsHandler`

**Details:**
- Schema: `card_id, daily_cap_minor, monthly_cap_minor, per_tx_cap_minor, currency, version, effective_from, updated_at`. Mismatched card/limits currency rejected by constraint.
- Endpoint: step-up auth required when raising any cap. Rate limit 10/day/user. Lowering daily cap below already-spent-today returns 422 with `effective_tomorrow` hint (E-3).
- Audit row written before response.

**Acceptance criteria:**
- [ ] Migration reverses cleanly.
- [ ] Currency mismatch returns 422.
- [ ] Lowering below already-spent returns 422 with `effective_tomorrow`.
- [ ] Audit row present for every successful change.

**Out of scope:** read path (L-10).

---

#### L-10. Limit-vs-spent read endpoint

**Prompt:** Implement `GET /v1/cards/{id}/limits` returning configured caps plus today's and this-month's spend, consistent with the writer within 1 s.

**File:** `services/card-lifecycle/api/cards_limits.ts` (extend) · **Function:** `getLimitsHandler`

**Details:**
- Spend derived from the transaction store, not stored on the card row (avoids drift).
- Cache TTL ≤ 1 s.

**Acceptance criteria:**
- [ ] Sum-of-transactions matches returned spend in fixtures.
- [ ] Stale read older than 1 s is refreshed.

**Out of scope:** authorization engine.

---

### M-4 — Transaction visibility

#### L-11. `GET /v1/cards/{id}/transactions` with cursor pagination + redaction

**Prompt:** Implement transaction list with opaque cursor pagination (cap 200, default 50) and role-aware field projection.

**File:** `services/card-lifecycle/api/cards_transactions.ts` · **Function:** `listTransactionsHandler`

**Details:**
- Cursor is encrypted server-side; tampering returns 400 without disclosing record existence.
- Snapshot isolation; pagination stable against concurrent inserts.
- User view excludes internal risk score; ops view includes it.

**Acceptance criteria:**
- [ ] Tampered cursor → 400 invalid_cursor without leakage.
- [ ] User payload has no PAN/CVV/expiry (snapshot test).
- [ ] P95 ≤ 400 ms at 1 000 tx/card fixture.

**Out of scope:** transaction ingestion pipeline.

---

#### L-12. Dispute-eligibility derivation

**Prompt:** Derive `dispute_eligible: boolean` per transaction. Eligible iff CLEARED, within 60 days, not already disputed, merchant category not excluded.

**File:** `services/card-lifecycle/api/cards_transactions.ts` (update) · **Function:** `disputeEligibility(tx)`

**Details:**
- Pure function; unit-testable.
- Excluded-merchant list is config-driven.

**Acceptance criteria:**
- [ ] Property-based tests cover the day-60 / day-61 boundary.
- [ ] No side effects.

**Out of scope:** dispute submission API.

---

### M-5 / M-6 / M-7 — Cross-cutting

#### L-13. Audit logger module

**Prompt:** Implement the audit logger that every state-changing handler calls. Writes go to WORM `audit_log` inside the same DB transaction as the state change. Role-aware redaction at read time.

**File:** `services/card-lifecycle/domain/audit.ts` · **Function:** `auditLog(entry)`, `auditQuery(filter, viewerRole)`

**Details:**
- Insert-only DB role enforced at the database layer.
- Compliance-export pagination mode.
- Missing required field is a compile-time error.

**Acceptance criteria:**
- [ ] UPDATE/DELETE attempts as any app role fail at the DB.
- [ ] Customer role never sees the internal `reason` field.

**Out of scope:** cold-tier migration.

---

#### L-14. Fraud webhook receiver

**Prompt:** Implement inbound webhook for the fraud service to freeze a card or reject an authorization. Verify HMAC-SHA256 over `body + timestamp + nonce`; 60-s replay window; failure returns 401 with no body.

**File:** `services/card-lifecycle/api/fraud_webhook.ts` · **Function:** `fraudWebhookHandler`

**Details:**
- Signing key rotated quarterly.
- Nonce store TTL 5 minutes.
- Successful freeze triggers user notification (M-6, 30-s budget).

**Acceptance criteria:**
- [ ] Replay rejected even with valid signature.
- [ ] Unknown `card_id` → 404 without disclosing internal state.

**Out of scope:** fraud service producer code.

---

#### L-15. PII scrubber middleware + log-lint rule

**Prompt:** Add a log-pipeline middleware that redacts keys matching `pan|cvv|card_number|expiry|magstripe` (case-insensitive) and any value matching the Luhn-valid PAN regex (13–19 digits). Add a static lint rule that fails CI if those keys are used as log fields.

**File:** `services/card-lifecycle/observability/pii_scrubber.ts` and `tools/eslint-rules/no-pan-logging.js` · **Function:** `scrub(entry)`, `no-pan-logging` rule

**Details:**
- Scrubber idempotent; double-scrub is a no-op.
- Microbenchmark target: p99 < 50 µs per event.

**Acceptance criteria:**
- [ ] Synthetic PAN-shaped value → `***` before reaching the log sink.
- [ ] CI fails on a fixture logging `pan: card.pan`.
- [ ] p99 latency under 50 µs in benchmark.

**Out of scope:** rebuilding the logging stack.

---

## §10. Open Questions

These need stakeholder answers before build start. Listed explicitly so they cannot quietly become silent assumptions.

- **KYC tier ↔ max card count.** Can tier-2 users hold more than 3 active cards simultaneously? Spec currently assumes yes; compliance to confirm.
- **Dispute window length.** §L-12 uses 60 days. The exact regulatory window varies per region — confirm with legal which region drives the constraint.
- **Step-up auth grace period.** §4.1 says 5 minutes. Confirm this matches the org's auth policy or should be tighter for fintech surfaces.
- **Audit export format.** Compliance to choose JSONL, CSV, or a regulator-specific PDF — affects L-13 export mode.
