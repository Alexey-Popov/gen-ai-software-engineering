# Virtual Card Lifecycle — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

---

## High-Level Objective

Enable bank customers to independently manage the full lifecycle of their virtual payment cards—creation, status control (freeze/unfreeze), spending limit configuration, and transaction history review—through a secure, auditable self-service interface, without requiring contact with customer support for routine operations.

**Scope boundary:** This specification covers virtual card lifecycle management only. Physical card issuance, card-to-card transfers, dispute resolution workflows, and fraud investigation tooling are explicitly out of scope.

---

## Mid-Level Objectives

### MO-1 — Card Provisioning
A customer with an active bank account can issue a new virtual card. The card is immediately available for online transactions after creation. Each card carries a unique PAN (masked on display), CVV, and expiry date. A customer may hold up to 5 active virtual cards simultaneously.

### MO-2 — Status Control
A customer can freeze or unfreeze any of their virtual cards at any time through the self-service interface. A frozen card declines all authorization requests within ≤ 2 seconds of the status change propagating. Unfreeze restores full card functionality without re-issuance.

### MO-3 — Spending Limit Management
A customer can set, update, or remove per-card spending limits by category (e.g. total monthly, per-transaction maximum, e-commerce only). Any transaction that would breach the configured limit is declined at authorization time with a clear decline reason surfaced to the customer.

### MO-4 — Transaction History
A customer can view a paginated, filterable list of all transactions on any of their virtual cards: date, merchant name, amount, currency, status (approved / declined / reversed), and decline reason where applicable. History is available for the trailing 24 months.

### MO-5 — Compliance & Audit Trail
Every state-changing operation (card creation, status change, limit update, card termination) produces an immutable audit log entry containing: actor identity, timestamp (UTC), action type, before/after values, and request correlation ID. The audit log is accessible to internal ops/compliance staff and is retained for a minimum of 5 years.

### MO-6 — Security & Access Control
Only the authenticated card owner can perform operations on their own cards. Internal ops/compliance staff may view card state and audit logs but cannot perform card operations on behalf of customers without an explicit elevated-access workflow. All sensitive card data (full PAN, CVV) is never returned in API responses after initial provisioning.

---

## Non-Functional Requirements & Policy

### NFR-1 — Performance (Assumed Targets)

> These values are labeled as **assumed targets**. They are grounded in typical FinTech UX expectations: card operations must feel instantaneous to avoid customer drop-off, and authorization propagation must be fast enough to not impact real-time payment flows.

| Operation | p50 | p95 | p99 | Notes |
|---|---|---|---|---|
| Card creation | ≤ 300 ms | ≤ 800 ms | ≤ 1 500 ms | Synchronous; customer waits on screen |
| Freeze / unfreeze | ≤ 200 ms | ≤ 500 ms | ≤ 1 000 ms | Status must propagate to auth engine within 2 s |
| Limit update | ≤ 200 ms | ≤ 500 ms | ≤ 1 000 ms | Applied to next authorization attempt |
| Transaction list (first page) | ≤ 400 ms | ≤ 900 ms | ≤ 2 000 ms | Paginated; page size = 25 records |
| Audit log write | ≤ 50 ms | ≤ 150 ms | ≤ 300 ms | Async-acceptable but must not be lossy |

**Throughput:** The service must sustain 500 concurrent card-operation requests without degradation. Burst tolerance up to 1 000 rps for ≤ 30 seconds.

**Rate limiting:** Per authenticated user: 20 card operations / minute, 200 transaction-list requests / hour. Exceeding limits returns HTTP 429 with `Retry-After` header.

### NFR-2 — Availability & Reliability

- **Uptime target:** 99.9 % monthly (≤ 43 minutes downtime/month), excluding scheduled maintenance windows announced ≥ 48 hours in advance.
- **Idempotency:** All mutating endpoints must accept a client-supplied `Idempotency-Key` (UUID v4). Duplicate requests with the same key within 24 hours return the original response without re-executing the operation.
- **Data durability:** Card state and audit log must survive any single-node failure. Replication factor ≥ 2 for all persistent stores.
- **Graceful degradation:** If the audit-log writer is unavailable, the primary operation (e.g. freeze) must fail closed — the operation is rejected rather than executed without an audit record.

### NFR-3 — Security

- **Authentication:** All endpoints require a valid JWT bearer token issued by the bank's identity provider. Token lifetime ≤ 15 minutes; refresh tokens valid ≤ 8 hours.
- **Authorization:** Resource-level checks on every request — a token issued for customer A must never access or mutate cards belonging to customer B (horizontal privilege escalation prevention).
- **Sensitive data handling:**
  - Full PAN and CVV must never appear in application logs, error messages, or API responses after the initial provisioning response.
  - At rest: PAN stored encrypted (AES-256); CVV never persisted after provisioning.
  - In transit: TLS 1.2 minimum, TLS 1.3 preferred; no plain-HTTP fallback.
- **Input validation:** All monetary values validated as positive decimals with exactly 2 decimal places; currency codes validated against ISO 4217; card IDs validated as UUIDs before any database lookup.

