# Cursor Rules — Virtual Card Lifecycle (FinTech)

## Applies To
All files in `src/`, `tests/`, `db/`, `docs/`.

---

## Money & Decimals

- **Always** use `decimal.Decimal` for monetary values. Never suggest `float`, `double`, or bare `int` arithmetic on money.
- Import pattern: `from decimal import Decimal, ROUND_HALF_UP`
- Rounding: `amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`
- When parsing monetary input from a request body, cast immediately: `Decimal(str(raw_value))` — never `float(raw_value)`.
- Reject the suggestion `round(amount, 2)` — use `.quantize()` instead.

## Identifiers & UUIDs

- All resource IDs are `uuid.UUID` type internally; serialized as lowercase UUID strings in JSON.
- Generate IDs with `uuid.uuid4()`. Never use `uuid.uuid1()` (contains MAC address — PII risk).
- Validate incoming ID strings with `uuid.UUID(value, version=4)` before any DB lookup. Raise HTTP 400 on `ValueError`.

## Sensitive Data — Hard Stops

- If generating code that logs any variable named `pan`, `cvv`, `card_number`, `full_pan`, or `raw_pan` — **stop and remove the log statement**.
- If generating a Pydantic response model that includes `cvv` or `full_pan` as a non-optional field — **flag this as a violation** unless the model is explicitly `CardProvisioningResponse` (one-time issuance only).
- PAN masking is always: `f"**** **** **** {pan[-4:]}"` — no other format is acceptable.
- Actor IDs written to audit log must be hashed: `hashlib.sha256(actor_id.encode()).hexdigest()`.

## Datetime Handling

- **Always** use timezone-aware datetimes: `datetime.now(timezone.utc)`.
- **Never** suggest `datetime.utcnow()` — it is deprecated and returns a naive datetime.
- Store timestamps as UTC in the database. Never store local time.
- Serialize timestamps as ISO 8601 with `Z` suffix: `dt.isoformat().replace("+00:00", "Z")`.

## Database & ORM

- Use SQLAlchemy 2.x async style: `async with session.begin()` for transactions.
- Always use parameterized queries. Never use f-strings or `.format()` to construct SQL.
- Optimistic locking pattern for card updates:
  ```python
  result = await session.execute(
      update(Card)
      .where(Card.id == card_id, Card.version == current_version)
      .values(status=new_status, version=Card.version + 1)
  )
  if result.rowcount == 0:
      raise ConcurrentModificationError()
  ```
- Every `INSERT` into `cards`, `card_limits`, or `card_limits` must be accompanied by an `INSERT` into `audit_log` in the same transaction.

## API & FastAPI Patterns

- Route functions are thin: validate input → call service → return response. No business logic in route handlers.
- Use FastAPI `Depends()` for: JWT validation, idempotency key extraction, rate limit checks.
- All response models are explicit Pydantic models — never return raw dicts or ORM objects directly.
- HTTP status codes: follow the specification exactly — `409` for state conflicts, `422` for business rule violations, `429` for rate limits.
- Correlation ID must be present in every response header: `X-Correlation-ID: <uuid>`.

## Error Handling

- Define domain exceptions in `src/exceptions.py` (e.g. `CardAlreadyFrozenError`, `CardLimitReachedError`).
- Map exceptions to HTTP responses in a single centralized FastAPI exception handler — not in individual route functions.
- Error response envelope (always):
  ```python
  class ErrorResponse(BaseModel):
      error_code: str
      message: str
      correlation_id: str
  ```
- Never include Python exception messages, stack traces, or internal paths in HTTP error responses.

## Testing Patterns

- Monetary assertions: `assert result.amount == Decimal("49.99")` — never `assert result.amount == 49.99`.
- Every integration test must assert the audit log entry after any state-changing operation:
  ```python
  audit_entry = await get_latest_audit_entry(card_id=card.id)
  assert audit_entry.action == AuditAction.CARD_FROZEN
  assert audit_entry.before_state["status"] == "ACTIVE"
  assert audit_entry.after_state["status"] == "FROZEN"
  ```
- Test database is reset between test classes using a pytest fixture that truncates all tables (except seed data).
- Never use `time.sleep()` in tests — use async equivalents or mock time.

## Pagination

- Transaction history uses **cursor-based** pagination only. Never suggest offset/limit (`OFFSET N LIMIT M`) for this endpoint.
- Cursor construction: `base64.urlsafe_b64encode(json.dumps({"occurred_at": ..., "id": ...}).encode()).decode()`
- Validate cursor on receipt: decode → parse JSON → verify expected keys exist. Return HTTP 400 on any failure.

## Idempotency

- Idempotency key header name: `Idempotency-Key` (exact casing).
- Validate format as UUID v4 before processing. Invalid format → HTTP 400 `INVALID_IDEMPOTENCY_KEY`.
- Cache key structure: `idempotency:{customer_id}:{idempotency_key}` — scoped to customer to prevent cross-customer replay.
- Redis TTL for idempotency entries: `86400` seconds (24 hours).

## What to Avoid Suggesting

- `float` for any monetary value.
- `datetime.utcnow()` anywhere.
- `print()` for debugging — use `logging.getLogger(__name__)`.
- `SELECT *` queries — always select explicit columns.
- Bare `except:` or `except Exception:` in service or adapter code.
- Hardcoded secrets, connection strings, or API keys anywhere in source code.
- Offset-based pagination for transaction history.
- Returning HTTP 200 for error conditions.
- Logging variables that may contain PAN, CVV, or raw JWT tokens.

## FinTech-Sensitive Defaults

When implementing any new feature or endpoint in this project, apply these defaults unless the specification explicitly states otherwise:

1. Require authentication (JWT) — no anonymous access.
2. Check resource ownership before returning or mutating data.
3. Write an audit log entry for every state change.
4. Use `Decimal` for every monetary value.
5. Return structured error responses with `error_code` and `correlation_id`.
6. Apply optimistic locking for all entity updates.
7. Support `Idempotency-Key` on all `POST` and `PATCH` endpoints.
