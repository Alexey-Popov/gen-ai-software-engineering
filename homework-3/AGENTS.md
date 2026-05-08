# Agent Configuration for Virtual Card Lifecycle System

This document defines guidelines and constraints for AI coding agents working on the virtual card lifecycle management system in a regulated FinTech environment.

---

## Tech Stack Assumptions

**Backend:** Python 3.11+ (FastAPI) or Node.js 18+ (Express) with async/await
**Database:** PostgreSQL 14+ with JSONB, ORM: SQLAlchemy 2.0+ or Prisma
**API Docs:** OpenAPI 3.0 (auto-generated from code)
**Decimal:** `decimal.Decimal` (Python) or `decimal.js` (Node.js) - NEVER float for money
**Testing:** pytest or Jest, coverage target >80% for business logic
**Caching:** Redis 7+ for idempotency keys, rate limiting, TTL-based expiration
**Logging:** Structured JSON with context (request_id, user_id, card_id)
**HTTP Client:** httpx (Python) or axios (Node.js) with retry logic and circuit breakers

---

## Domain Rules (FinTech/Banking)

### PCI DSS Compliance
- **Never log, display, or transmit full PAN (Primary Account Number)**
- Only store processor token, never actual card number
- All outputs use masked format: `****1234`
- Regex to detect PAN: `\b\d{13,19}\b`

### Decimal for Money
- Prevents floating-point errors (0.1 + 0.2 ≠ 0.3 in float)
- Database: `DECIMAL(19,4)` for up to $999 trillion with cent precision
- API: String format `"500.00"` to avoid JSON number precision loss
- **Reject any code using float/double for monetary values**

### Idempotency Required
- POST/PATCH/DELETE require `Idempotency-Key` header (UUID)
- Duplicate key + same payload → cached result (200 OK)
- Duplicate key + different payload → 409 Conflict
- TTL: 24 hours, stored in Redis or database

### Audit Logging Mandatory
- Every card operation generates immutable audit event
- Events: `CARD_CREATED`, `CARD_FROZEN`, `CARD_UNFROZEN`, `CARD_LIMITS_UPDATED`, `CARD_CLOSED`
- Fields: event_type, card_id, actor_id, timestamp, old_state, new_state, metadata (IP, user agent, request ID)
- Append-only, no UPDATE/DELETE

### Privacy by Design
- Minimal data collection (email, name, user ID only)
- Encryption at rest for sensitive fields
- GDPR Article 17: Anonymize after 7-year retention
- CCPA: Provide data export API

### Fail Securely
- Authorization: Explicit allow-list, default 403 Forbidden
- External failures: 503 Service Unavailable, not 500
- Database timeouts: Retry with exponential backoff
- Processor outages: Serve cached data, queue writes

---

## Code Style & Conventions

### RESTful API
- Collections: `GET /v1/cards`, `POST /v1/cards`
- Resources: `GET /v1/cards/{id}`, `PATCH /v1/cards/{id}`
- Sub-resources: `GET /v1/cards/{id}/transactions`

**HTTP Status Codes:**
- 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Rate Limit, 500/502/503 Server Errors

### Error Format (RFC 7807)
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Spending limit must be positive",
  "instance": "/v1/cards/card_abc123/limits"
}
```

### Naming Conventions
- **Database tables:** `snake_case` (virtual_cards, card_audit_logs)
- **API paths:** `kebab-case` (/virtual-cards/{id}/spending-limits)
- **Variables:** `snake_case` (Python) or `camelCase` (Node.js)
- **Constants:** `UPPER_SNAKE_CASE` (MAX_CARDS_PER_USER = 10)
- **Classes:** `PascalCase` (VirtualCard, SpendingLimit)

### Timestamps & Currency
- **Format:** ISO 8601 with Z suffix: `2025-05-05T10:30:00Z`
- **Database:** `TIMESTAMPTZ`, always store UTC
- **Currency:** ISO 4217 three-letter codes (USD, EUR, GBP)

---

## Testing Expectations

### Unit Tests (>80% coverage)
Test business logic, validations, state machines, edge cases (negative amounts, boundaries).

```python
def test_enforce_limits_rejects_exceeding_limit():
    card = VirtualCard(per_transaction_limit=Decimal("500.00"))
    with pytest.raises(InsufficientLimitError, match="per-transaction"):
        enforce_spending_limits(card, Decimal("600.00"))
