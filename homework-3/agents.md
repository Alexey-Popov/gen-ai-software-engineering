# agents.md — Virtual Card Lifecycle Service

> This file defines the domain invariants, stack conventions, testing requirements, and security constraints that any AI coding agent must follow when working on this codebase. Rules here are **non-negotiable**; editor-workflow nudges live in `.claude/CLAUDE.md` and `.cursor/rules/`.

---

## 1. Domain Invariants

These are the facts of the business domain that must never be violated, regardless of implementation path.

### 1.1 Card data

| Invariant | Rule | Regulatory basis |
|---|---|---|
| **SAD prohibition** | CVV, CVV2, CVC2, CAV2, CID must never be stored in the issuer database — not in any table, column, cache, log, or event payload. The only permitted flow is to proxy them directly from the processor to the caller in a single request with no intermediate persistence. | PCI DSS v4.0 Req 3.3 |
| **PAN minimisation** | Raw PAN (16–19 digit card number) must never appear at rest in the issuer database. Store token + last4 + masked PAN (`XXXXXX{last4}`) only. | PCI DSS v4.0 Req 3 |
| **Tokenisation** | The processor partner holds the PAN vault. The issuer's primary card identifier is the processor-issued opaque token. Never treat the token as a UUID or attempt to parse its structure. | Architecture decision |
| **Reveal TTL** | A PAN/CVV reveal handle is single-use and expires after ≤ 60 seconds. There is no endpoint that returns PAN/CVV outside this flow. | Principle of least exposure |
| **No PAN/CVV in logs** | No log statement, structured log field, or metric label may contain a PAN-length numeric string (12–19 digits) or a 3–4 digit CVV-length string in the context of card data. Use partial masking: last 4 digits only for card display, first char + `***` + last char for cardholder IDs. | PCI DSS v4.0 Req 10, Req 3.3 |

### 1.2 Audit integrity

| Invariant | Rule |
|---|---|
| **Audit-on-mutation** | Every function that performs a state-changing write MUST also write to `audit_events` and `outbox` in the **same DB transaction**. If the audit write fails, the mutation must roll back. There is no exception to this rule. |
| **Two-table model** | `audit_events` records committed mutations only (inside the main transaction). `audit_attempts` records every attempt including failures, written via an autonomous AUTOCOMMIT DB connection that survives rollbacks. A compensating insert after rollback is not acceptable — the crash window creates a compliance gap. |
| **INSERT-only on audit_events** | `audit_events` rows are never updated or deleted by `app_role`. `REVOKE UPDATE, DELETE ON audit_events FROM app_role` must appear in the migration. The `redactor_role` has column-level `GRANT UPDATE (actor_id, ip_address, user_agent)` for GDPR redaction only — ORM must name only these three columns in any UPDATE. |
| **GDPR redaction via is_redacted** | GDPR redaction sets `actor_id=NULL, is_redacted=TRUE, ip_address=NULL, user_agent=NULL` on affected rows — never `actor_id='REDACTED'` (which is not a valid UUID and would break UUID column typing). Queries on non-redacted rows must filter `WHERE is_redacted = FALSE`. |
| **No PII in diff** | The `diff` JSONB column in `audit_events` must never contain keys named `pan`, `cvv`, `full_token`, `password`, or any raw secret. |
| **Outbox at-least-once** | Every mutation writes an `outbox` row. The outbox publisher delivers to Kafka at-least-once. Downstream consumers must be idempotent by `event_id`. |

### 1.3 Money

| Invariant | Rule |
|---|---|
| **Decimal only** | All monetary values use Python `decimal.Decimal`. Never use `float`, `int`, or string coercion for money arithmetic. Import `Decimal` explicitly; set context to 28-digit precision, `ROUND_HALF_EVEN`. |
| **ISO 4217** | Currency codes are three-letter uppercase ISO 4217 strings. Validate against an allowlist at the API layer. Unknown currencies → 422. |
| **DB precision** | Store amounts as `NUMERIC(18, 4)` in Postgres. API layer validates user input to max 2 decimal places. |

### 1.4 Identifiers and timestamps

| Invariant | Rule |
|---|---|
| **UUID PKs** | All internal primary keys are UUID v4, server-generated (`gen_random_uuid()`). Never expose sequential integers. |
| **UTC timestamps** | All timestamps are UTC, ISO 8601, microsecond precision. Always use `datetime.now(timezone.utc)`. Never use naive datetimes (`datetime.now()` without timezone). |
| **TIMESTAMPTZ** | Store all timestamps as `TIMESTAMPTZ` in Postgres. Never `TIMESTAMP WITHOUT TIME ZONE`. |

---

## 2. Technology Stack Conventions

**Runtime:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, PostgreSQL 15, Kafka.

### 2.1 FastAPI