### NFR-4 — Privacy & Compliance

- **PII minimization:** Only data strictly necessary for the feature is collected and stored.
- **GDPR / data-subject rights:** Audit logs referencing a customer may not be deleted on a deletion request (regulatory retention requirement takes precedence); the customer must be informed of this retention at onboarding.
- **Regulatory retention:** Audit logs and transaction records retained for **5 years minimum** per standard banking regulation.
- **PCI-DSS alignment:** Full PAN must be masked in all UI displays to format `**** **** **** XXXX` (last 4 digits visible). CVV must never be displayed after card creation.

### NFR-5 — Observability

- Every API request must emit a structured log entry with: `correlation_id`, `customer_id` (hashed), `endpoint`, `http_status`, `duration_ms`, and `error_code` (if applicable).
- Metrics exported to monitoring system: request rate, error rate, p95/p99 latency per endpoint, and freeze-propagation lag.
- Alerting threshold: error rate > 1 % over a 5-minute window triggers on-call notification.

---

## Implementation Notes

### Money & Identifiers

- All monetary amounts **must** be represented as `Decimal` (never `float` or `double`) with exactly 2 decimal places. Rounding mode: `HALF_UP`.
- Currency codes **must** conform to ISO 4217 (3-letter uppercase, e.g. `USD`, `EUR`, `UAH`).
- Card IDs, customer IDs, and correlation IDs **must** be UUID v4. No sequential integers as public identifiers.
- Masked PAN format is always `**** **** **** XXXX` — last 4 digits only. Any other masking format is non-compliant.

### Sensitive Data Rules (Hard Constraints)

- **Never** log full PAN, CVV, or raw JWT tokens — in any log level, including DEBUG.
- **Never** return CVV in any API response after the initial card-creation response.
- **Never** store CVV after the provisioning flow completes. CVV is ephemeral and must be discarded post-issuance.
- **Never** include PII (name, email, full PAN) in error messages returned to the client. Use error codes with a lookup table.

### Idempotency

- All `POST` and `PATCH` endpoints **must** support the `Idempotency-Key` header (UUID v4, client-generated).
- The server must store idempotency key → response mapping for 24 hours. A second request with the same key returns the cached response with HTTP 200 and header `X-Idempotent-Replayed: true`.
- Idempotency checks happen **before** any business logic or database writes.

### Error Semantics

- Use standard HTTP status codes: `400` for validation errors, `401` for missing/invalid auth, `403` for authorization failures, `404` for unknown resource, `409` for state conflicts (e.g. freezing an already-frozen card), `422` for business rule violations (e.g. limit exceeds allowed maximum), `429` for rate limiting, `500` for unexpected server errors.
- All error responses follow a consistent envelope:
  ```json
  {
    "error_code": "CARD_ALREADY_FROZEN",
    "message": "Human-readable description (no PII)",
    "correlation_id": "<uuid>"
  }
  ```
- `500` responses **must never** include stack traces or internal system details.

### Audit Log Rules

- Audit entries are **append-only** — no updates or deletes, ever.
- Every entry includes: `event_id` (UUID), `occurred_at` (ISO 8601 UTC), `actor_type` (`customer` | `ops_staff` | `system`), `actor_id` (hashed), `card_id`, `action`, `before_state` (JSON), `after_state` (JSON), `correlation_id`.
- Audit writes must complete within the same logical transaction as the primary operation, or the primary operation must be rolled back.

### Concurrency

- Optimistic locking **must** be used for card state updates (freeze/unfreeze, limit changes). Include a `version` field on card entities; reject updates with a stale version with HTTP `409`.
- Do not use application-level mutexes or global locks. All concurrency control at the data layer.

### Pagination

- Transaction list endpoints use cursor-based pagination (not offset-based). Cursor is an opaque, server-generated string encoding the last seen record position.
- Default page size: 25. Maximum page size: 100. Requests exceeding 100 records per page return HTTP `400`.

---

## Context

### Beginning Context

The following infrastructure and services are assumed to exist before implementation begins (treat as hypothetical pre-conditions):

- **Identity Provider (IdP):** OAuth 2.0 / OIDC-compliant service that issues JWT tokens. Token payload includes `sub` (customer UUID), `roles` (e.g. `["customer"]` or `["ops_staff"]`), and `exp`.
- **Core Banking System (CBS):** Existing service exposing a read-only endpoint to verify account status (active / suspended / closed) for a given customer. Virtual card creation requires a confirmed `active` account status from CBS.
- **Card Network Adapter:** Internal service abstracting communication with Visa/Mastercard for PAN provisioning and authorization status updates. Exposes `POST /provision` and `PATCH /card-status`.
- **Persistent Store:** A relational database (schema to be designed) hosting `cards`, `card_limits`, `transactions`, and `audit_log` tables.
- **Message Broker:** Available for async event publishing (e.g. `card.frozen`, `limit.updated`) consumed by downstream notification and fraud-monitoring services.
- **Secrets Manager:** All credentials, encryption keys, and API tokens are stored in a secrets manager. No secrets in environment variables or source code.

