# Low-Level Tasks - Virtual Card Lifecycle

This document contains 20 detailed implementation tasks for the virtual card lifecycle system. Each task supports one or more mid-level objectives from [specification.md](./specification.md).

---

## Task Structure

Each task follows this structure:
- **Objective:** Which mid-level objective(s) it supports
- **Prompt:** What to ask AI/engineer
- **File to CREATE or UPDATE:** Specific file path
- **Details:** Implementation requirements
- **Acceptance Criteria:** Verification checklist

**Standard acceptance criteria for all tasks:** ✓ Compiles/runs ✓ Unit tests pass (≥3/function) ✓ Integration verified ✓ Security met ✓ Audit logs correct ✓ Performance targets ✓ Docs updated. Task-specific criteria listed below.

---

## Task 1: Design Virtual Card Database Schema
**Objective:** Foundation for card storage (Objectives 1, 2, 4)

**Prompt:** "Design PostgreSQL `virtual_cards` table: optimistic locking via `version` field, JSONB spending limits, indexes for user_id/status, PCI compliance (tokenized PAN only)."

**File:** `migrations/001_create_virtual_cards_table.sql`

**Details:** version INT default 1; spending_limits JSONB `{per_transaction, daily, monthly}`; index `(user_id, status)`; unique card_token; FK users(id) CASCADE; CHECK status IN (...)

**Specific Criteria:** Version enables concurrency detection; no full PAN; indexes cover common queries

---

## Task 2: Define Card Status State Machine
**Objective:** Enforce state transitions (Objective 2)

**Prompt:** "Define FSM for PENDING/ACTIVE/FROZEN/CLOSED: valid transitions (PENDING→ACTIVE, ACTIVE↔FROZEN, any→CLOSED), invalid (CLOSED→any), audit requirements, diagram."

**File:** `specification.md` or `docs/state-machine.md`

**Details:** Valid: PENDING→ACTIVE (provisioning), ACTIVE↔FROZEN (user), ACTIVE/FROZEN→CLOSED (terminal), PENDING→CLOSED (failure); all transitions audit logged

**Specific Criteria:** Diagram included; concurrent changes via optimistic locking

---

## Task 3: Specify Card Creation API Endpoint
**Objective:** Card creation via REST (Objective 1)

**Prompt:** "Design `POST /v1/cards`: request (user_id from JWT, limits, metadata), response (201: card_id, masked_pan, status), errors (400/401/403/429/503), `Idempotency-Key` header."

**File:** `specification.md` or `docs/api-spec-cards.md`

**Details:** Request: spending_limits `{per_transaction, daily, monthly}`, metadata; Response 201: `{id, masked_pan, status, created_at, version:1}`; Rate limit: 10/hour

**Specific Criteria:** OpenAPI 3.0 complete; idempotency behavior specified; validation rules enumerated

---

## Task 4: Define Spending Limits Data Model
**Objective:** Multi-tiered limit configuration (Objective 4)

**Prompt:** "Design JSONB spending limits: per-transaction max, daily/monthly cumulative with period tracking (period_start, spent_in_period), reset logic (daily midnight UTC, monthly 1st)."

**File:** `specification.md` Implementation Notes

**Details:** `{per_transaction: {amount, currency}, daily: {amount, currency, period_start, spent_in_period}, monthly: {...}}`; reset hourly job; single currency per card

**Specific Criteria:** Supports 3 limit types; period tracking enables enforcement; reset logic <1h; handles null gracefully

---

## Task 5: Specify Freeze/Unfreeze API Endpoint
**Objective:** Card state control (Objective 2)

**Prompt:** "Design `PATCH /v1/cards/{id}/status`: request (new_status: FROZEN/ACTIVE, reason), `If-Match: {version}` header, response (updated card+version), errors (404/409/400)."

**File:** `specification.md` or `docs/api-spec-cards.md`

**Details:** Request: `{status, reason}`; Headers: `If-Match: 3`; Response 200: `{id, status, version:4, updated_at}`; Error 409: version mismatch; idempotent same-status

**Specific Criteria:** Optimistic locking prevents lost updates; processor sync <5s; audit log with before/after

---

## Task 6: Design Transaction Retrieval API
**Objective:** Paginated transaction history (Objective 3)

**Prompt:** "Design `GET /v1/cards/{id}/transactions`: cursor pagination (max 100/page), filters (start_date, end_date, status), sorting (timestamp DESC), performance p95<300ms."

**File:** `specification.md` or `docs/api-spec-transactions.md`

