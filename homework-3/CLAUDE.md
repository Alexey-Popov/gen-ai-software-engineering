# Claude Code Rules - Virtual Card Lifecycle Project

## Project Context

**FinTech application** for virtual card management in a **regulated environment** (PCI DSS, GDPR, CCPA).

**Core Principles:**
- Security, compliance, and auditability are paramount
- User data protection is non-negotiable
- Financial calculations must be precise (no floating-point errors)
- Every state change must be auditable
- System must fail securely, not permissively

---

## Coding Patterns

### Monetary Values — Always Decimal, Never Float

Use `decimal.Decimal` (Python) or `decimal.js` (Node.js) for every monetary amount.

```python
amount = Decimal("500.00")   # correct
amount = 500.00              # WRONG — float causes precision errors
```

Database: `DECIMAL(19,4)`. API: string format `"500.00"`.

### Error Types — Explicit, Domain-Specific

Raise named exceptions with HTTP status codes, not bare `Exception`.

```python
class CardNotFoundError(Exception):
    status_code = 404

class InsufficientLimitError(Exception):
    status_code = 400
```

### Idempotency — Required on All Writes

Every POST/PATCH/DELETE must check the `Idempotency-Key` header and return cached response on duplicate.

TTL: 24 hours in Redis. Same key + different payload → 409 Conflict.

### Optimistic Locking — Version Field

Include `version` on every mutable resource. Update must match current version; return 409 if mismatch.

```python
UPDATE virtual_cards SET status=?, version=version+1 WHERE id=? AND version=?
```

### Structured Logging — No Sensitive Data

Log with context fields (`card_id`, `user_id`, `request_id`). Never log PAN, CVV, or raw card numbers.

```python
logger.info("card_frozen", card_id=str(card_id), user_id=str(user_id))
```

### Parameterized Queries Only

Never interpolate user input into SQL strings. Use ORM or parameterized queries exclusively.

---

## Patterns to Avoid

| Wrong | Correct | Reason |
|-------|---------|--------|
| `amount = 0.1 + 0.2` | `Decimal("0.1") + Decimal("0.2")` | Float precision loss |
| `f"WHERE id = '{id}'"` | `where(Card.id == id)` | SQL injection |
| `logger.info(card.pan)` | `logger.info(card.masked_pan)` | PCI DSS violation |
| `except Exception:` | `except ProcessorError as e:` | Hides real errors |
| Magic number `10` | `MAX_CARDS_PER_USER = 10` | Unclear intent |

---

## Naming Conventions

| Scope | Convention | Example |
|-------|-----------|---------|
| Database tables | `snake_case` | `virtual_cards`, `card_audit_logs` |
| API endpoints | `kebab-case` | `/virtual-cards/{id}/spending-limits` |
| Variables/functions | `snake_case` / `camelCase` | `card_token`, `getUserCards` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_CARDS_PER_USER` |
| Classes/types | `PascalCase` | `VirtualCard`, `SpendingLimit` |

---

## Security First Principles

### Never Expose PAN
- Store only `card_token` and `masked_pan` (`****1234`) — never the full PAN
- Scan all responses before commit: `\b\d{13,19}\b` must match nothing
- Database views must return only `masked_pan`

### Always Validate Input
Use Pydantic (Python) or Zod (Node.js) schema validation, not manual `if` checks.
- Amounts: positive Decimal, ≤ $1M
- Currency: ISO 4217 three-letter code
- IDs: UUID format
- Page size: ≤ 100

### Fail Securely — Explicit Allow-List
Authorization must be an explicit allow-list. Default is `403 Forbidden`.
Log every denied access attempt.

### Secrets via Environment Variables
Never hardcode credentials. Use `os.environ["DATABASE_URL"]` or a secrets manager.

### Rate Limiting
- Users: 100 req/min (writes), 200 req/min (reads)
- Return HTTP 429 with `Retry-After` header

---

## FinTech-Specific Defaults

| Concern | Rule |
|---------|------|
| Monetary amounts | `DECIMAL(19,4)` in DB, string in API |
| Timestamps | `TIMESTAMPTZ`, always UTC, ISO 8601 |
| Audit logs | Append-only, 7-year retention, partitioned by month |
| Idempotency TTL | 24 hours from first use |
| Rate limits | 100 req/min writes, 200 reads per user |
| Timeouts | 30s card provisioning, 5s state changes, 10s queries |
| Currency | ISO 4217 codes only (USD, EUR, GBP) |

---

## Testing Requirements

### Coverage & Structure
- **Business logic:** >80% line coverage
- **API endpoints:** every endpoint has ≥ 1 test
- **Pattern:** happy path + edge cases + error cases + concurrency

### Must-Have Test Cases
- Spending limit at exact boundary (should allow, not reject)
- API response contains no full PAN (`\b\d{13,19}\b` → zero matches)
- User cannot access another user's card (expect 403)
- Frozen card rejects transactions (expect 400/403)
- Idempotent request returns same response (expect 200, not 201)

---

## Code Review Checklist

- [ ] No PAN in outputs — searched `\d{13,19}`, found none
- [ ] Decimal for all money — no `float`
- [ ] Parameterized queries — no string interpolation
- [ ] No bare `except:` — all exceptions named and logged
- [ ] Audit log written for every state change
- [ ] ≥ 3 unit tests per function, integration test per endpoint
- [ ] New endpoints have rate limiting middleware
- [ ] POST/PATCH/DELETE check `Idempotency-Key`
- [ ] Authorization checks in place, default deny
- [ ] No secrets in code — `git secrets` scan clean

---

## Common Data Formats

**API error (RFC 7807):**
```json
{
  "type": "https://api.example.com/errors/insufficient-limit",
  "title": "Insufficient Spending Limit",
  "status": 400,
  "detail": "Transaction $600.00 exceeds per-transaction limit $500.00",
  "instance": "/v1/cards/card_abc123/transactions"
}
```

**Audit log entry:**
```json
{
  "event_type": "CARD_FROZEN",
  "card_id": "card_abc123",
  "actor_id": "user_xyz789",
  "timestamp": "2025-05-05T10:30:00Z",
  "old_state": {"status": "ACTIVE"},
  "new_state": {"status": "FROZEN"},
  "metadata": {"ip_address": "203.0.113.42", "request_id": "req_abc123"}
}
```

---

This document ensures all generated code adheres to FinTech security standards, compliance requirements, and engineering best practices.