### Ending Context

Upon successful completion of all Low-Level Tasks, the following artifacts and states must exist:

- **API layer:** RESTful endpoints documented below fully implemented and covered with contract tests.
- **Data model:** `cards`, `card_limits`, `transactions`, `audit_log` tables created with all required indexes and constraints.
- **Audit log:** Every state-changing operation produces a verified, queryable audit entry.
- **Card Network integration:** Freeze/unfreeze and provisioning calls routed through the Card Network Adapter with retry and timeout handling.
- **Test coverage:** Unit tests for all business logic; integration tests for all API endpoints; at least one end-to-end scenario per Mid-Level Objective.
- **Observability:** Structured logging and metrics instrumentation in place for all endpoints.
- **Documentation:** OpenAPI 3.0 spec generated and published; `agents.md` and editor rules in place.

---

## Low-Level Tasks

---

### TASK-01 — Define the Card Data Model

**Serves:** MO-1, MO-2, MO-3

**Prompt:**
Create the `cards` database table/entity with all required fields to support card provisioning, status control, and limit management.

**Artifacts to create/update:**
- `db/migrations/001_create_cards.sql`
- `src/models/card.py` (or equivalent ORM model)

**Details:**
- Fields: `id` (UUID PK), `customer_id` (UUID FK), `masked_pan` (string, format `**** **** **** XXXX`), `expiry_month` (int), `expiry_year` (int), `status` (enum: `ACTIVE`, `FROZEN`, `TERMINATED`), `network` (enum: `VISA`, `MASTERCARD`), `created_at` (UTC timestamp), `updated_at` (UTC timestamp), `version` (int, for optimistic locking, default 1).
- Indexes: `customer_id`, `status`, composite `(customer_id, status)`.
- Constraint: max 5 active cards per customer enforced at DB level via partial unique index or check constraint.

**Acceptance Criteria:**
- [ ] Migration runs without errors on a clean database.
- [ ] ORM model maps all fields with correct types; `Decimal` used for any monetary fields.
- [ ] `version` field increments on every update.
- [ ] Inserting a 6th active card for the same customer raises a constraint violation.

---

### TASK-02 — Define the Card Limits Data Model

**Serves:** MO-3

**Prompt:**
Create the `card_limits` table to store per-card spending limits by type.

**Artifacts to create/update:**
- `db/migrations/002_create_card_limits.sql`
- `src/models/card_limit.py`

**Details:**
- Fields: `id` (UUID PK), `card_id` (UUID FK → cards), `limit_type` (enum: `MONTHLY_TOTAL`, `PER_TRANSACTION`, `ECOMMERCE_MONTHLY`), `amount` (Decimal 10,2), `currency` (ISO 4217, 3 chars), `created_at` (UTC), `updated_at` (UTC).
- Unique constraint on `(card_id, limit_type)` — one limit per type per card.
- `amount` must be > 0; validated at DB and application level.

**Acceptance Criteria:**
- [ ] Migration runs cleanly; FK to `cards` with `ON DELETE CASCADE`.
- [ ] Attempting to insert a duplicate `(card_id, limit_type)` raises a unique constraint error.
- [ ] `amount` of 0 or negative is rejected at the DB level.

---

### TASK-03 — Define the Transactions Data Model

**Serves:** MO-4

**Prompt:**
Create the `transactions` table to record all authorization events for virtual cards.

**Artifacts to create/update:**
- `db/migrations/003_create_transactions.sql`
- `src/models/transaction.py`

**Details:**
- Fields: `id` (UUID PK), `card_id` (UUID FK → cards), `merchant_name` (string, max 100 chars), `amount` (Decimal 10,2), `currency` (ISO 4217), `status` (enum: `APPROVED`, `DECLINED`, `REVERSED`), `decline_reason` (nullable string, e.g. `CARD_FROZEN`, `LIMIT_EXCEEDED`, `INSUFFICIENT_FUNDS`), `occurred_at` (UTC timestamp), `correlation_id` (UUID).
- Index on `(card_id, occurred_at DESC)` for efficient paginated history queries.
- Partitioning strategy note: partition by `occurred_at` year/month for 24-month retention management.

**Acceptance Criteria:**
- [ ] Migration runs cleanly.
- [ ] `decline_reason` is nullable; non-null only when `status = DECLINED`.
- [ ] Index on `(card_id, occurred_at DESC)` exists and is used by the transaction history query plan.

---

### TASK-04 — Define the Audit Log Data Model

**Serves:** MO-5

**Prompt:**
Create the `audit_log` table as an append-only immutable record of all state-changing operations.

**Artifacts to create/update:**
- `db/migrations/004_create_audit_log.sql`
- `src/models/audit_log.py`