- Dependency injection for per-route concerns: auth (`require_auth`, `require_scope`, `require_aal`), KYC gate, SCA gate.
- Cross-cutting infrastructure concerns use Starlette middleware: idempotency (`IdempotencyMiddleware`), rate limiting (`RateLimiterMiddleware`). Do not implement these as `Depends` — middleware runs before routing, enabling genuine short-circuit.
- Auth dependency pattern: closure factories. `require_scope("cards:write")` and `require_aal(2)` return FastAPI-compatible closures chained off `require_auth`. The factory is called at import time; FastAPI receives the closure.
- Always `async def` for handlers and dependencies; never block the event loop with synchronous I/O.
- `debug=False` in production; no stack traces in HTTP responses.
- Register all custom exceptions via `app.add_exception_handler`.

### 2.2 Pydantic

- Use Pydantic v2 (`BaseModel`, `model_validator`, `field_validator`).
- Input models: `model_config = ConfigDict(str_strip_whitespace=True, frozen=True)`.
- Output models: never include a field named `pan`, `cvv`, or `full_token`.
- Use `SecretStr` for all secret fields in `Settings`; they must not appear in `repr()` or logs.

### 2.3 SQLAlchemy

- Use SQLAlchemy 2 async API: `async_sessionmaker`, `async with session.begin()` for explicit transactions.
- Never use `session.commit()` directly inside route handlers; use context managers.
- `SELECT … FOR UPDATE` is required on any row read with the intent to mutate (freeze, limit change).
- Never add raw SQL strings to `execute()` using f-strings or `%` formatting — use bound parameters only (prevents SQL injection).

### 2.4 Alembic

- One migration file per logical schema change.
- All PKs: `server_default=text("gen_random_uuid()")`.
- All timestamps: `TIMESTAMPTZ`.
- Enum values: `VARCHAR`, not Postgres `ENUM` type (easier evolution).
- `audit_events` migration: no `downgrade()` body — intentionally non-reversible.

### 2.5 Idempotency

- All `POST` and `PATCH` endpoints require `Idempotency-Key` header (UUID v4).
- Enforcement: `IdempotencyMiddleware` (Starlette `BaseHTTPMiddleware`), not a per-route `Depends`. The middleware short-circuits with a cached response before the route function is called. Method filter: `POST` and `PATCH` only.
- Missing header → `400 IDEMPOTENCY_KEY_REQUIRED`.
- Idempotency window: 24 hours; configurable via `IDEMPOTENCY_TTL_HOURS`.
- Duplicate `COMPLETED` → return cached `{status_code, body}`; duplicate `PENDING` → `409 IN_PROGRESS`; duplicate `FAILED_RETRYABLE` → allow new execution.

---

## 3. Security and Compliance Constraints

### 3.1 Authentication and authorisation

- JWT claims must be validated: `aud` matches this service's name, `exp` has not passed, `scope` contains the required permission.
- **Algorithm pinning (RFC 8725 §3.1–3.2):** Always pass `algorithms=["RS256", "ES256"]` to `jwt.decode()`. Never derive the algorithm from the token header. Never include `"none"` or any HS-family algorithm in the list.
- **Issuer allowlist (RFC 8725 §3.8):** Validate `iss` against `Settings.ALLOWED_ISSUERS` before attempting signature verification. Reject tokens from unknown issuers. User identity keyed on `(iss, sub)` pair.
- Full scope inventory: `cards:read` (AAL2, cardholder), `cards:write` (AAL2, cardholder), `audit:read` (AAL3, ops), `ops:reconcile` (AAL2, service account), `ops:admin` (AAL3, ops), `fraud:freeze` (AAL2, fraud analyst / FRAUD_ENGINE). Unrecognised scopes raise `ValueError` at startup.
- Data isolation: always verify that the `cardholder_id` in the JWT matches the `cardholder_id` of the card being accessed. Return `404` (not `403`) on mismatch to prevent existence oracle attacks.

### 3.2 Input validation

- Validate all external inputs at the Pydantic layer before any DB or downstream call.
- Never trust or forward unvalidated external data to a downstream service.
- **Webhook replay prevention (three sequential checks):** (1) timestamp check `abs(now - t) ≤ 300 s`; (2) HMAC-SHA256 verify with `hmac.compare_digest`; (3) Redis event-ID dedup `SET NX TTL 72h`. All three must pass before payload processing. Invalid signature → `401`, do not log raw payload. Timestamp violation → `401`. Duplicate event-ID → `200 OK` no-op.

### 3.3 Secret handling

- Secrets come from environment variables or a secrets manager. Never hard-code.
- `PROCESSOR_API_KEY`, `PROCESSOR_WEBHOOK_SIGNING_KEY`, and `REDIS_URL`: use `SecretStr`; never log, never include in error responses, never include in `audit_events`.
- Key rotation: design allows key rotation without downtime (support multiple active keys during rotation window).

### 3.4 Outbound calls and SSRF