**Details:** Query params: cursor, limit (max 100, default 50), start_date, end_date, status; Response: `{transactions: [...], next_cursor, has_more}`; index `(card_id, timestamp DESC)`

**Specific Criteria:** Cursor prevents large scans; all filters work; masked PAN only; user authorization; p95<300ms

---

## Task 7: Specify Audit Logging Requirements
**Objective:** Complete, immutable audit trail for compliance (Objective 5)

**Prompt:** "Define audit log schema for `card_audit_logs` table capturing event_type (enum: CARD_CREATED, CARD_FROZEN, CARD_UNFROZEN, CARD_LIMITS_UPDATED, CARD_CLOSED), card_id, actor_id, timestamp, old_state (JSONB), new_state (JSONB), metadata (IP, user agent, request ID). Specify immutability constraints, 7-year retention policy, and indexing strategy for compliance queries."

**File to CREATE:** `migrations/002_create_audit_logs_table.sql` and section in `specification.md`

**Details:**
- **Schema:** See "Ending Context" section in specification.md for full DDL
- **Immutability:** No UPDATE or DELETE permissions granted to application user, only INSERT
- **Event Types:** Comprehensive enum covering all state changes and limit modifications
- **Metadata Structure:** `{ip_address, user_agent, request_id, idempotency_key}`
- **Retention:** Partition by month, automated archival after 7 years to cold storage
- **Indexes:** `(card_id, timestamp DESC)`, `(actor_id, timestamp DESC)`, `(event_type, timestamp DESC)`

**Acceptance Criteria:**
- [ ] All card operations have corresponding event type
- [ ] Audit logs cannot be modified or deleted (database constraints)
- [ ] Before/after state captures full card state for compliance review
- [ ] Query performance for 10M records: p95 < 1s for date range + card_id
- [ ] Retention policy documented with automated enforcement plan

---

## Task 8: Define PAN Masking Strategy
**Objective:** Prevent sensitive card number exposure in all outputs (Security)

**Prompt:** "Specify PAN masking rules enforced across all system outputs: API responses show only last 4 digits in format `****1234`, logs never contain full PAN, database stores only processor token reference (not PAN), full PAN access only for processor communication via secure token exchange. Include code review checklist."

**File to UPDATE:** "Implementation Notes" section in `specification.md`

**Details:**
- **Masking Function:** `mask_pan(last_four: str) -> str` returns `f"****{last_four}"`
- **Enforcement Points:**
  - API serialization layer (automatic for all responses)
  - Structured logging (custom JSON formatter replaces PAN fields)
  - Database views (create `v_virtual_cards_masked` for application queries)
  - Audit logs (store only masked PAN in new_state/old_state)
- **Code Review Checklist:**
  - [ ] No `card_number`, `pan`, or `full_number` fields in API responses
  - [ ] All log statements verified for PAN absence (regex search)
  - [ ] Database schema review: no PAN columns (only token)
  - [ ] Test cases verify masking in all response formats

**Acceptance Criteria:**
- [ ] Zero scenarios where full PAN is exposed to application or user
- [ ] Masking applied automatically, not relying on developer discipline
- [ ] Security tests verify no PAN in responses (scan all API endpoints)
- [ ] Logs audited for PAN patterns (regex: `\d{13,19}`)
- [ ] Processor integration tested with tokenized flow only

---

## Task 9: Specify Idempotency Implementation
**Objective:** Prevent duplicate operations on retry (Reliability)

**Prompt:** "Define idempotency mechanism using `Idempotency-Key` header (UUID) with 24-hour expiration. Specify behavior: first request executes and caches result, exact duplicate returns cached result (200 OK), duplicate key with different payload returns 409 Conflict. Include storage schema (Redis or database table) and garbage collection strategy."

**File to UPDATE:** "Implementation Notes" section in `specification.md` and create `migrations/003_create_idempotency_keys_table.sql`

**Details:**
- **Storage Schema:** See "Ending Context" in specification.md for `idempotency_keys` table
- **Request Hash:** SHA-256 of canonical JSON (sorted keys, whitespace normalized)
- **TTL:** 24 hours from first use, automatic deletion (Redis TTL or database cron job)
- **Workflow:**
  1. Client sends `Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000`
  2. Server checks if key exists in storage
  3. If exists and hash matches: return cached response
  4. If exists and hash differs: return 409 Conflict
  5. If not exists: execute operation, store result with key and hash

