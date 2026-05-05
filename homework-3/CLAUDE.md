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

### Use These Patterns

#### Decimal for All Monetary Calculations
```python
# Python
from decimal import Decimal
amount = Decimal("500.00")
limit = Decimal("1000.00")
remaining = limit - amount  # Decimal("500.00")

# Node.js
import Decimal from 'decimal.js';
const amount = new Decimal("500.00");
const limit = new Decimal("1000.00");
const remaining = limit.minus(amount);
```

**Why:** Float causes precision errors (0.1 + 0.2 = 0.30000000000000004) unacceptable in finance.

#### Explicit Error Types
```python
class CardNotFoundError(Exception):
    def __init__(self, card_id: str):
        self.status_code = 404
        self.message = f"Card {card_id} not found"

class InsufficientLimitError(Exception):
    def __init__(self, limit_type: str, limit: Decimal, requested: Decimal):
        self.status_code = 400
        self.message = f"{limit_type} limit ({limit}) exceeded by request ({requested})"
```

#### Idempotency Keys
```python
@app.post("/v1/cards")
async def create_card(
    request: CardCreateRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key")
):
    cached = await get_cached_response(idempotency_key)
    if cached:
        return cached

    card = await _create_card(request)
    await cache_response(idempotency_key, card, ttl=86400)  # 24h
    return card
```

#### Optimistic Locking
```python
@app.patch("/v1/cards/{card_id}/status")
async def update_status(
    card_id: UUID,
    request: StatusUpdateRequest,
    if_match: int = Header(..., alias="If-Match")
):
    result = await db.execute(
        update(VirtualCard)
        .where(VirtualCard.id == card_id, VirtualCard.version == if_match)
        .values(status=request.status, version=VirtualCard.version + 1)
    )
    if result.rowcount == 0:
        existing = await db.get(VirtualCard, card_id)
        if existing:
            raise VersionConflictError(current_version=existing.version)
        raise CardNotFoundError(card_id)
```

#### Structured Logging
```python
import structlog
logger = structlog.get_logger()

logger.info(
    "card_frozen",
    card_id=str(card_id),
    user_id=str(user_id),
    old_status="ACTIVE",
    new_status="FROZEN"
    # NEVER log PAN or sensitive data
)
```

#### Parameterized Queries
```python
# CORRECT
query = select(VirtualCard).where(VirtualCard.user_id == user_id)
result = await db.execute(query)

# WRONG - SQL injection
query = f"SELECT * FROM cards WHERE user_id = '{user_id}'"
```

---

### Avoid These Patterns

| ❌ Wrong | ✅ Correct | Reason |
|---------|----------|--------|
| `amount = 0.1 + 0.2` | `Decimal("0.1") + Decimal("0.2")` | Float precision loss |
| `f"DELETE FROM cards WHERE id = '{id}'"` | `delete(VirtualCard).where(VirtualCard.id == id)` | SQL injection |
| `logger.info(f"Card: {card.pan}")` | `logger.info(f"Card: {card.masked_pan}")` | PCI DSS violation |
| `if user.card_count >= 10:` | `MAX_CARDS = 10; if count >= MAX_CARDS:` | Magic numbers |
| `except Exception:` | `except ProcessorError as e:` | Broad exception catching |

---

## Naming Conventions

**Database tables:** `snake_case` (virtual_cards, card_audit_logs)
**API endpoints:** `kebab-case` (/virtual-cards/{id}/spending-limits)
**Variables/functions:** `snake_case` (Python) or `camelCase` (Node.js)
**Constants:** `UPPER_SNAKE_CASE` (MAX_CARDS_PER_USER = 10)
**Types/classes:** `PascalCase` (VirtualCard, SpendingLimit)

---

## Security First Principles

### Never Expose PAN
**Format:** `****{last4digits}`

```python
def mask_pan(last_four: str) -> str:
    if len(last_four) != 4 or not last_four.isdigit():
        raise ValueError("last_four must be 4 digits")
    return f"****{last_four}"

# API response - CORRECT
{"id": "card_abc123", "masked_pan": "****1234"}

# NEVER DO THIS
{"id": "card_abc123", "pan": "4532123456781234"}
```