- All outbound HTTP uses TLS 1.3 minimum; certificate verification always enabled.
- Set explicit timeouts on all HTTP client calls (default: `connect=2s, read=5s`).
- External service 5xx: return `503` to the caller, not `500`. Log the upstream error with trace context.
- Fail-closed on KYC, SCA, and fraud-engine unavailability: when in doubt, deny the request.
- **SSRF guard for `PROCESSOR_API_BASE_URL`:** (1) startup Pydantic validator checks hostname against `SSRF_ALLOWED_PROCESSOR_HOSTNAMES`; (2) all outbound processor calls use an SSRF-safe httpx transport with DNS rebind protection. Never use `requests` or plain `httpx.AsyncClient` without the SSRF transport for processor calls.

### 3.5 Rate limiting

- 10 write requests/min/cardholder (`POST`/`PATCH`); 60 read requests/min/cardholder (`GET`). Configurable via `Settings.RATE_LIMIT_WRITES_PER_MIN` and `Settings.RATE_LIMIT_READS_PER_MIN`.
- Sliding-window TTL = 60 s (`Settings.RATE_LIMIT_WINDOW_SECONDS`). Every Redis `INCR` on a rate-limit key must be followed by `EXPIRE` — use a Lua script or pipeline to ensure atomicity.
- Implemented as `RateLimiterMiddleware` with Redis sliding-window counter. Rate-limit key: `sha256(cardholder_id + endpoint_path)`.
- Rate-limit decisions logged at DEBUG level with `cardholder_id_partial` (first + `***` + last char).
- `429` response includes `Retry-After: <seconds>` header and `{"error": {"code": "RATE_LIMIT_EXCEEDED", "retry_after": <int>}}`.

### 3.6 Redis security

- `REDIS_URL` must be `SecretStr`; its value is only accessed via `.get_secret_value()` at client-construction time.
- Production Redis: TLS enabled (plain port disabled), Redis 6+ ACL (default user disabled, named users with key-pattern scope), bound to private network interface only.
- Reveal handle stored as `SHA-256(handle_id)` — raw handle never persisted in Redis or any DB column.

---

## 4. Test Category Requirements

These categories are mandatory for any feature touching the domains below.

| Category | When required | Minimum assertions |
|---|---|---|
| **Unit** | Any pure function (state machine, limit enforcement, money arithmetic, PAN masking) | All success paths + all error paths; no I/O |
| **Integration** | Any endpoint or worker that writes to DB or calls an external service | Happy path + idempotency replay + external 503 path |
| **Contract** | Any integration with an external service (processor, identity, KYC, fraud engine) | Stub response matches named contract shape; mismatch is a test failure |
| **Security** | Any endpoint that handles card data, auth tokens, or audit data | Auth bypass attempt → 401/403; cross-user data access → 404; PAN-in-log check |
| **Audit assertion** | Every integration test for a mutation endpoint | Assert exactly one `audit_events` row with correct `action`, `actor_id`, `diff` (no PAN/CVV) |

---

## 5. Edge-Case Handling Policy

These rules apply universally. See `specification.md §6` for per-flow tables.

- **Idempotency-first:** before executing a mutation, always check the idempotency record. Duplicate `COMPLETED` → return cached response. Duplicate `PENDING` → `409 IN_PROGRESS`.
- **Fail-closed on external service failure:** for security-gating services (KYC, SCA, fraud engine), service unavailability produces a denial (`503`), never a permission grant.
- **No existence oracle:** always return `404` (not `403`) when a resource belongs to another cardholder.
- **Compensate or abort:** if a downstream call succeeds but the local DB transaction fails, a compensating action (e.g. cancel the processor card) must be scheduled — never leave the system in a half-committed state. The reconciliation job is the safety net.
- **Never log sensitive data:** when in doubt about whether a value is sensitive, omit it from logs and audit payloads.

---

## 6. Error Envelope

All errors must conform to:

```json
{
  "error": {
    "code": "SNAKE_CASE_STRING",
    "message": "Human-readable description",
    "request_id": "UUID",
    "details": [{"field": "field_name", "message": "why invalid"}]
  }
}
```

- `code` is a stable machine-readable string (not the HTTP status reason phrase).
- `details` is present for validation errors (`422`), null otherwise.
- Never expose stack traces, SQL error messages, or internal table names.

---

## 7. FinTech Regulatory Context (summary)

| Regime | What it requires here | Where in spec |
|---|---|---|
| **PCI DSS v4.0** | SAD never stored; PAN tokenised; audit logs retained 12 months / 3 months immediate; log integrity protected | §3 NFR, Tasks 1.5, 5.1 |
| **PSD2 / EBA RTS on SCA** (Reg. EU 2018/389) | SCA on limit increases (risk-based, Art. 97(1)(c)); dynamic linking on payment initiation | §3 NFR, Task 3.2 |
| **NIST SP 800-63B** | AAL2 for cardholder mutations; AAL3 for ops/audit access | §3 NFR, Tasks 3.2, 5.3 |
| **GDPR** | Art. 17(3)(b): audit records retained under legal-obligation basis, not deleted on erasure request; Art. 5(1)(c): IP masked to /24; Art. 25: privacy by design defaults | §3 NFR, Tasks 5.1, 5.5 |