**Details:**
- Fields: `event_id` (UUID PK), `occurred_at` (UTC, indexed), `actor_type` (enum: `CUSTOMER`, `OPS_STAFF`, `SYSTEM`), `actor_id_hash` (string — SHA-256 of actor UUID), `card_id` (UUID, indexed), `action` (enum: `CARD_CREATED`, `CARD_FROZEN`, `CARD_UNFROZEN`, `LIMIT_SET`, `LIMIT_UPDATED`, `LIMIT_REMOVED`, `CARD_TERMINATED`), `before_state` (JSONB), `after_state` (JSONB), `correlation_id` (UUID).
- No `UPDATE` or `DELETE` privileges granted to the application DB user on this table.
- Retention: records older than 5 years flagged for archival (not deletion).

**Acceptance Criteria:**
- [ ] Application DB user has only `INSERT` and `SELECT` on `audit_log` — verified by permission check.
- [ ] `actor_id_hash` stores hashed value, not raw customer UUID.
- [ ] Inserting a row with a duplicate `event_id` raises PK violation.

---

### TASK-05 — Implement Card Provisioning Endpoint

**Serves:** MO-1, MO-5, MO-6

**Prompt:**
Implement `POST /v1/cards` — creates a new virtual card for the authenticated customer.

**Artifacts to create/update:**
- `src/api/cards.py` — route handler
- `src/services/card_service.py` — business logic
- `src/adapters/card_network_adapter.py` — network provisioning call

**Details:**
- Request body: `{ "currency": "USD", "network": "VISA" }`.
- Pre-conditions to validate before provisioning: (1) JWT valid and `role = customer`; (2) customer account `ACTIVE` per CBS; (3) customer has fewer than 5 active virtual cards.
- Call Card Network Adapter `POST /provision` to receive `pan`, `cvv`, `expiry_month`, `expiry_year`.
- Store masked PAN; encrypt full PAN at rest (AES-256); discard CVV after response is returned to client.
- Return full PAN and CVV **only in this response** — never again.
- Write audit log entry `CARD_CREATED` in the same transaction as the card insert.
- Support `Idempotency-Key` header — duplicate requests return original response without re-provisioning.

**Acceptance Criteria:**
- [ ] Response contains `card_id`, `masked_pan`, `pan` (full, one-time), `cvv`, `expiry_month`, `expiry_year`, `status: ACTIVE`.
- [ ] A second request with the same `Idempotency-Key` returns the same `card_id` and HTTP 200 with `X-Idempotent-Replayed: true`.
- [ ] If customer already has 5 active cards, response is HTTP 422 with `error_code: CARD_LIMIT_REACHED`.
- [ ] If CBS returns non-`ACTIVE` account status, response is HTTP 422 with `error_code: ACCOUNT_NOT_ACTIVE`.
- [ ] Audit log entry `CARD_CREATED` exists with correct `actor_id_hash` and `after_state`.
- [ ] Full PAN and CVV are absent from all application logs.

---

### TASK-06 — Implement Freeze / Unfreeze Endpoint

**Serves:** MO-2, MO-5

**Prompt:**
Implement `PATCH /v1/cards/{card_id}/status` — freezes or unfreezes a virtual card.

**Artifacts to create/update:**
- `src/api/cards.py` — route handler
- `src/services/card_service.py` — status transition logic

**Details:**
- Request body: `{ "status": "FROZEN" | "ACTIVE" }`.
- Authorization: requesting customer must own the card. Return HTTP 403 if not.
- Use optimistic locking: read current `version`, apply update with `WHERE version = :current_version`. If affected rows = 0, return HTTP 409 `CONCURRENT_MODIFICATION`.
- After DB update, call Card Network Adapter `PATCH /card-status` with new status. If adapter call fails, roll back DB update and return HTTP 502.
- Write audit log entry `CARD_FROZEN` or `CARD_UNFROZEN` in the same transaction.
- Freezing an already-frozen card returns HTTP 409 `CARD_ALREADY_FROZEN`. Unfreezing an active card returns HTTP 409 `CARD_ALREADY_ACTIVE`.

**Acceptance Criteria:**
- [ ] Freezing an active card returns HTTP 200; `status` in response is `FROZEN`.
- [ ] Subsequent authorization attempts on a frozen card are declined within 2 s (verified by integration test with mock auth engine).
- [ ] Concurrent freeze requests with the same `version` — exactly one succeeds, the other receives HTTP 409.
- [ ] Audit log entry exists for every status transition with correct `before_state` and `after_state`.
- [ ] Customer A cannot freeze Customer B's card — HTTP 403 returned.

---

### TASK-07 — Implement Spending Limit Set / Update / Remove Endpoints

**Serves:** MO-3, MO-5

**Prompt:**
Implement `PUT /v1/cards/{card_id}/limits/{limit_type}` (upsert) and `DELETE /v1/cards/{card_id}/limits/{limit_type}` (remove).

**Artifacts to create/update:**
- `src/api/limits.py`
- `src/services/limit_service.py`