```

### Integration Tests
Test database operations, external API mocks, audit logging, idempotency.

### E2E Tests
Critical journeys: create card → freeze → query transactions → verify optimistic locking.

### Performance Tests
Load test at 2x peak (k6/Locust). Verify: card creation p95 <500ms, freeze p95 <200ms, queries p95 <300ms.

### Security Tests
- Authorization boundaries (users cannot access others' cards)
- PAN exposure scan: `\b\d{13,19}\b` (should find none)
- SQL injection prevention (parameterized queries)

### Compliance Tests
```python
def test_all_card_operations_generate_audit_logs():
    operations = [("create_card", "CARD_CREATED"), ("freeze_card", "CARD_FROZEN"), ...]
    for op_fn, expected_event in operations:
        card = op_fn(user, params)
        audit = get_latest_audit_log(card.id)
        assert audit.event_type == expected_event
```

---

## Security & Compliance Constraints

### Never Log Sensitive Data
Prohibited: Full PAN, CVV, passwords, API keys, full card expiration dates.
Allowed: user_id, card_id, masked PAN (`****1234`), token ID.

### Input Validation
- Validate types: Decimal for amounts, UUID for IDs, enum for status
- Validate ranges: positive amounts, page size ≤100
- Validate format: ISO 4217 currency, ISO 8601 dates
- Use schema validation (Pydantic/Zod), not manual checks

### Parameterized Queries Only
```python
# WRONG: SQL injection
query = f"SELECT * FROM cards WHERE user_id = '{user_id}'"

# CORRECT: Parameterized
query = "SELECT * FROM cards WHERE user_id = %s"
cursor.execute(query, (user_id,))
```

### Rate Limiting
- Users: 100 req/min (writes), 200 req/min (reads)
- Orgs: 1,000 req/min (writes), 2,000 req/min (reads)
- Response: HTTP 429 with `Retry-After` header

### Encryption
- **At rest:** AES-256 for card tokens, encrypted DB backups
- **In transit:** TLS 1.3 only, mTLS for processor

### JWT Security
- Verify signature, check `exp` (max 1h), validate `iss`/`aud`
- Log failed auth attempts for security monitoring

---

## Edge Case Handling

**Empty states:** Return `[]` not null
**Concurrent ops:** Optimistic locking with version field, 409 on conflict
**Invalid input:** 400 Bad Request with RFC 7807 details
**Timeouts:** Circuit breaker at 50% error rate, 503 with retry queue
**Idempotency:** Same key + same payload → cached result, different payload → 409
**Partial failures:** Database transactions with rollback on error
**Pagination:** Max 100 records, cursor-based for performance

---

## Agent Behavioral Rules

When generating code, AI agents must:

1. **Explicit error handling** - Catch specific exceptions, log, return proper HTTP codes
2. **Write tests alongside code** - Min 3 unit tests per function, integration for each endpoint
3. **Never commit secrets** - Use environment variables or secret managers
4. **Include audit logs** - Verify event type, before/after state, metadata
5. **Verify PAN masking** - Search for `\b\d{13,19}\b` before committing
6. **Use idempotency keys** - Check POST/PATCH/DELETE operations
7. **Document assumptions** - Explain "why" for regulatory/business rules
8. **Ask when uncertain** - Escalate security decisions (retention, encryption, permissions)

---

## Example Prompts

### Create API Endpoint
> Create POST /v1/cards endpoint accepting spending limits, validate amounts are positive and currency is ISO 4217, call processor to provision card, store with PENDING status, write audit log, return 201 with card_id and masked_pan. Include idempotency, rate limiting, OpenAPI docs.

### Add Business Logic
> Implement spending limit enforcement checking per-transaction, daily, monthly limits. Use Decimal, handle concurrency with pessimistic locking (SELECT FOR UPDATE), raise InsufficientLimitError if exceeded. Include unit tests for all limits and edge cases.

### Refactor for Security
> Refactor card retrieval to always mask PAN. Use database view v_virtual_cards_masked returning masked_pan only. Add test verifying `****1234` format. Update OpenAPI examples.

---

This configuration ensures secure, compliant, and maintainable code meeting FinTech regulatory requirements and industry best practices.
