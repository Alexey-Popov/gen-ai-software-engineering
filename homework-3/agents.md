# Agent Guidelines — Virtual Card Lifecycle

> This file configures the behavior of any AI coding agent working in this project.
> Read this file before generating any code, tests, or documentation.

---

## Domain Context

This project implements a **virtual card lifecycle management** feature for a regulated banking environment. The domain has strict requirements around:

- **PCI-DSS compliance** — card data (PAN, CVV) is sensitive and has hard handling rules.
- **Financial accuracy** — all monetary calculations must be exact; floating-point is forbidden.
- **Auditability** — every state change must be traceable; silent operations are not acceptable.
- **Regulatory retention** — data cannot be freely deleted; retention windows are legally mandated.

Always approach implementation decisions through the lens of: *"Is this safe for a regulated financial system?"*

---

## Tech Stack Assumptions

- **Language:** Python 3.11+
- **Web framework:** FastAPI
- **ORM:** SQLAlchemy 2.x (async)
- **Database:** PostgreSQL 15+
- **Cache / Idempotency store:** Redis 7+
- **Testing:** pytest + pytest-asyncio; httpx for API integration tests
- **Migrations:** Alembic
- **Money handling:** `decimal.Decimal` — never `float` or `int` for monetary values
- **UUIDs:** `uuid.uuid4()` for all ID generation
- **Timestamps:** Always UTC; use `datetime.now(timezone.utc)`, never `datetime.utcnow()`

---

## Absolute Rules (Never Violate)

These are hard constraints. Do not make exceptions, even for tests or debug utilities.

1. **Never log full PAN or CVV** — at any log level, including `DEBUG`. Use masked PAN (`**** **** **** XXXX`) or card ID in logs.
2. **Never return CVV in any API response** except the initial card-creation response (`POST /v1/cards`).
3. **Never store CVV** after the provisioning flow completes. It is ephemeral.
4. **Never use `float` or `double` for monetary values.** Always use `decimal.Decimal`. Cast string inputs to `Decimal` before any arithmetic.
5. **Never use sequential integers as public resource identifiers.** All IDs are UUID v4.
6. **Never include PII in error messages** returned to the client. Use structured error codes with a lookup table.
7. **Never expose stack traces or internal system details** in HTTP 500 responses.
8. **Never perform a state-changing operation without writing an audit log entry** in the same transaction.
9. **Never grant `UPDATE` or `DELETE` access** to the application database user on the `audit_log` table.
10. **Never use `datetime.utcnow()`** — it returns a naive datetime. Always use `datetime.now(timezone.utc)`.

---

## Code Style & Conventions

### Naming

- Route handlers: `verb_noun` snake_case (e.g. `create_card`, `freeze_card`, `list_transactions`)
- Service functions: same pattern (e.g. `card_service.provision_card`, `limit_service.upsert_limit`)
- DB models: PascalCase matching table name (e.g. `Card`, `CardLimit`, `AuditLog`)
- Enums: SCREAMING_SNAKE_CASE values (e.g. `CardStatus.ACTIVE`, `LimitType.MONTHLY_TOTAL`)
- Error codes: SCREAMING_SNAKE_CASE strings (e.g. `"CARD_ALREADY_FROZEN"`, `"LIMIT_EXCEEDS_MAXIMUM"`)
- Constants: module-level SCREAMING_SNAKE_CASE (e.g. `MAX_ACTIVE_CARDS_PER_CUSTOMER = 5`)

### Project Structure

```
src/
  api/
    cards.py          # Card CRUD and status endpoints
    limits.py         # Spending limit endpoints
    transactions.py   # Transaction history endpoint
    ops/
      audit.py        # Ops/compliance audit log endpoint
    internal/
      authorize.py    # Internal authorization callback
  services/
    card_service.py
    limit_service.py
    authorization_service.py
    transaction_service.py
  models/
    card.py
    card_limit.py
    transaction.py
    audit_log.py
  middleware/
    idempotency.py
    auth.py
  adapters/
    card_network_adapter.py
    core_banking_adapter.py
  utils/
    money.py          # Decimal helpers, rounding, currency validation
    masking.py        # PAN masking utilities
    hashing.py        # Actor ID hashing for audit log
db/
  migrations/         # Alembic migration files
tests/
  unit/
  integration/
  security/
  load/
fixtures/
docs/
  openapi.yaml
```

### Error Handling

- All service-layer functions raise domain-specific exceptions (e.g. `CardAlreadyFrozenError`, `CardLimitReachedError`).
- Route handlers catch domain exceptions and map them to structured HTTP responses using a centralized exception handler.
- Never use bare `except Exception` in business logic. Catch specific exception types.
- Always include `correlation_id` in error responses. Generate one per request in middleware if not provided by caller.

---

## Testing & Verification Expectations

- **Every new service function must have a corresponding unit test** before the task is considered complete.
- Unit tests mock all I/O (DB, Redis, external adapters). Never make real network calls in unit tests.
- Integration tests use a real test PostgreSQL instance (Docker-based). Migrations run before test suite; DB is reset between test classes.
- **Monetary assertions in tests must use `Decimal`**, not floats. Example: `assert result.amount == Decimal("49.99")`.
- Each test function must be self-contained — no shared mutable state between tests.
- Test names follow `test_<scenario>_<expected_outcome>` pattern (e.g. `test_freeze_already_frozen_card_returns_409`).
- Security test cases must cover: horizontal privilege escalation, expired tokens, missing auth header, ops-role restrictions.

---

## Security & Compliance Defaults

- Always use parameterized queries — never string-interpolated SQL.
- Validate all UUIDs before DB lookup. Return HTTP 404 (not 500) for malformed UUIDs.
- Apply authorization checks at the **route level** (via dependency injection) AND at the **service level** (resource ownership check). Defense in depth.
- When in doubt about whether a field is sensitive — treat it as sensitive.
- Rate limiting is applied globally via middleware; individual endpoints do not need to implement their own rate limiting logic.
- All inter-service calls (to CBS, Card Network Adapter) must have explicit timeout values. Never use default (infinite) timeouts.

---

## How the Agent Should Treat Edge Cases

- **Default to fail-closed:** when a required external service (CBS, Card Network Adapter, audit log writer) is unavailable, reject the operation rather than proceeding without the safety check.
- **Explicit over implicit:** if a state transition is not explicitly listed as valid, it is invalid. Do not infer allowed transitions.
- **Concurrent writes:** always use optimistic locking (`version` field) for card state and limit updates. Never assume single-writer access.
- **Empty states are not errors:** an empty transaction list returns `{ "data": [], "next_cursor": null, "total_count": 0 }` — never HTTP 404.
- **Idempotency before logic:** idempotency key checks happen before any business logic or database writes, not after.
- **Reversed transactions:** when a transaction is reversed, update the monthly running spend total used for limit enforcement within 24 hours.

---

## What the Agent Must NOT Do

- Do not add endpoints, fields, or features not described in `specification.md`. Scope is fixed.
- Do not use `print()` for debugging — use structured logging only.
- Do not hardcode secrets, API keys, or connection strings. Read from environment variables via a config module that sources from Secrets Manager.
- Do not implement soft-delete on the `audit_log` table. It is append-only by design.
- Do not return HTTP 200 for errors. Use appropriate 4xx/5xx codes as specified in Implementation Notes.
- Do not use offset-based pagination for transaction history. Use cursor-based pagination only.
- Do not skip writing audit log entries to "simplify" an implementation. Audit entries are non-negotiable.

---