**Details:**
- `PUT` request body: `{ "amount": "500.00", "currency": "USD" }`.
- Validate: `amount` is positive Decimal with ≤ 2 decimal places; `currency` is valid ISO 4217; `limit_type` is a known enum value.
- Maximum allowed limit per type: `MONTHLY_TOTAL` ≤ 50 000.00; `PER_TRANSACTION` ≤ 10 000.00. Exceeding these returns HTTP 422 `LIMIT_EXCEEDS_MAXIMUM`.
- `PUT` is idempotent by nature; no `Idempotency-Key` required.
- `DELETE` on a non-existent limit returns HTTP 404 `LIMIT_NOT_FOUND`.
- Write audit log entry `LIMIT_SET`, `LIMIT_UPDATED`, or `LIMIT_REMOVED` accordingly.

**Acceptance Criteria:**
- [ ] `PUT` with valid data returns HTTP 200 with current limit state.
- [ ] `PUT` with `amount: "500.001"` (3 decimal places) returns HTTP 400 `INVALID_AMOUNT_FORMAT`.
- [ ] `PUT` with `amount: "60000.00"` for `MONTHLY_TOTAL` returns HTTP 422 `LIMIT_EXCEEDS_MAXIMUM`.
- [ ] `DELETE` on existing limit returns HTTP 204; subsequent `GET` for that limit returns HTTP 404.
- [ ] Audit log entry exists for each operation with `before_state` and `after_state`.

---

### TASK-08 — Implement Transaction History Endpoint

**Serves:** MO-4

**Prompt:**
Implement `GET /v1/cards/{card_id}/transactions` — paginated, filterable transaction history.

**Artifacts to create/update:**
- `src/api/transactions.py`
- `src/services/transaction_service.py`

**Details:**
- Query parameters: `cursor` (opaque string, optional), `limit` (int, default 25, max 100), `status` (optional filter: `APPROVED` | `DECLINED` | `REVERSED`), `from_date` (ISO 8601, optional), `to_date` (ISO 8601, optional).
- Cursor encodes the `occurred_at` + `id` of the last returned record (base64-encoded JSON). Server must validate cursor integrity — reject tampered cursors with HTTP 400 `INVALID_CURSOR`.
- Response: `{ "data": [...], "next_cursor": "<string | null>", "total_count": <int> }`.
- `total_count` reflects count with applied filters, not total records.
- History window: reject requests where `from_date` is older than 24 months from today with HTTP 400 `DATE_RANGE_EXCEEDED`.

**Acceptance Criteria:**
- [ ] First page (no cursor) returns up to 25 records ordered by `occurred_at DESC`.
- [ ] `next_cursor` is null when no further records exist.
- [ ] Providing a tampered cursor returns HTTP 400.
- [ ] `limit=101` returns HTTP 400 `PAGE_SIZE_EXCEEDED`.
- [ ] `from_date` older than 24 months returns HTTP 400 `DATE_RANGE_EXCEEDED`.
- [ ] Response time for first page ≤ 400 ms at p50 (verified by load test fixture).

---

### TASK-09 — Implement Card List Endpoint

**Serves:** MO-1, MO-4

**Prompt:**
Implement `GET /v1/cards` — returns all virtual cards belonging to the authenticated customer.

**Artifacts to create/update:**
- `src/api/cards.py`

**Details:**
- Returns cards with `status` in `[ACTIVE, FROZEN]` by default. Optional query param `include_terminated=true` to include `TERMINATED` cards.
- Each card object: `card_id`, `masked_pan`, `status`, `network`, `expiry_month`, `expiry_year`, `created_at`, `limits` (array of current limits).
- Never include full PAN or CVV in this response.

**Acceptance Criteria:**
- [ ] Response includes only cards owned by the authenticated customer — no cards from other customers.
- [ ] `masked_pan` format is always `**** **** **** XXXX`.
- [ ] Full PAN and CVV fields are absent from the response body and from logs generated during this call.
- [ ] `include_terminated=true` includes cards with `status: TERMINATED`.

---

### TASK-10 — Implement Card Termination Endpoint

**Serves:** MO-1, MO-5

**Prompt:**
Implement `DELETE /v1/cards/{card_id}` — permanently terminates a virtual card.

**Artifacts to create/update:**
- `src/api/cards.py`
- `src/services/card_service.py`

**Details:**
- Termination is irreversible. Card status transitions to `TERMINATED`; no further operations (freeze, limit changes) are permitted on a terminated card.
- Call Card Network Adapter to deactivate the card network-side before marking terminated in DB.
- Write audit log entry `CARD_TERMINATED`.
- Attempting to terminate an already-terminated card returns HTTP 409 `CARD_ALREADY_TERMINATED`.

**Acceptance Criteria:**
- [ ] After termination, `GET /v1/cards/{card_id}` returns `status: TERMINATED`.
- [ ] Attempting `PATCH /status` on a terminated card returns HTTP 409 `CARD_TERMINATED`.
- [ ] Audit log entry `CARD_TERMINATED` exists with full `before_state`.
- [ ] Card Network Adapter deactivation is called before DB update; if adapter fails, operation is rolled back.

---

### TASK-11 — Implement Authorization Limit Check (Internal)

**Serves:** MO-3

