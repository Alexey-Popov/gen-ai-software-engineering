# Test Strategy — Virtual Card Lifecycle Service

> Produced by Task X.4. Full category invariants in `agents.md §4`. This document translates those invariants into a runnable test plan with fixture shapes and security-verification commands.

---

## 1. Test Pyramid

```
         [ Load / Locust / k6 ]           ← docs/load-test-plan.md
        [ E2E — Postman / httpx ]
      [ Contract — processor, SCA stubs ]
    [ Security — auth bypass, PAN-in-log ]
  [ Integration — DB + external service paths ]
[ Unit — pure functions, state machine, money math ]
```

Tests run in this order in CI: unit → integration → contract → security → e2e. Load tests run on demand before significant releases.

---

## 2. Category Matrix

| Category | When required | Minimum assertions | Tooling |
|---|---|---|---|
| **Unit** | Any pure function (state machine, limit enforcement, money arithmetic, PAN masking, cursor encode/decode) | All success paths + all error paths; zero I/O | `pytest` |
| **Integration** | Any endpoint or worker that writes to DB or calls an external service | Happy path + idempotency replay + external 503 path + audit row assertion | `pytest` + `asyncpg` test DB + httpx `AsyncClient` |
| **Contract** | Any integration with an external service (processor, identity, KYC, fraud engine) | Stub response matches named contract shape; shape mismatch is a hard failure | `pytest` + Pact (or inline Pydantic stub validation) |
| **Security** | Any endpoint touching card data, auth tokens, or audit data | Auth bypass → 401/403; cross-user access → 404; PAN-in-log grep must be empty | `pytest -m security` |
| **Audit assertion** | Every integration test for a mutation endpoint | Assert exactly one `audit_events` row with correct `action`, `actor_id`, `diff` (no `pan`/`cvv` key) | `pytest` fixture `assert_audit_row` |
| **Load** | Before major releases; SLO validation | p95 read < 300 ms, freeze p99 < 2 s, 429 fires at limit | k6 (see `docs/load-test-plan.md`) |

---

## 3. Mandatory Audit Assertion

Every integration test for a `POST` or `PATCH` endpoint **must** call:

```python
def assert_audit_row(db_session, action: str, actor_id: UUID, diff_forbidden_keys=("pan", "cvv")):
    row = db_session.execute(
        select(AuditEventORM).where(AuditEventORM.action == action)
    ).scalar_one()
    assert row.actor_id == actor_id
    for key in diff_forbidden_keys:
        assert key not in (row.diff or {})
```

Absence of an `audit_events` row is a test failure, not a warning.

---

## 4. Security Grep Harness

Run after any test that exercises a card-data path:

```bash
# No PAN-length numeric string in any captured log output
grep -E '\b[0-9]{12,19}\b' <log_output_file> && echo "FAIL — PAN leaked" || echo "PASS"

# No CVV value in card-data context
grep -E 'cvv\s*[:=]\s*[0-9]{3,4}' <log_output_file> && echo "FAIL — CVV leaked" || echo "PASS"

# JWT algorithm not derived from token header (code-level check)
grep -rE 'jwt\.decode\(.*algorithms\s*=\s*None\|algorithms\s*=\s*\[\]' src/ && echo "FAIL" || echo "PASS"
```

These checks must also pass against the production structured-log output captured during load test runs.

---

## 5. Fixture Catalogue

| Fixture | Type | Used in |
|---|---|---|
| `fixture_cardholder_kyc_approved` | DB seed | MLO-1 issue, MLO-3 limits, MLO-4 transactions |
| `fixture_processor_card_response` | HTTP stub (200) | Task 1.4 happy path |
| `fixture_processor_503` | HTTP stub (503) | E1-2, E2-3, E3-5 |
| `fixture_two_cardholders_each_with_2_cards` | DB seed | Data isolation tests |
| `fixture_card_active` | DB seed | MLO-2 freeze/unfreeze |
| `fixture_card_frozen_fraud_locked` | DB seed | E2-2 fraud lock |
| `fixture_fraud_freeze_event` | Kafka message | Task 2.3 consumer |
| `fixture_audit_attempts_failed_freeze` | DB seed | E2-3 two-table audit |
| `fixture_card_with_daily_limit_100` | DB seed | MLO-3 limit enforcement |
| `fixture_sca_verified_aal2` | HTTP stub | Task 3.2 SCA gate |
| `fixture_fraud_engine_block` | HTTP stub | E3-3 fraud block |
| `fixture_card_with_10k_transactions` | DB seed | MLO-4 pagination |
| `fixture_processor_lag_stale_data` | DB seed | E4-2 stale data |
| `fixture_audit_events_for_card_x` | DB seed | MLO-5 audit replay |
| `fixture_cardholder_for_gdpr_redaction` | DB seed | Task 5.5 GDPR |
| `fixture_reconciliation_discrepancy_seed` | DB seed | Task 5.7 reconciliation |
| `fixture_processor_degraded_503` | HTTP stub (all 503) | E6-1 degradation |
| `fixture_rate_limit_11_requests` | Counter state | MLO-6 rate limiter |
| `fixture_notification_service_503` | HTTP stub (503) | Task 6.3 consumer |
| `fixture_jwt_alg_none_token` | JWT token | test_jwt_alg_none_rejected |
| `fixture_jwt_unknown_issuer_token` | JWT token | test_jwt_unknown_issuer_rejected |
| `fixture_reveal_handle_version_1` | DB seed | test_reveal_handle_concurrent_redemption |
| `fixture_webhook_valid_signature` | HTTP request | Task 4.3 happy path |
| `fixture_webhook_old_timestamp` | HTTP request | E test_webhook_replay_old_timestamp |
| `fixture_ssrf_rfc1918_processor_url` | Config override | test_ssrf_allowlist_rejects_rfc1918_url |
| `fixture_cardholder_with_cards_and_transactions` | DB seed | Task 7.1 DSR export |
| `fixture_dsr_partial_refusal_audit_records` | DB seed | test_dsr_export_partial_refusal |

---

## 6. Mocking Policy

| Dependency | Test type | Mock approach |
|---|---|---|
| PostgreSQL | Unit | No DB; pure function inputs only |
| PostgreSQL | Integration | Real `asyncpg` connection to a test schema; rolled back after each test |
| Processor HTTP | Integration | `httpx.MockTransport` inline stub |
| Processor HTTP | Contract | Pact provider stub validating response schema |
| Kafka | Integration | In-process `aiokafka` mock or test Kafka container |
| Redis | Integration | `fakeredis` (async) |
| KYC / SCA / Fraud engine | Integration | `httpx.MockTransport` inline stub; always test the 503 path |

**Never** mock `audit_events` writes in integration tests — the audit assertion depends on real DB state.