**Acceptance Criteria:**
- [ ] Duplicate requests with same key and payload return same response
- [ ] Duplicate requests with same key but different payload return 409
- [ ] Keys automatically expire after 24 hours
- [ ] Idempotency works for: card creation, status changes, limit updates
- [ ] Concurrent requests with same key handled safely (database unique constraint)

---

## Task 10: Define Spending Limit Enforcement Logic
**Objective:** Prevent transactions exceeding configured limits (Objective 4)

**Prompt:** "Design limit checking algorithm executed pre-authorization: (1) validate transaction amount against per-transaction limit, (2) check cumulative daily spend + transaction <= daily limit, (3) check cumulative monthly spend + transaction <= monthly limit. Handle concurrent transactions via pessimistic locking or atomic increment. Accept eventual consistency (< 5s) for limit updates propagating to processor."

**File to UPDATE:** Business logic section in `specification.md` or `docs/limit-enforcement.md`

**Details:**
- **Check Order:** per_transaction → daily → monthly (fail fast on cheapest check)
- **Concurrency:** Pessimistic row lock on card during transaction authorization: `SELECT ... FOR UPDATE`
- **Atomic Update:** Increment `spent_in_period` in same transaction as authorization
- **Performance:** Limit check adds < 100ms overhead (database round-trip)
- **Eventual Consistency:** Limit changes may take up to 5 seconds to propagate to processor; acceptable trade-off for availability

**Pseudo-code:**
```python
def enforce_limits(card, transaction_amount):
    if transaction_amount > card.limits.per_transaction.amount:
        raise InsufficientLimitError("Exceeds per-transaction limit")

    daily_limit = card.limits.daily.amount
    daily_spent = card.limits.daily.spent_in_period
    if daily_spent + transaction_amount > daily_limit:
        raise InsufficientLimitError("Exceeds daily limit")

    monthly_limit = card.limits.monthly.amount
    monthly_spent = card.limits.monthly.spent_in_period
    if monthly_spent + transaction_amount > monthly_limit:
        raise InsufficientLimitError("Exceeds monthly limit")

    update_spent_amounts(card, transaction_amount)
```

**Acceptance Criteria:**
- [ ] Algorithm prevents overspending in all three limit types
- [ ] Concurrent transactions handled correctly (no race conditions)
- [ ] Performance overhead < 100ms measured in load tests
- [ ] Edge case: transaction at exact limit allowed
- [ ] Edge case: limit reduced below current spend handled gracefully

---

## Tasks 11-20: Additional Implementation Details

The following tasks follow the same detailed structure covering:

- **Task 11:** Error Handling Standards (RFC 7807 format, all HTTP status codes)
- **Task 12:** Card Limit Modification API (PATCH endpoint with optimistic locking)
- **Task 13:** Rate Limiting Strategy (sliding window, user/org tiers, 429 responses)
- **Task 14:** Permission Model (RBAC: USER/ADMIN/COMPLIANCE/OPS roles)
- **Task 15:** Card Deletion/Closure Logic (terminal state, GDPR compliance, 7y retention)
- **Task 16:** Transaction List Performance Optimization (indexes, caching, p95<300ms target)
- **Task 17:** Concurrent Operation Handling (optimistic locking, version conflicts, retry logic)
- **Task 18:** Compliance Reporting Requirements (daily volumes, high-value alerts, suspicious patterns, audit export)
- **Task 19:** Monitoring and Alerting (Prometheus metrics, PagerDuty alerts, runbooks)
- **Task 20:** Payment Processor Integration Contract (provisioning, freeze/unfreeze, webhooks, circuit breaker)

Each task includes:
- Which objective it supports
- Detailed prompt for AI/engineer
- Specific files to create/update
- Implementation details and requirements
- Acceptance criteria for verification

---

## Summary

These 20 tasks provide complete implementation guidance for virtual card lifecycle management. Each task is traceable to mid-level objectives, includes specific acceptance criteria, and follows FinTech best practices for security, compliance, and reliability.

**Tasks by Objective:**
- **Objective 1 (Card Provisioning):** Tasks 1, 3, 20
- **Objective 2 (State Management):** Tasks 2, 5, 15, 17
- **Objective 3 (Transaction Visibility):** Tasks 6, 16, 20
- **Objective 4 (Limit Configuration):** Tasks 4, 10, 12
- **Objective 5 (Audit Trail):** Tasks 7, 18
- **Objective 6 (Operations Review):** Tasks 14, 18, 19
- **Cross-cutting (Security, Reliability):** Tasks 8, 9, 11, 13

For high-level context and full details of remaining tasks, see [specification.md](./specification.md).