**Prompt:**
Implement the internal `POST /internal/v1/authorize` endpoint consumed by the Card Network Adapter callback to validate a transaction against card status and spending limits.

**Artifacts to create/update:**
- `src/api/internal/authorize.py`
- `src/services/authorization_service.py`

**Details:**
- This endpoint is internal-only — protected by a service-to-service API key, not customer JWT.
- Request: `{ "card_id": "<uuid>", "amount": "49.99", "currency": "USD", "merchant_name": "Amazon", "correlation_id": "<uuid>" }`.
- Decision logic (in order): (1) Card exists and is `ACTIVE`; (2) `PER_TRANSACTION` limit not exceeded; (3) `MONTHLY_TOTAL` limit: sum of approved transactions this calendar month + requested amount ≤ limit.
- Response: `{ "decision": "APPROVED" | "DECLINED", "decline_reason": "<string | null>" }`.
- Write a `transactions` record regardless of decision.
- This endpoint must respond within 200 ms at p95 (real-time payment path).

**Acceptance Criteria:**
- [ ] Frozen card → `DECLINED` with `decline_reason: CARD_FROZEN`.
- [ ] Amount exceeds `PER_TRANSACTION` limit → `DECLINED` with `decline_reason: LIMIT_EXCEEDED`.
- [ ] Monthly spend + current amount would exceed `MONTHLY_TOTAL` limit → `DECLINED`.
- [ ] Approved transaction increments monthly running total correctly (verified by subsequent limit check test).
- [ ] p95 response time ≤ 200 ms under 100 rps load (load test fixture).

---

### TASK-12 — Implement Audit Log Query Endpoint (Ops/Compliance)

**Serves:** MO-5, MO-6

**Prompt:**
Implement `GET /v1/ops/cards/{card_id}/audit` — returns paginated audit log for a card, accessible to `ops_staff` role only.

**Artifacts to create/update:**
- `src/api/ops/audit.py`

**Details:**
- Authorization: JWT must contain `role: ops_staff`. Customer JWT returns HTTP 403.
- Query params: `from_date`, `to_date`, `action` (filter by action type), `limit` (default 50, max 200), `cursor`.
- Response fields match the audit log schema from TASK-04.
- `actor_id_hash` is returned as-is (hashed) — never un-hashed in the response.

**Acceptance Criteria:**
- [ ] Customer JWT accessing this endpoint receives HTTP 403.
- [ ] Response contains correct `before_state` / `after_state` for each entry.
- [ ] `actor_id_hash` is never a raw UUID — always a SHA-256 hash.
- [ ] Filter by `action=CARD_FROZEN` returns only freeze events.

---

### TASK-13 — Implement Idempotency Key Middleware

**Serves:** All mutating endpoints (MO-1, MO-2, MO-3)

**Prompt:**
Implement a reusable middleware/decorator that handles `Idempotency-Key` validation and response caching for all mutating endpoints.

**Artifacts to create/update:**
- `src/middleware/idempotency.py`

**Details:**
- On first request: process normally, store `(idempotency_key, customer_id) → (response_body, http_status)` in a fast store (e.g. Redis) with 24-hour TTL.
- On duplicate request: return cached response with `X-Idempotent-Replayed: true` header, without executing business logic.
- Key must be scoped to `customer_id` — the same UUID used by a different customer must not return another customer's response.
- Invalid `Idempotency-Key` format (not UUID v4) returns HTTP 400 `INVALID_IDEMPOTENCY_KEY`.

**Acceptance Criteria:**
- [ ] First request stores response; second identical request returns same body and status with `X-Idempotent-Replayed: true`.
- [ ] Malformed key (e.g. non-UUID string) returns HTTP 400.
- [ ] Key from customer A does not return data for customer B — tested with cross-customer fixture.
- [ ] Entry expires after 24 hours — verified with TTL check on cache store.

---

### TASK-14 — Write Unit Tests for Business Logic

**Serves:** All MOs

**Prompt:**
Write unit tests for all service-layer functions covering happy paths, boundary conditions, and error cases.

**Artifacts to create/update:**
- `tests/unit/test_card_service.py`
- `tests/unit/test_limit_service.py`
- `tests/unit/test_authorization_service.py`

**Details:**
- Mock all external dependencies (CBS, Card Network Adapter, DB, Redis).
- Cover: card limit of 5 enforcement, status transition guards (e.g. TERMINATED → any transition), Decimal rounding edge cases, concurrent version mismatch, limit maximum enforcement.
- Each test function named `test_<scenario>_<expected_outcome>` for readability.

**Acceptance Criteria:**
- [ ] All tests pass with zero failures.
- [ ] Test coverage for service layer ≥ 90 % (measured by coverage tool).
- [ ] No test uses `float` for monetary values — only `Decimal` or string inputs.
- [ ] Concurrent version conflict scenario explicitly tested.

---

### TASK-15 — Write Integration Tests for API Endpoints

**Serves:** All MOs

**Prompt:**
Write integration tests that exercise each API endpoint against a real (test) database instance, covering the full request-response cycle.