**Enforcement:**
- Database stores only `masked_pan` and `card_token`, never full PAN
- API responses include only `masked_pan`
- Logs replace PAN patterns (`\d{13,19}`) with `****`
- Security tests scan all responses for full PAN

### Always Validate Input
```python
from pydantic import BaseModel, Field, validator

class SpendingLimitRequest(BaseModel):
    amount: str = Field(..., regex=r'^\d+\.\d{2}$')
    currency: str = Field(..., regex=r'^[A-Z]{3}$')

    @validator('amount')
    def amount_must_be_positive(cls, v):
        decimal_amount = Decimal(v)
        if decimal_amount <= 0:
            raise ValueError('Amount must be positive')
        if decimal_amount > Decimal("1000000.00"):
            raise ValueError('Amount cannot exceed $1M')
        return v
```

### Fail Securely
```python
# WRONG - Permissive
def check_access(user, card):
    if user.role == "ADMIN":
        return True
    return card.user_id == user.id  # Implicit allow

# CORRECT - Explicit
def check_access(user, card, operation):
    allowed = False

    if operation == "read":
        if user.role in ["ADMIN", "COMPLIANCE", "OPS"]:
            allowed = True
        elif user.role == "USER" and card.user_id == user.id:
            allowed = True

    if not allowed:
        logger.warning("access_denied", user_id=user.id, card_id=card.id)

    return allowed
```

### Log Security Events
```python
if await is_rate_limited(user.id):
    logger.warning(
        "rate_limit_exceeded",
        user_id=user.id,
        endpoint="/v1/cards",
        ip=request.client.host
    )
    raise RateLimitError()
```

### Use Secrets Management
```python
# WRONG
DATABASE_URL = "postgresql://user:password123@localhost/cards"

# CORRECT
import os
DATABASE_URL = os.environ["DATABASE_URL"]

# Better: Secret management service
from aws_secretsmanager_caching import SecretCache
secret = SecretCache().get_secret_string("prod/db/url")
```

### Rate Limiting
```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        user_id = request.state.user.id
        key = f"ratelimit:{user_id}:{request.method}:{request.url.path}"
        count = await redis.incr(key)

        if count == 1:
            await redis.expire(key, 60)

        max_requests = 100 if request.method in ["POST", "PATCH"] else 200

        if count > max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Exceeded {max_requests} req/min"},
                headers={"Retry-After": "60"}
            )

        return await call_next(request)
```

---

## FinTech-Specific Defaults

**Monetary amounts:** `DECIMAL(19,4)` in DB, string in API (`"500.00"`)
**Timestamps:** `TIMESTAMPTZ`, always UTC, ISO 8601 format (`2025-05-05T10:30:00Z`)
**Audit logs:** Immutable (append-only), 7-year retention, partitioned by month
**Idempotency:** 24-hour TTL from first use
**Rate limits:** 100 req/min (writes), 200 req/min (reads) per user
**Timeouts:** 30s card provisioning, 5s state changes, 10s queries
**Currency:** ISO 4217 codes only (USD, EUR, GBP)

---

## Testing Requirements

### Coverage & Structure
- **Business logic:** >80% line coverage
- **API endpoints:** 100% (every endpoint has ≥1 test)
- **Pattern:** Happy path + edge cases + error cases + concurrency

### Critical Test Cases
```python
def test_enforce_limits_allows_exact_limit():
    """Edge case: Transaction at exact limit should be allowed."""
    card = create_test_card(per_transaction_limit=Decimal("500.00"))
    enforce_spending_limits(card, Decimal("500.00"))  # Should not raise

def test_api_never_exposes_full_pan():
    """Security: API must never expose full PAN."""
    response = client.post("/v1/cards", json=request, headers=auth)
    response_text = json.dumps(response.json())
    assert not re.search(r'\b\d{13,19}\b', response_text)

def test_user_cannot_access_other_cards():
    """Authorization: Users can only access their own cards."""
    user1_card = create_card(user_id="user1")
    response = client.get(f"/v1/cards/{user1_card.id}", headers=get_auth("user2"))
    assert response.status_code == 403
```

---

## Code Review Checklist

Before committing, verify:

- [ ] **No PAN in outputs:** Searched for `\d{13,19}`, found none in logs/responses
- [ ] **Decimal for money:** All monetary calculations use Decimal, no float
- [ ] **Parameterized queries:** All SQL uses ORM or parameterized, no string interpolation
- [ ] **Error handling:** No bare `except:`, all exceptions logged
- [ ] **Audit logs:** State changes write to card_audit_logs
- [ ] **Tests written:** ≥3 unit tests per function, integration per endpoint
- [ ] **API docs updated:** OpenAPI spec reflects changes
- [ ] **Rate limiting:** New endpoints have middleware
- [ ] **Idempotency:** POST/PATCH/DELETE check Idempotency-Key
- [ ] **Authorization:** Permission checks in place, default deny
- [ ] **No secrets:** Scanned with git-secrets, env vars used

---

## Common Patterns Reference

### API Error Response (RFC 7807)
```json
{
  "type": "https://api.example.com/errors/insufficient-limit",
  "title": "Insufficient Spending Limit",
  "status": 400,
  "detail": "Transaction $600.00 exceeds per-transaction limit $500.00",
  "instance": "/v1/cards/card_abc123/transactions",
  "limit_type": "per_transaction",
  "limit_amount": "500.00",
  "requested_amount": "600.00"
}
```

### Audit Log Entry
```json
{
  "event_type": "CARD_FROZEN",
  "card_id": "card_abc123",
  "actor_id": "user_xyz789",
  "timestamp": "2025-05-05T10:30:00Z",
  "old_state": {"status": "ACTIVE", "version": 2},
  "new_state": {"status": "FROZEN", "version": 3, "reason": "suspected_fraud"},
  "metadata": {
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0...",
    "request_id": "req_abc123"
  }
}
```

### Spending Limits (JSONB)
```json
{
  "per_transaction": {"amount": "500.00", "currency": "USD"},
  "daily": {
    "amount": "2000.00",
    "currency": "USD",
    "period_start": "2025-05-05T00:00:00Z",
    "spent_in_period": "350.75"
  },
  "monthly": {
    "amount": "10000.00",
    "currency": "USD",
    "period_start": "2025-05-01T00:00:00Z",
    "spent_in_period": "2847.50"
  }
}
```

### Database Transaction
```python
async with db_session.begin():
    try:
        card = VirtualCard(user_id=user_id, status="PENDING", limits=limits, version=1)
        db_session.add(card)
        await db_session.flush()

        token_response = await processor.provision_card(user_id, limits)

        card.card_token = token_response.token
        card.masked_pan = token_response.masked_pan
        card.status = "ACTIVE"

        audit = CardAuditLog(
            event_type="CARD_CREATED",
            card_id=card.id,
            actor_id=user_id,
            new_state={"status": "ACTIVE"},
            metadata={"request_id": request_id}
        )
        db_session.add(audit)

        # Auto-commit at end, rollback on exception
    except ProcessorError as e:
        logger.error("provision_failed", error=str(e))
        raise ServiceUnavailableError("Provisioning unavailable")
```

---

## Quick Reference Card

| Task | Pattern | Avoid |
|------|---------|-------|
| **Money** | `Decimal("500.00")` | `500.00` (float) |
| **SQL** | `where(Card.id == id)` | `f"WHERE id = '{id}'"` |
| **Logs** | `masked_pan = "****1234"` | `pan = "4532..."` |
| **Errors** | `raise CardNotFoundError(id)` | `raise Exception()` |
| **Concurrent** | `If-Match: {version}` | No version check |
| **Retries** | `Idempotency-Key: {uuid}` | Duplicate ops |
| **Timestamps** | `datetime.now(timezone.utc)` | `datetime.now()` |
| **Validation** | Pydantic models | Manual `if` checks |

---

This document ensures all code adheres to FinTech security standards, compliance requirements, and engineering best practices.