**Artifacts to create/update:**
- `tests/integration/test_cards_api.py`
- `tests/integration/test_limits_api.py`
- `tests/integration/test_transactions_api.py`

**Details:**
- Use a dedicated test database that is reset between test runs.
- Each test sets up required fixtures (customer, existing cards if needed) and tears down after.
- At minimum, one end-to-end scenario per Mid-Level Objective: e.g. create card → freeze → attempt transaction → verify declined → unfreeze → verify approved.

**Acceptance Criteria:**
- [ ] All integration tests pass against a clean test database.
- [ ] Audit log entries are verified in each state-changing test.
- [ ] The freeze → transaction-declined → unfreeze → transaction-approved flow passes as a single sequential test.
- [ ] No test leaks state to another test (DB reset verified).

---

### TASK-16 — Generate OpenAPI 3.0 Documentation

**Serves:** All MOs

**Prompt:**
Generate and publish the OpenAPI 3.0 specification for all public and internal endpoints.

**Artifacts to create/update:**
- `docs/openapi.yaml`

**Details:**
- All request/response schemas fully defined with types, formats, and examples.
- Sensitive fields (`pan`, `cvv`) annotated with `x-sensitive: true` and a note that they appear only in provisioning response.
- Error response schema is consistent across all endpoints (see Implementation Notes error envelope).
- Include `x-rate-limit` extension on rate-limited endpoints documenting the limit values.

**Acceptance Criteria:**
- [ ] `docs/openapi.yaml` validates without errors against OpenAPI 3.0 schema validator.
- [ ] All endpoints from TASK-05 through TASK-12 are documented.
- [ ] `pan` and `cvv` fields are marked `x-sensitive: true`.
- [ ] At least one example request/response per endpoint.

---

## Edge Cases & Failure Modes

### Card Provisioning Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Customer already has 5 active cards | HTTP 422 `CARD_LIMIT_REACHED`; no provisioning call made | None |
| CBS returns account status `SUSPENDED` | HTTP 422 `ACCOUNT_NOT_ACTIVE`; no card created | Ops must be able to audit why card was not issued |
| CBS is unreachable (timeout) | HTTP 503 `UPSTREAM_UNAVAILABLE`; no card created; retry-safe | Audit log entry `CARD_CREATION_FAILED` with reason |
| Card Network Adapter fails mid-provisioning | DB insert rolled back; card never exists in system; idempotent retry is safe | Partial states must not persist |
| Duplicate `Idempotency-Key` with different request body | HTTP 409 `IDEMPOTENCY_CONFLICT` — body mismatch on same key | Protects against accidental re-use of keys |
| Customer submits provisioning request twice simultaneously (race) | Exactly one card created; second request returns idempotency response or 422 if limit reached | Card count constraint prevents duplicates |

### Freeze / Unfreeze Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Freeze already-frozen card | HTTP 409 `CARD_ALREADY_FROZEN` | No duplicate audit entry created |
| Unfreeze already-active card | HTTP 409 `CARD_ALREADY_ACTIVE` | No duplicate audit entry created |
| Freeze a terminated card | HTTP 409 `CARD_TERMINATED` | Terminated cards are immutable |
| Two concurrent freeze requests (same card, same version) | One succeeds (HTTP 200), one fails (HTTP 409 `CONCURRENT_MODIFICATION`) | Audit log shows single transition |
| Card Network Adapter unreachable during freeze | DB update rolled back; card remains `ACTIVE`; HTTP 502 returned | Audit log entry `CARD_FREEZE_FAILED` with error detail |
| Freeze succeeds in DB but propagation to auth engine delayed > 2 s | Auth engine must poll card status or receive event; alert fires if lag > 2 s | SLA breach; on-call notified |

### Spending Limits Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Set limit on a terminated card | HTTP 409 `CARD_TERMINATED` | Terminated cards are immutable |
| Update limit to value exceeding system maximum | HTTP 422 `LIMIT_EXCEEDS_MAXIMUM` | Prevents misconfiguration |
| Remove a limit that does not exist | HTTP 404 `LIMIT_NOT_FOUND` | Idempotent intent — client may safely ignore |
| Two concurrent limit updates for the same type | Optimistic lock conflict; one succeeds, one gets HTTP 409 | Audit log reflects only the winning state |
| Currency mismatch between limit and transaction | Transaction currency converted to limit currency using exchange rate at time of auth; if rate unavailable, transaction declined with `CURRENCY_RATE_UNAVAILABLE` | Financial accuracy; rate source must be auditable |
| Limit set in EUR, transaction in USD | Apply conversion; if converted amount exceeds limit, decline | Exchange rate snapshot stored in transaction record |

### Transaction History Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Request with `from_date` older than 24 months | HTTP 400 `DATE_RANGE_EXCEEDED` | Retention window enforced at API layer |
| Tampered or malformed cursor | HTTP 400 `INVALID_CURSOR` | Prevents cursor injection / enumeration attacks |
| `limit=0` in request | HTTP 400 `INVALID_PAGE_SIZE` | Explicit rejection, no empty data response |
| Card has zero transactions | Returns `{ "data": [], "next_cursor": null, "total_count": 0 }` | Empty state must be explicit, not 404 |
| Reversed transaction affects monthly spend total | Reversed amount subtracted from monthly running total within 24 hours of reversal | Ensures limit checks remain accurate after refunds |

### Authorization (Real-Time) Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Authorization request for unknown `card_id` | `DECLINED`, reason `CARD_NOT_FOUND`; transaction record written | Prevents silent failures |
| Monthly limit exactly met by current transaction | Transaction `APPROVED`; next transaction for same card/month immediately declined | Boundary condition must be `≤`, not `<` |
| Simultaneous authorization requests exceeding monthly limit | Exactly one approved; others declined — enforced by DB-level serializable transaction or row-level lock on limit check | Race condition in limit enforcement is a financial risk |
| Authorization received for a card frozen 1 second ago | `DECLINED`, reason `CARD_FROZEN` — freeze propagation SLA is 2 s | Eventual consistency window must be documented |
| Auth engine sends malformed request (missing `correlation_id`) | HTTP 400; no transaction record written; error logged with details | Internal contract violation; alert fires |

### Security & Permission Edge Cases

| Scenario | Expected Behavior | Compliance Implication |
|---|---|---|
| Customer A's JWT used to access Customer B's card | HTTP 403 `FORBIDDEN`; access denied at resource level | Horizontal privilege escalation prevention |
| Expired JWT token | HTTP 401 `TOKEN_EXPIRED` | No operation performed; no data leaked |
| `ops_staff` attempts to call `POST /v1/cards` | HTTP 403 `FORBIDDEN` — ops role is read-only for card operations | Ops cannot impersonate customers |
| Request with no `Authorization` header | HTTP 401 `MISSING_TOKEN` | Unauthenticated access never reaches business logic |
| Audit log query attempted by customer role | HTTP 403 `FORBIDDEN` | Audit data is ops/compliance-only |
| SQL injection attempt in `merchant_name` filter | Sanitized at input validation layer; parameterized queries only; no error detail returned | Security control; pen-test case |

---

## Verification Plan

### How to Know Each Mid-Level Objective Is Met

| Objective | Verification Method | Evidence Artifact |
|---|---|---|
| **MO-1** Card Provisioning | Integration test: create card, verify response fields, check DB state, verify audit log entry | `tests/integration/test_cards_api.py::test_card_creation_success` |
| **MO-2** Status Control | Integration test: freeze → attempt mock auth → verify declined; unfreeze → verify approved. Check freeze propagation lag < 2 s | `tests/integration/test_cards_api.py::test_freeze_unfreeze_cycle` |
| **MO-3** Limit Management | Integration test: set limit → trigger authorization exceeding limit → verify declined; update limit above transaction amount → verify approved | `tests/integration/test_limits_api.py::test_limit_enforcement` |
| **MO-4** Transaction History | Integration test: create 30 transactions → query with default page size → verify 25 returned, cursor present; second page → 5 returned, cursor null | `tests/integration/test_transactions_api.py::test_pagination_correctness` |
| **MO-5** Audit Trail | After each state-changing operation in every integration test: assert audit log row exists with correct fields via direct DB query | Covered in all integration tests as mandatory assertion |
| **MO-6** Access Control | Security test suite: cross-customer access, ops-role restrictions, expired tokens, missing auth header | `tests/security/test_access_control.py` |

### Test Categories

- **Unit tests** (`tests/unit/`): Pure business logic, no I/O. Mock all external services. Target: ≥ 90 % coverage on service layer.
- **Integration tests** (`tests/integration/`): Real test DB, mocked external adapters (CBS, Card Network). One scenario per MO minimum.
- **Security tests** (`tests/security/`): All edge cases from the Security & Permission table above.
- **Load tests** (`tests/load/`): Verify p95 latency targets from NFR-1. Run with k6 or Locust against staging environment.
- **Compliance review** (manual): Quarterly review by ops/compliance staff: audit log completeness, PAN masking spot-check, retention policy verification.

### Data Fixtures

- `fixtures/customer_active.json` — customer with `ACTIVE` account status (mocked CBS response).
- `fixtures/customer_suspended.json` — customer with `SUSPENDED` account status.
- `fixtures/card_active.json` — card in `ACTIVE` state with no limits set.
- `fixtures/card_frozen.json` — card in `FROZEN` state.
- `fixtures/card_with_limits.json` — card with all three limit types set.
- `fixtures/transactions_30.json` — 30 pre-generated transactions across two pages.

### Reconciliation Checks (Ops)

- **Daily:** Sum of approved transaction amounts per card per month matches the stored running total used for limit enforcement. Discrepancy > 0 triggers alert.
- **Weekly:** Count of audit log entries matches expected count based on card operation events from the message broker. Missing entries trigger compliance alert.
- **Monthly:** Manual spot-check: 5 randomly sampled cards reviewed for PAN masking correctness in all stored records and log outputs.

---
