# Virtual Card Lifecycle — Feature Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives. All regulatory citations are verified against authoritative sources; entries marked **[ASSUMED]** are reasoned estimates labelled as such.

---

## Table of Contents

1. [High-Level Objective](#1-high-level-objective)
2. [Mid-Level Objectives](#2-mid-level-objectives)
3. [NFR and Policy](#3-nfr-and-policy)
4. [Implementation Notes](#4-implementation-notes)
5. [Context](#5-context)
6. [Edge Cases](#6-edge-cases)
7. [Low-Level Tasks](#7-low-level-tasks)
8. [Verification](#8-verification)
- [References](#references)

---

## 1. High-Level Objective

Enable cardholders of a regulated FinTech to manage the full lifecycle of their virtual payment cards — issue, freeze/unfreeze, set spending limits, and view authorizations — from a self-service surface, while giving internal ops/compliance and fraud analysts the audit trail, controls, and observability required to operate the product in a PCI-DSS- and PSD2-compliant environment.

**Scope boundary:** Issuer-side card lifecycle and authorization-decision metadata only. Physical-card issuance, KYC onboarding, settlement/clearing, dispute/chargeback adjudication, merchant acquisition, and AML/CFT compliance engine implementation are **out of scope**. Note on AML/CFT: EU AMLR 2024/1624 and UK MLRs 2017 Reg 38 place AML obligations on the licensed entity (the BIN-sponsor EMI in the program-manager model assumed here); this service exposes integration surface (Kafka events, lifecycle hooks) for an external AML engine but does not implement one. See §1.2.

### 1.2 Regulatory Model

This service assumes the **program-manager model**. A licensed BIN-sponsor EMI (Electronic Money Institution) holds the EMD2 authorisation (EU Directive 2009/110/EC or UK EMRs 2011), primary AML/CFT liability, safeguarding obligations, and card-network scheme membership. This service is operated as a program manager under the BIN sponsor's licence. Implications:

- AML/CFT primary liability (transaction monitoring, sanctions screening, SAR filing) rests with the BIN sponsor; this service emits transaction-monitoring events to Kafka and exposes lifecycle hooks for KYC re-checks to support the sponsor's obligations.
- Safeguarding of cardholder funds is the BIN sponsor's obligation; this service holds no e-money balances.
- Data sharing with the BIN sponsor must be covered by a documented Data Processing Agreement (DPA) including appropriate GDPR Chapter V safeguards for any cross-border transfer.
- If the operator's model changes to own-licence, all AML/CFT requirements of EU AMLR 2024/1624 apply directly and a full compliance programme outside the scope of this spec is required.

---

## 2. Mid-Level Objectives

Each MLO is phrased as an observable outcome with an acceptance hook. Traceability: each MLO maps to a verification entry in §8 and a task cluster in §7.

### MLO-1 — Issue virtual card

An authenticated cardholder whose KYC is APPROVED issues a virtual card and receives a tokenized card reference. A one-time, time-bound reveal handle (TTL ≤ 60 s, single-use) is provided for PAN/CVV display; no PAN or CVV is persisted in the issuer's data store at any time.

**Acceptance hook:** Card entity exists with `status=ACTIVE`; reveal handle expires or is consumed after first use; no PAN/CVV column present in issuer DB schema; audit event `CARD_ISSUED` written in the same transaction as the card row.

### MLO-2 — Freeze and unfreeze a card

A cardholder or a fraud analyst can transition a card between `ACTIVE ↔ FROZEN`. The state change propagates to the authorization decisioning surface within the stated SLO. A fraud-locked card cannot be unfrozen by the cardholder.

**Acceptance hook:** After a freeze, a simulated authorization request against the card is declined with no stale-state window beyond the stated propagation SLO; both actor intents are captured when a cardholder freeze and a fraud-analyst freeze race on the same card.

### MLO-3 — Set spending limits

A cardholder modifies per-transaction, daily, monthly, or per-MCC limits. Limit increases require an SCA challenge under the risk-based interpretation of PSD2 Art. 97(1)(c). Limit decreases take effect immediately without SCA. Fraud scoring gates the operation.

**Acceptance hook:** A limit increase without a verified SCA token returns `401 SCA_REQUIRED`; a limit increase blocked by the fraud engine returns `403 FRAUD_RISK_LIMIT_INCREASE` with no DB state change; idempotent retry returns the original response.

### MLO-4 — View card transactions

A cardholder lists and inspects authorizations for their own cards. Responses include masked PAN (`XXXXXX{last4}`), ISO-4217 amounts, ISO-8601 UTC timestamps, a `data_freshness_at` field, cursor-based pagination, and filter support. Cardholder data is isolated: no cross-cardholder access is possible.

**Acceptance hook:** `GET /cards/{other_user_card_id}/transactions` returns `404` (no existence oracle); response for a card with 10 000 transactions meets the p95 latency target in §3; `data_freshness_at` is present in every response.

### MLO-5 — Audit and replay

Every state-changing action is written to an immutable `audit_events` table within the **same DB transaction** as the operational mutation. Events are also published to a downstream stream via the transactional outbox pattern. Ops/compliance can replay the audit history (who/when/what changed) by card, by user, or by time window. A projection over the stream supports state-at-time queries.

**Acceptance hook:** 100% of mutations have a corresponding `audit_events` row (no orphaned mutations, no orphaned audits); `UPDATE` or `DELETE` on `audit_events` fails at the DB layer; regulator-export job produces a deterministic, hash-verifiable artifact for any `(entity, time-window)` input; GDPR redaction tombstones PII without deleting the audit chain.

### MLO-6 — Operate within stated SLOs

The system meets stated availability, latency, and recovery targets under defined load. The freeze endpoint remains available during processor-API partial degradation (local state change path is independent of the processor success path).

**Acceptance hook:** Load-test plan (§7, Task 6.2) documents four scenarios; freeze-under-degradation scenario verifies local FROZEN state is written even when the processor returns 5xx; Prometheus alert rules encode every SLO threshold from §3.

---

## 3. Non-Functional & Policy

All targets apply per-region (single-region deployment assumed). Performance targets labelled **[ASSUMED]** are reasoned estimates anchored to a stated peer or principle; they are not fabricated.

| Concern | Target | Anchor / Source |
|---|---|---|
| API availability — read paths | 99.9 % monthly | **[ASSUMED]** — industry-standard for non-safety-critical reads; Stripe public status historically exceeds this for their core API |
| API availability — freeze endpoint | 99.95 % monthly | **[ASSUMED]** — elevated above reads because freeze is safety-critical (cardholder stops fraud); applies to local state change, not to processor propagation |
| p95 latency — reads (`GET /cards`, `GET /cards/:t/transactions`) | < 300 ms | **[ASSUMED]** — typical FinTech UX target; comfortable above Postgres + FastAPI baseline (~50 ms); Stripe targets < 500 ms p99 for simple reads |
| p95 latency — writes (all state-change endpoints, excl. SCA round-trip) | < 800 ms | **[ASSUMED]** — includes processor API call (~200 ms typical for Marqeta/Stripe Issuing class); 800 ms p95 provides headroom for tail latency |
| Freeze propagation to authorization edge | ≤ 2 s p99 | **[ASSUMED]** — anchored to card-network issuer-response window: Visa and Mastercard require issuers to respond to authorization requests within ~2 s end-to-end (ISO 8583 / network rules); post-freeze, the next authorization must see the new state within the same window |
| SAD (CVV/CVV2/CVC2) storage | **Never stored after authorization** | PCI DSS v4.0 Req 3.3 (Sensitive Authentication Data); source: [PCI SSC FAQ](https://blog.pcisecuritystandards.org/faq-can-cvc-be-stored-for-card-on-file-or-recurring-transactions) |
| PAN storage | Tokenized only; raw PAN never at rest in issuer DB | PCI DSS v4.0 Req 3 (Protect Stored Account Data); processor partner holds PAN vault; issuer stores token + masked PAN (`XXXXXX{last4}`) only |
| Audit log retention | 12 months total; 3 months immediately available | PCI DSS v4.0 Req 10.5.1; source: [PCI SSC](https://www.pcisecuritystandards.org) |
| Audit log integrity | INSERT-only; tamper detection via row hashes | PCI DSS v4.0 Req 10 (protect audit logs from modification) |
| SCA on limit increases | Required; bank-led risk-based application | PSD2 Art. 97(1)(c) (Directive 2015/2366/EU): "carries out any action through a remote channel which may imply a risk of payment"; SCA enforced via EBA RTS on SCA (Regulation (EU) 2018/389); **NB:** limit increases are not black-letter payment initiations under Art. 97(1)(b) — this is a conservative industry interpretation, not an explicit EBA mandate |
| Authentication strength — cardholder default | AAL2 minimum | NIST SP 800-63B §5: two distinct factors; session ≤ 24 h; inactivity ≤ 1 h; source: [NIST pages.nist.gov/800-63-4](https://pages.nist.gov/800-63-4/sp800-63b/aal/) |
| Authentication strength — ops, audit, high-risk cardholder actions | AAL3 | NIST SP 800-63B §5: hardware-based non-exportable private key; session ≤ 12 h; inactivity ≤ 15 min |
| GDPR right to erasure | Partial: PII tombstoned; audit skeleton retained under legal-obligation basis | GDPR Art. 17(3)(b): "for compliance with a legal obligation which requires processing by Union or Member State law to which the controller is subject"; PCI DSS + AML retention obligations apply |
| GDPR data minimisation | Only data necessary for card lifecycle collected | GDPR Art. 5(1)(c); IP addresses masked to /24 in audit log |
| Privacy by design | Defaults configured for minimum necessary access | GDPR Art. 25 |
| Transaction pagination limit | page_size max 100 (default 20) | **[ASSUMED]** — prevents unbounded queries; standard cursor-based pagination |
| Rate limiting | 10 req/min/cardholder on write endpoints; 60 req/min/cardholder on read endpoints; `429` + `Retry-After` on breach; implemented as Starlette middleware + Redis sliding window (`slowapi`); rate-limit key = `sha256(cardholder_id + endpoint_path)` | **[ASSUMED]** — conservative limits for a low-volume FinTech product; write limit prevents automated limit probing and credential-stuffing on mutation paths; read limit leaves headroom for legitimate app polling |
| Cursor pagination filter stability | Cursor encodes `(created_at \| id \| sha256(canonical_filter_params)[:12])`; changing filters mid-pagination returns `400 CURSOR_FILTER_MISMATCH` | Prevents silent wrong results when client changes filters between pages; no major REST API natively protects against this — explicit server-side detection closes the gap |
| TLS | TLS 1.3 minimum for all external connections | Industry baseline; PCI DSS v4.0 Req 4.2.1 |
| Secret rotation | API keys rotatable without downtime | Operational requirement; supports zero-downtime key rotation |
| JWT algorithm restriction | Only RS256 and ES256 permitted; `alg=none` and HS256 explicitly rejected; `algorithms=["RS256","ES256"]` hard-coded in all JWT decode calls; `iss` validated against `ALLOWED_ISSUERS` allowlist (see §4 JWT Validation) | RFC 8725 (JWT BCP) §3.1–3.2; OWASP JWT Cheat Sheet; PyJWT docs — "never compute algorithms from the token header itself" |
| JWT issuer allowlist | `ALLOWED_ISSUERS`: list of exact issuer URL strings (case-sensitive, scheme included), each bound to its JWKS endpoint in `Settings`; token whose `iss` is not in the list is rejected before signature verification; user identity keyed on `(iss, sub)` pair | RFC 7519 §4.1.1; RFC 8725 §3.8 |
| Redis security | TLS required (`tls-port 6380`, plain `port 6379` disabled); Redis 6+ ACL enforced (default user disabled; named app users with key-pattern scope); `REDIS_URL` and `REDIS_PASSWORD` must be `SecretStr`; Redis bound to private network only | PCI DSS v4.0 Req 4 (encryption in transit), Req 8 (strong credentials); Redis 7 ACL docs |
| Redis rate-limit window TTL | Rate-limit sliding-window TTL = 60 s (matching per-minute metric); configurable via `RATE_LIMIT_WINDOW_SECONDS`; every Redis `INCR` on a rate-limit key must be accompanied by an `EXPIRE` of this value to prevent immortal counters | **[ASSUMED]** — default matches the per-minute rate limit period; immortal counters block cardholder indefinitely on restart |
| Webhook replay prevention | Processor webhook handler must: (1) reject if `abs(clock_now - webhook_timestamp) > 300 s`; (2) reject if `event_id` seen in Redis dedup set (TTL 72 h, `SET NX`); (3) verify HMAC-SHA256 signature. Order: timestamp check first (CPU-only), then HMAC, then Redis dedup | Stripe webhook signing docs (±5 min tolerance); Slack signed secrets (same pattern); Redis `SET NX` dedup pattern |
| Encryption at rest | Any CDE-scope component must store sensitive data with AES-256 envelope encryption: DEK wrapped by a customer-managed KMS key (CMK) in an HSM-backed KMS (AWS KMS / Azure Key Vault / GCP CMEK); defined cryptoperiod with annual automatic rotation; split-knowledge/dual-control for manual key operations; disk-level TDE alone does not satisfy this requirement | PCI DSS v4.0 Req 3.5.1, 3.5.1.2, 3.6; PCI SSC Tokenization Guidelines |
| SSRF guard | `PROCESSOR_API_BASE_URL` validated at startup against a compile-time FQDN allowlist (`SSRF_ALLOWED_PROCESSOR_HOSTNAMES`, HTTPS port 443 only); all outbound HTTP to the processor uses an SSRF-safe transport that performs single-shot DNS resolution, rejects RFC-1918 / loopback / link-local / cloud-metadata IPs, and re-validates on each redirect hop; startup validation alone is insufficient | OWASP SSRF Prevention Cheat Sheet; OWASP Top 10 API7:2023 |
| Security headers | All HTTP responses must include: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`; implemented via Starlette middleware or load-balancer | OWASP Secure Headers Project |
| GDPR Art. 6 lawful basis | Processing activity → lawful basis: card issuance / transaction processing / notifications → contract performance (Art. 6(1)(b)); audit log retention / AML event relay → legal obligation (Art. 6(1)(c)); fraud screening / rate-limit analytics → legitimate interest (Art. 6(1)(f)); each basis must be documented in the RoPA (Art. 30) | GDPR Art. 6; ICO lawful basis guidance |
| GDPR Art. 30 — RoPA | Controller must maintain a Record of Processing Activities covering all processing activities in this service; the §5.1 service inventory and §5.2 data-store list serve as source-of-truth inputs to the RoPA; RoPA is a separate compliance document outside this spec | GDPR Art. 30; EDPB WP248 |
| GDPR Art. 33/34 — Breach notification | Severity-classification matrix: P1 (PAN/CVV exposure or mass account data) → Art. 33 + Art. 34 notification mandatory; P2 (metadata breach, no CHD) → Art. 33 only; P3 (internal near-miss) → internal record only. 72-hour clock starts at internal `SECURITY_INCIDENT_SUSPECTED` event. Card PAN / CVV exposure is presumed high-risk (Art. 34 threshold met). DPA template and data-subject communication template are defined in the external Breach Response Runbook (to be authored separately, referenced as `docs/breach-response-runbook.md`). | GDPR Art. 33(3), 34(1); EDPB Guidelines 9/2022 v2.0 |
| GDPR Art. 35 — DPIA mandatory | A DPIA is mandatory before go-live. This service meets at least four EDPB WP248 criteria: (1) scoring / profiling (fraud scoring of cardholders); (2) automated decisions with significant effect (card blocking); (5) large-scale processing of payment card data; (9) prevents data subjects exercising rights (card freeze). Prior consultation under Art. 36 required if DPIA identifies high residual risk. Reference: `docs/dpia.md` (to be authored separately). | GDPR Art. 35; EDPB WP248 rev.01 (Oct 2017) |
| Data retention — operational stores | cards table: retain for life-of-card + 7 years (AML/CFT obligation, FATF R10); cardholders table: 7 years post-account-termination; outbox: 30 days (operational relay only); notifications log: 7 days; `idempotency_records`: 24 hours (configurable `IDEMPOTENCY_TTL_HOURS`); `audit_events`: 12 months / 3 months immediately available (PCI Req 10.5.1); `audit_attempts`: 90 days; `reconciliation_reports`: 3 years | **[ASSUMED 7-year financial records retention]** anchored to FATF R10 (CDD records kept ≥5 years), aligned with typical EU financial records law |
| GDPR Art. 5(1)(b) — cross-border transfers | Personal data must remain within the EEA or UK unless: (a) the destination country has an adequacy decision; (b) appropriate safeguards are in place (Standard Contractual Clauses, BCRs); any data sharing with the processor partner must be covered by a DPA with SCCs if the processor is outside EEA/UK; `PROCESSOR_API_BASE_URL` must resolve to an EEA/UK endpoint or the DPA must document the lawful transfer basis | GDPR Chapter V (Art. 44–49); EDPB adequacy decisions list |

---

## 4. Implementation Notes

These are guardrails for any implementer (human or AI agent). They must not be violated.

### Money

- Use Python `Decimal` (never `float` or `int`) for all monetary values. Import from `decimal` stdlib; context set to 28-digit precision, `ROUND_HALF_EVEN`.
- Store monetary amounts as `NUMERIC(18, 4)` in Postgres (4 decimal places for sub-cent precision in multi-currency scenarios) but validate user-supplied amounts to max 2 decimal places at the API layer.
- Currency codes: ISO 4217 three-letter uppercase strings (e.g. `"EUR"`, `"USD"`). Validate against an allowlist at model level. Unknown currencies → 422.

### Identifiers

- All internal primary keys: UUID v4, server-generated (`gen_random_uuid()`). Never expose sequential integers.
- Card token: the processor-issued opaque string (treat as a VARCHAR(64), never interpreted as a UUID by the issuer).
- `pan_masked`: always formatted as `XXXXXX{last4}` — first six digits replaced with `X`, space-separated groups optional.

### Timestamps

- All timestamps: ISO 8601, UTC (`+00:00`), microsecond precision. Stored as `TIMESTAMPTZ` in Postgres.
- Never use naive datetimes (no `datetime.now()` — always `datetime.now(timezone.utc)`).

### Idempotency

- All `POST` and `PATCH` endpoints require an `Idempotency-Key` header (UUID v4). Missing header → `400 IDEMPOTENCY_KEY_REQUIRED`.
- Idempotency window: 24 h. After expiry, a new attempt with the same key is treated as a new request.
- Idempotency record states: `PENDING` → `COMPLETED` or `FAILED_RETRYABLE`. Duplicate of a `PENDING` record → `409 IN_PROGRESS`.
- **Enforcement mechanism:** Starlette `BaseHTTPMiddleware` (`src/middleware/idempotency.py`), not a per-route `Depends`. The middleware runs before routing, verifies the header, and short-circuits with the cached response for `COMPLETED` duplicates — the route function is never called. Method filter: `POST` and `PATCH` only. This is a cross-cutting infrastructure concern, not a per-route opt-in.

### Error semantics

- All error responses use a single envelope: `{"error": {"code": "SNAKE_CASE_STRING", "message": "Human-readable", "request_id": "UUID", "details": [{"field": "...", "message": "..."}] | null}}`.
- HTTP status mapping: 400 validation / 401 auth / 403 permission / 404 not found / 409 conflict / 422 schema / 429 rate limit / 500 internal / 503 upstream.
- Never include stack traces, internal table names, or SQL errors in responses (`debug=False` in production).
- Validation-level `4xx` (400, 422) are **not** written to `audit_events` (they did not change state). Security-significant `4xx` (403 permission denied, 404 existence oracle on cross-user access) **are** written as security events for abuse detection (`action=ACCESS_DENIED` or `action=UNFREEZE_DENIED`). `5xx` responses are written with `action=INTERNAL_ERROR` (minimal payload, no user data).

### Audit-on-mutation invariant

- Every function that performs a state-changing DB write **must** also write to `audit_events` and `outbox` in the **same transaction**. This is non-negotiable. A helper `async def write_mutation(session, operation, audit_payload, outbox_payload)` enforces this pattern.
- `diff` field in `audit_events`: JSONB with `{before: {...}, after: {...}}` snapshots of the changed entity. **Must never contain** `pan`, `cvv`, `full_token`, or any raw secret.

### FastAPI patterns

- Use dependency injection for cross-cutting per-route concerns: `Depends(require_auth)`, `Depends(require_kyc_approved)`, `Depends(require_sca_for_limit_increase)`. Idempotency and rate limiting are middleware, not Depends (see above).
- **Auth dependency pattern — closure factories:** `require_scope(scope: str)` and `require_aal(min_level: int)` are parameterised factories that return FastAPI-compatible closures chained off `require_auth`. Example: `Depends(require_scope("cards:write"))`, `Depends(require_aal(3))`. The base `require_auth` decodes the JWT and returns the claims dict; scope and AAL closures layer on top. Defined in `src/dependencies/auth.py`.
- Pydantic v2 for all request/response models. Use `model_config = ConfigDict(str_strip_whitespace=True, frozen=True)` on input models.
- SQLAlchemy 2 async sessions. Use `async with session.begin()` to ensure explicit transaction scope.

### Service entry point

- Entry point: `src/main.py`. All middleware (idempotency, rate limiter, CORS) and exception handlers are registered inside an `@asynccontextmanager` lifespan function.
- Development: `uvicorn src.main:app --reload`. Production: `uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4`.
- Alembic migrations run as a separate job (`alembic upgrade head`) before service deployment, not at startup.

### Audit roles (DB permissions)

- `app_role` (the application's runtime DB user): `REVOKE UPDATE, DELETE ON audit_events FROM app_role` — INSERT-only; no PII update capability.
- `redactor_role` (used exclusively by the GDPR redaction job): `GRANT UPDATE (actor_id, ip_address, user_agent) ON audit_events TO redactor_role` — column-level UPDATE on the three PII columns only. PostgreSQL enforces this at the server level; any attempt by `redactor_role` to UPDATE other columns is rejected with `42501 insufficient_privilege`. The ORM must always name only these specific columns in UPDATE statements issued under `redactor_role` (never a full-model flush). Ref: PostgreSQL v17 column-level `GRANT` (`ddl-priv.html`).

### Two-table audit model

- `audit_events` (committed mutations only): written inside the main `session.begin()` transaction; immutable; INSERT-only enforced at DB level.
- `audit_attempts` (every attempt including failures): written via an **autonomous DB connection** (AUTOCOMMIT session independent of the main transaction) so the record survives a rollback. Transitions: `PENDING → COMMITTED | FAILED`. Retention: 90 days (purge via scheduled job). For any mutation that commits successfully, both tables receive a row; for failed mutations (main tx rolled back), only `audit_attempts` gets a row.
- This pattern is the regulated-FinTech industry standard; a compensating insert after rollback is avoided because the crash window between rollback and compensating insert creates a compliance gap auditors flag.

### Secrets

- All secrets (API keys, signing keys, DB passwords) come from environment variables or a secrets manager. Never hard-coded.
- `PROCESSOR_API_KEY` and `PROCESSOR_WEBHOOK_SIGNING_KEY` must never appear in logs, error responses, or audit payloads.

### JWT validation

- **Algorithm pinning:** Always pass `algorithms=["RS256", "ES256"]` explicitly to `jwt.decode()`. Never derive the algorithm from the token header itself. Never include `"none"`, `"HS256"`, or any HMAC variant in the allowlist. (RFC 8725 §3.1–3.2; OWASP JWT Cheat Sheet)
- **Issuer allowlist:** `Settings.ALLOWED_ISSUERS` is a list of exact issuer URL strings (case-sensitive, trailing-slash-sensitive). Each entry is paired with its JWKS endpoint in `Settings.ISSUER_JWKS_ENDPOINTS`. Reject any token whose `iss` claim is not in the allowlist before attempting signature verification. Minimum two issuers: one for cardholder tokens, one for ops/admin tokens.
- **Claim validation order:** (1) `iss` in ALLOWED_ISSUERS → fetch JWKS for that issuer; (2) select key by `kid` + `kty`; (3) verify signature with pinned algorithms; (4) verify `aud` matches this service name; (5) verify `exp` has not passed; (6) verify `scope` contains the required permission.
- **User identity:** Always key cardholder records on the `(iss, sub)` pair, never `sub` alone. `identity_ref` in `CardholderORM` stores the `sub` value from a single trusted issuer; if multi-issuer cardholder support is added in future, migrate to `(iss_hash, sub)`.

### Redis hardening

- `REDIS_URL` and any separate `REDIS_PASSWORD` field in `Settings` must use Pydantic `SecretStr`. The actual value is only accessed via `.get_secret_value()` at client-construction time — never logged, never in `repr()`.
- Production Redis must run with TLS (`tls-port 6380`; plain `port 6379` disabled), Redis 6+ ACL (default user disabled; two named ACL users — `app_service` scoped to `idempotency:*` and `ratelimit:*` keys; `webhook_dedup` scoped to `webhook:*` keys), and bound to a private network interface only.
- Rate-limit counters: every `INCR` must be followed by `EXPIRE {RATE_LIMIT_WINDOW_SECONDS}` on the same key. Use `INCR + EXPIRE` in a Lua script or pipeline to prevent the race where `EXPIRE` is never called after a crash between the two commands.

### Webhook replay prevention

- Every inbound webhook from the processor must pass three sequential checks before any payload processing:
  1. **Timestamp check** (CPU-only, stateless): extract `t=` from the `Stripe-Signature`-style header; reject if `abs(datetime.now(timezone.utc).timestamp() - t) > 300` seconds.
  2. **HMAC-SHA256 verification**: reconstruct the signed payload as `f"{t}.{raw_body}"` and compare against the `v1=` signature using `hmac.compare_digest`. Invalid signature → 401, do not log the raw payload.
  3. **Event-ID deduplication** (one Redis write): `SET webhook:{event_id} 1 EX 259200 NX` (72-hour TTL = `259200` s). A `None` return (key existed) → 200 no-op. This closes the within-window replay gap and handles at-least-once processor retries.
- Only proceed to business logic if all three checks pass.

### GDPR erasure propagation

When the GDPR redaction job (Task 5.5) processes an erasure request for a cardholder, it must propagate redaction beyond `audit_events` to all secondary stores:

| Store | Action |
|---|---|
| `outbox` rows (status=PENDING) | Overwrite PII fields in `payload` JSONB (set `cardholder_id` to NULL or anonymised value) before the event is published to Kafka |
| `outbox` rows (status=PUBLISHED) | Leave structural record; PII already emitted to Kafka — follow Kafka propagation steps below |
| Kafka topics | Crypto-shredding preferred: PII fields in messages were encrypted with a per-cardholder DEK; destroy the cardholder's DEK to render published events permanently undecipherable. If crypto-shredding not implemented: write a tombstone event with `{cardholder_id: null}` to each compacted topic keyed by cardholder; confirm log compaction has run before marking erasure complete |
| Structured log archives (S3/GCS) | Preferred: logs emit PII fields encrypted with per-cardholder DEK (destroy DEK on erasure). Fallback: if log archives have ≤ 30-day lifecycle policy and the erasure deadline is 30 days, document the residual window in the erasure record and consider it acceptable — confirmed with DPO |
| `idempotency_records` (Redis) | Call `DEL` on all Redis keys matching prefix `idempotency:{cardholder_id}:*`; short TTL means residual exposure window is ≤ 24 h even if DEL is not called, but explicit DEL is required for immediate erasure compliance |
| `idempotency_records` (Postgres) | Set `cardholder_id`-bearing payload fields to NULL for rows belonging to this cardholder |

The redaction job must write a final `GDPR_ERASURE_PROPAGATION_COMPLETED` audit event listing all stores touched and the action taken per store.

### Scope inventory

All JWT scopes used in this service. Each closure factory (`require_scope(…)`) must validate against this list; unrecognised scopes raise `ValueError` at startup.

| Scope | Permitted actor type | Minimum AAL | Purpose |
|---|---|---|---|
| `cards:read` | Cardholder | AAL2 | List and view own cards and transactions |
| `cards:write` | Cardholder | AAL2 | Issue card, freeze/unfreeze, set limits, create reveal handle |
| `audit:read` | Ops / compliance | AAL3 | Read `audit_events`; regulator export |
| `ops:reconcile` | Service account | AAL2 | Run daily reconciliation job |
| `ops:admin` | Ops (elevated) | AAL3 | GDPR redaction, cardholder suspension, force-cancel card |
| `fraud:freeze` | Fraud analyst / FRAUD_ENGINE | AAL2 | Apply fraud-lock freeze to any card |

### SSRF guard

`PROCESSOR_API_BASE_URL` is a config-driven value and must not be trusted unchecked. Two-layer defence:

1. **Startup validation (Pydantic `@field_validator`):** Verify scheme is `https`, port is 443 (implicit or explicit), and the hostname is an exact case-sensitive match against `Settings.SSRF_ALLOWED_PROCESSOR_HOSTNAMES` (comma-separated list of approved processor FQDNs). Reject at startup if validation fails.
2. **Request-time DNS rebind protection:** Use an SSRF-safe httpx transport (e.g. `drawbridge` or `httpx-secure`) for all outbound calls to the processor. The transport must: resolve DNS once, reject any A/AAAA record in RFC-1918 / loopback (`127/8`) / link-local (`169.254/16`) / cloud-metadata (`169.254.169.254`) ranges, pin the TCP connection to the validated IP, and re-validate on every redirect hop. Startup hostname allowlisting alone does not satisfy this requirement (DNS rebinding bypass).

---

## 5. Context

### 5.1 Beginning Context

**Runtime:**  Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, PostgreSQL 15, Kafka (or AWS SNS+SQS).

**What exists:**

| Service | Role | Contract surface |
|---|---|---|
| Identity service | Authenticates users; issues JWTs; serves SCA challenges | `POST /sessions` → `{access_token: JWT, expires_in: int}`; JWT claims: `sub` (cardholder UUID), `aud` (service name), `scope` (space-delimited), `aal` (1/2/3), `exp`; `POST /sca/challenges` → `{challenge_id: UUID, method: "OTP"\|"TOTP"\|"WEBAUTHN", expires_at: ISO-8601}`; `POST /sca/verify` → `{verified: bool, aal_achieved: int}` |
| KYC / onboarding service | Holds cardholder verification status | `GET /cardholders/{cardholder_id}/kyc` → `{status: "APPROVED"\|"PENDING"\|"FAILED"\|"EXPIRED", last_verified_at: ISO-8601}` |
| Processor partner | Holds PAN vault; issues virtual cards; accepts freeze/unfreeze; pushes authorization events via async HTTP webhook | `POST /v1/cards` (body: `{cardholder_external_ref, currency}`, header: `Idempotency-Key`) → `{token, last4, exp_month, exp_year}`; on timeout, retry identical `POST` with same `Idempotency-Key` — processor returns cached `201` if card was created (no `GET`-by-key endpoint); `cardholder_external_ref` = `Cardholder.identity_ref` (the subject UUID from the identity service); `POST /v1/cards/{token}:freeze` → `{status: "FROZEN"}`; `POST /v1/cards/{token}:unfreeze` → `{status: "ACTIVE"}`; Async webhook `POST /webhooks/processor` (processor → issuer, HMAC-SHA256 signed via `Stripe-Signature`-style header): `{processor_authorization_id, card_token, amount, currency, mcc, merchant_name, authorized_at, decision: "APPROVED"\|"DECLINED"}`; **real-time synchronous authorization decisioning (JIT/ASA) is out of scope** — processor uses its own fallback rules |
| Fraud-rules engine | Risk-scores card actions | `POST /v1/score` (body: `{card_token, event_type, context: {}}`) → `{score: 0–100, decision: "ALLOW"\|"REVIEW"\|"BLOCK", reasons: string[]}` ; also emits `force_freeze.requested` Kafka events: `{event_id: UUID, card_token, reason, actor_id: "FRAUD_ENGINE"}` |
| Notification service | Delivers user-facing events (email, push) | `POST /notify` (body: `{cardholder_id, template_id, params: {}}`, header: `Idempotency-Key`) → `{delivery_id: UUID}`; fire-and-forget; always idempotent |
| Audit / regulator-export job | Internal — defined by this spec | Reads `audit_events` and `outbox` stream; produces export bundles; see Task 5.4 |

**PCI CDE scope boundary:**

| Component | CDE status | Rationale |
|---|---|---|
| Reveal-proxy path (`GET /cards/{token}/reveal/{handle_id}`) | **IN CDE** — fully in scope | Transiently touches raw PAN and CVV proxied from the processor; must meet all PCI DSS v4.0 controls including Req 3.5/3.6 encryption and Req 10 logging |
| Virtual card service (all other routes) | **Connected-to / security-impacting** | Connects to the reveal proxy and can affect CDE configuration; subject to full PCI DSS requirements per PCI SSC Scoping & Segmentation Guidance; may be reduced to "out of CDE" only if QSA-validated segmentation is in place |
| Issuer DB (`cards`, `cardholders`, `audit_events` etc.) | **Out of CDE** (token-only, no PAN) | Stores processor-issued tokens and `last4` only; no PAN at rest; eligible for out-of-scope status subject to QSA-validated network segmentation. A QSA will verify via data-discovery scan. |
| Redis (idempotency, rate-limit counters) | **Connected-to** | No CHD; connected to the app tier; subject to PCI Req 4 (TLS) and Req 8 (ACL/auth) |
| Kafka | **Connected-to** | Carries tokenised event payloads; no raw PAN; subject to encryption in transit |
| Processor partner (PAN vault) | **In CDE — third-party** | Covered by processor's own AoC (Attestation of Compliance); managed under Req 12.8 TPSP oversight |

QSA scope validation and annual Req 12.5.2 inventory update are the operator's responsibility.

**What does NOT exist yet:**

- The virtual-card service (FastAPI application, DB schema, workers) — all to be built.
- `cardholders`, `cards`, `spending_limits`, `transactions`, `idempotency_records`, `reveal_handles`, `audit_events`, `audit_attempts`, `outbox`, `reconciliation_reports` tables — all absent.
- Kafka topics: `card.issued`, `card.state_changed`, `card.limit_changed`, `authorization.created`, `force_freeze.requested` — need creating.
- Redis instance for idempotency cache and rate-limiter sliding window counters — absent.
- CI pipeline and test fixtures — absent.

### 5.2 Ending Context

After the implementation is complete, the following artifacts exist:

**Application:**
- Running FastAPI service with all endpoints in §7, entry point `src/main.py`.
- Alembic-managed Postgres schema (all tables, indices, constraints, INSERT-only guard on `audit_events`, column-level `GRANT` for `redactor_role`).
- Outbox publisher worker, fraud-freeze consumer, and notification consumer running as separate processes.
- Regulator-export job, GDPR-redaction job, and daily reconciliation CLI as CLI commands.
- Rate limiter middleware (Redis-backed) and idempotency middleware active on all `POST`/`PATCH` routes.

**Application — additional components (from audit pass):**
- `src/http/ssrf_transport.py` — custom httpx transport with SSRF/DNS-rebind protection (Task 6.5); used by all processor HTTP calls.
- `src/routes/privacy.py` — `GET /cardholders/{cardholder_token}/data-export` endpoint (Task 7.1); `DataExportResponse`, `ErasureRefusalResponse` Pydantic models.
- `RevealHandleORM` includes `version` column for optimistic-lock double-redemption prevention.
- `Settings` carries: `ALLOWED_ALGORITHMS: list[str]`, `ALLOWED_ISSUERS: list[str]`, `ISSUER_JWKS_ENDPOINTS: dict[str, str]`, `SSRF_ALLOWED_PROCESSOR_HOSTNAMES: list[str]`, `RATE_LIMIT_WINDOW_SECONDS: int`, `REDIS_URL: SecretStr`, `GDPR_DSR_SLA_DAYS: int`.
- Scope inventory in use: `cards:read` (AAL2), `cards:write` (AAL2), `audit:read` (AAL3), `ops:reconcile` (AAL2), `ops:admin` (AAL3), `fraud:freeze` (AAL2).
- Kafka events emitted: `card.issued`, `card.state_changed`, `card.limit_changed`, `authorization.created`, `force_freeze.requested`, `GDPR_ERASURE_PROPAGATION_COMPLETED`.

**Documentation (this homework):**
- `homework-3/specification.md` (this file)
- `homework-3/agents.md`
- `homework-3/README.md`
- `homework-3/HOWTORUN.md`
- `homework-3/.claude/CLAUDE.md`
- `homework-3/.cursor/rules/{general,security,fintech,testing}.mdc`

**Test artifacts:**
- `tests/` directory with unit, integration, contract, e2e, and security test modules.
- `docs/test-strategy.md` — test-category matrix, fixture catalogue, security grep harness (Task X.4).
- `docs/load-test-plan.md` — workload model, SLO targets, k6 ramp profile, freeze-latency probe (Task 6.2).

---

## 6. Edge Cases

### 6.1 Summary by Category

| Category | Case count | MLOs touched |
|---|---|---|
| Idempotency | 3 | MLO-1, MLO-3 |
| Concurrency | 4 | MLO-2, MLO-3 |
| Permission boundary | 4 | MLO-1, MLO-2, MLO-4, MLO-5 |
| External failure | 5 | MLO-1, MLO-2, MLO-3 |
| Stale data | 3 | MLO-4, MLO-5 |
| Fraud pattern | 3 | MLO-1, MLO-3, MLO-5 |
| Partial failure | 2 | MLO-1, MLO-5 |
| Empty state | 2 | MLO-4 |
| Invalid input | 3 | MLO-1, MLO-3 |
| **Total** | **29** | |

---

### 6.2 Detail by Flow

#### MLO-1 — Issue card

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E1-1 | Idempotency | `POST /cards` retried after 504 with same `Idempotency-Key` | Returns original card resource (200, not 201); no duplicate card created | Single `audit_events` row for one logical card creation |
| E1-2 | External failure | Processor `POST /v1/cards` returns 503 | No local `cards` row written; idempotency record marked `FAILED_RETRYABLE`; caller receives 503 with `retry-after` header | No orphaned state; `outbox` row not written |
| E1-3 | Permission | Cardholder with `kyc_status = PENDING` attempts issuance | `403 CARDHOLDER_NOT_VERIFIED`; KYC gate rejects before processor call | Denied-access `audit_events` row written |
| E1-4 | External failure | Processor creates card but HTTP client times out reading response | Re-issue the **identical** `POST /v1/cards` with the same `Idempotency-Key`; processor returns cached `201` if card was created; adopt the returned `{token, last4, exp_month, exp_year}`; if retry also fails (non-2xx), treat as E1-2 (no `GET`-by-idempotency-key endpoint exists at any major processor) | Single card adopted; no ghost cards |
| E1-5 | Partial failure | Processor card created; local DB transaction rolls back (e.g. DB connection lost after processor call) | Reconciliation job (MLO-5) detects orphaned processor card via daily audit and cancels it | Divergence logged in reconciliation job run; no local card row visible to cardholder |
| E1-6 | Invalid input | `amount` field in request with > 2 decimal places | `422 Unprocessable Entity` (Pydantic validation); no downstream call | Not audited (no state change reached) |
| E1-7 | Idempotency | Reveal-handle endpoint (`GET /cards/{token}/reveal/{handle_id}`) retried within TTL after a 504 gateway timeout | Idempotency middleware caches the first successful reveal response keyed on `Idempotency-Key`; second call returns cached response without re-querying processor; PAN/CVV returned only once | Single `audit_events` row for the reveal; no duplicate processor call; handle status remains `used=True` after first redemption |
| E1-8 | Fraud pattern | ≥ 5 failed reveal-handle redemption attempts for the same card within 5 minutes (e.g. replaying an expired handle, racing with used handle) | Rate limiter fires `429 RATE_LIMIT_EXCEEDED` on the 6th attempt; `reveal_abuse_attempts_total` Prometheus counter incremented; ops alert if counter > threshold per hour | Each attempt logged in `audit_attempts` with `action=REVEAL_FAILED`; pattern surfaced in fraud-engine review queue |

---

#### MLO-2 — Freeze / unfreeze

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E2-1 | Concurrency | Cardholder `PATCH status=FROZEN` races with fraud analyst `force_freeze.requested` event | `SELECT FOR UPDATE` on `cards` row serialises concurrent access; last writer wins; final state is `FROZEN`; both `audit_events` rows persisted with distinct `actor_id` and ordered `occurred_at` | Both actor intents fully recorded; final state is deterministic |
| E2-2 | Permission | Cardholder attempts to unfreeze a card with `fraud_lock = true` | `403 FREEZE_LOCKED_BY_FRAUD`; cardholder cannot unfreeze; must contact ops/support | `audit_events` row: `action=UNFREEZE_DENIED`, `reason=FRAUD_LOCK` |
| E2-3 | External failure | Processor `:freeze` endpoint returns 503 | Whole transaction rolls back (card stays in original state — consistent between issuer DB and processor); `audit_attempts` row persisted via autonomous DB connection with `action=FREEZE_FAILED, reason=PROCESSOR_ERROR` (no `audit_events` row — that was part of the rolled-back tx); caller receives 503 | Failed attempt recorded in `audit_attempts`; `audit_events` stays clean; two-table audit model preserves both correctness and traceability |
| E2-4 | Concurrency | Two concurrent `PATCH status=FROZEN` from the same cardholder (duplicate tab submission) | `SELECT FOR UPDATE` blocks second request until first commits; second sees `status` already `FROZEN` — no-op transition; `audit_events` row still written with `status_changed=false` | Both requests tracked; duplicate freeze is idempotent at the state level |

---

#### MLO-3 — Set limits

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E3-1 | Concurrency | Cardholder and ops both submit limit changes simultaneously | `SELECT FOR UPDATE` on `spending_limits` row for the affected `LimitType`; last write wins; both recorded in `audit_events` | Both actor intents recorded with timestamps |
| E3-2 | Idempotency | Limit-increase retried after SCA completed but response was lost (504) | `Idempotency-Key` deduplicates; original result returned without re-issuing SCA challenge | Single `audit_events` row; no double SCA |
| E3-3 | Fraud pattern | Cardholder submits ≥ 3 limit-increase requests within 24 h, each increasing amount by > 10× | Fraud engine scores as `BLOCK`; `403 FRAUD_RISK_LIMIT_INCREASE`; limit not changed | Fraud decision recorded in `audit_events.diff` |
| E3-4 | Invalid input | `daily_limit` set lower than current `per_txn_limit` | `422` with field `daily_limit` detail; no DB change | Not audited |
| E3-5 | External failure | SCA service unavailable during limit-increase flow | `503 SCA_SERVICE_UNAVAILABLE`; limit not changed; any in-progress SCA challenge invalidated (fail-closed) | `audit_events`: `action=LIMIT_CHANGE_FAILED, reason=SCA_UNAVAILABLE` |
| E3-6 | Invalid input | `PATCH /cards/{token}/limits` body contains a currency code not in ISO 4217 allowlist (e.g. `"currency": "ZZZ"`) | `422 INVALID_CURRENCY` with field detail; no DB change; no SCA challenge issued | Not audited (Pydantic validation rejects before DB layer) |

---

#### MLO-4 — View transactions

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E4-1 | Permission | `GET /cards/{other_user_card_id}/transactions` | `404` — no existence oracle (prevents enumeration attacks) | Deny event logged as `action=ACCESS_DENIED` for abuse detection |
| E4-2 | Stale data | Transaction list requested during processor reconciliation lag | Response includes `data_freshness_at` (timestamp of last settlement sync); pending authorizations carry `status=AUTHORIZED_PENDING_SETTLEMENT` | Reconciliation job flags discrepancies > 15 min |
| E4-3 | Empty state | Cardholder has no cards | `GET /cards` returns `{"items": [], "total": 0}` (200, not 404) | No audit event; read-only |
| E4-4 | Empty state | Card exists but has no transactions | `GET /cards/{id}/transactions` returns `{"items": [], "total": 0, "next_cursor": null}` | Same |
| E4-5 | Stale data | Authorization webhook arrives with `decision=DECLINED` for a card that was subsequently frozen between the authorization attempt and webhook delivery | Webhook consumer records the transaction with the `decision` value from the event payload and the `status` at processing time; reconciliation job detects the ordering anomaly if settlement timestamp predates the freeze timestamp | `audit_events` row for webhook ingestion includes `card_status_at_delivery`; no retroactive status mutation |

---

#### MLO-5 — Audit and replay

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E5-1 | Partial failure | Outbox publisher crashes after Kafka `produce()` but before DB `PUBLISHED` mark | At-least-once delivery: event re-emitted on next run; consumer must deduplicate by `event_id` | No double-counting in regulator export; idempotency on consumer is mandatory |
| E5-2 | Permission | App DB role attempts `UPDATE audit_events SET actor_id = 'X'` | PostgreSQL `REVOKE UPDATE, DELETE ON audit_events FROM app_role`; attempt raises `42501 insufficient_privilege` | Tamper attempt logged via Postgres `pgaudit` extension (if enabled) |
| E5-3 | Stale data | Regulator-export job reads during a long-running write transaction | Job uses `REPEATABLE READ` (snapshot) isolation; no dirty reads; export reflects only committed state | Regulator artifact is point-in-time consistent |
| E5-4 | Fraud pattern | Audit-log ingestion lag exceeds 15 min (outbox publisher down) | `outbox_lag_seconds` Prometheus metric fires alert; reconciliation job cross-references operational row count vs audit event count | Gap flagged for investigation; alert includes time window and row-count delta |

---

#### MLO-6 — SLOs

| ID | Category | Trigger | Expected behaviour | Audit / compliance note |
|---|---|---|---|---|
| E6-1 | External failure | Processor API degraded (all write calls return 503) | `GET` endpoints (`/cards`, `/cards/{token}/transactions`, `/audit/events`) return normally — no processor dependency on reads. Write endpoints (`POST /cards`, `PATCH /cards/{token}/status`, `PATCH /cards/{token}/limits`) return `HTTP 503` with body `{"error": {"code": "PROCESSOR_DEGRADED", "message": "Card processor unavailable — try again shortly", "request_id": "<uuid>", "details": null}}` and header `Retry-After: 30`. Exception: the freeze **local-state write** (`audit_events` + `cards.status`) commits successfully even if the processor 5xx; the inconsistency is resolved on next processor recovery via reconciliation. | Structured log: `level=ERROR, event=processor_degraded, processor_http_status=503, endpoint=<path>, duration_ms=<int>, request_id=<uuid>`; `processor_error_total` Prometheus counter incremented; alert rule `ProcessorDegradedFor5Min` fires if counter rate > 0 for 5 min |
| E6-2 | Concurrency | Load spike > 2× normal at end-of-month billing cycle | Rate-limiter middleware fires before the route function. Write requests (11th `POST`/`PATCH` within 60 s for the same cardholder): `HTTP 429`, body `{"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests", "request_id": "<uuid>", "details": null}}`, header `Retry-After: <remaining_window_seconds>`. Read requests (61st `GET` within 60 s): same shape with `Retry-After`. The freeze endpoint (`PATCH …/status`) uses the write limit (10/min) but its Redis counter key is separate from other write endpoints (`sha256(cardholder_id + '/status')`) — a cardholder who hits the limit on card issue can still freeze. | Structured log per rate-limit decision: `level=DEBUG, event=rate_limit_exceeded, cardholder_id_partial="A***Z", endpoint_path=<path>, window_remaining_ms=<int>`; `rate_limit_exceeded_total{endpoint, method}` Prometheus counter incremented |

---

## 7. Low-Level Tasks

> Format per task: **Prompt** (what to ask an AI implementer) / **File** / **Class or function** / **Details** / **Definition of Done** (DoD) where stated.

---

### Foundation — Shared models

#### Task 0.1 — Define Cardholder model and migration

**Prompt:** Create the Pydantic v2 models, SQLAlchemy 2 ORM model, and Alembic migration for the `Cardholder` entity. This is the first migration — all other tables FK into it.

**File:** `src/models/cardholder.py`, `alembic/versions/000_create_cardholders.py`

**Class / function:** `CardholderStatus`, `CardholderCreate`, `CardholderRead`, `CardholderORM`

**Details:**
- `CardholderStatus` enum: `ACTIVE | SUSPENDED | CLOSED`
- `CardholderORM` columns: `id` (UUID PK, `gen_random_uuid()`), `identity_ref` (VARCHAR 255, UNIQUE NOT NULL — the `sub` claim from the identity service JWT; used to look up the cardholder on every authenticated request), `status` (VARCHAR 20, DEFAULT `'ACTIVE'`), `name` (VARCHAR 255, nullable — GDPR-redactable PII), `email` (VARCHAR 255, nullable — GDPR-redactable PII), `redacted_at` (TIMESTAMPTZ nullable — set by GDPR redaction job), `created_at`, `updated_at` (both TIMESTAMPTZ)
- `CardholderRead` must not expose `redacted_at` to the cardholder role (ops only)
- `identity_ref` is the bridge between the JWT (`sub` claim) and the issuer's internal cardholder record; no FK to the identity service — the `sub` is trusted from the JWT signature

**DoD:** Migration creates table with `UNIQUE (identity_ref)` constraint; `CardholderORM` has no column named `ssn`, `pan`, or `cvv`; `CardholderStatus.SUSPENDED` is a valid enum member.

---

### MLO-1 — Issue card

#### Task 1.1 — Define Card data models

**Prompt:** Create the Pydantic v2 input/output models and SQLAlchemy 2 ORM model for the `Card` entity.

**File:** `src/models/card.py`

**Class / function:** `CardStatus`, `CardBase`, `CardCreate`, `CardRead`, `CardORM`

**Details:**
- `CardStatus` enum: `ACTIVE | FROZEN | CANCELLED`
- `CardORM` columns: `token` (VARCHAR 64, PK — processor-issued), `cardholder_id` (UUID, FK → `cardholders.id` ON DELETE RESTRICT), `last4` (CHAR 4), `pan_masked` (VARCHAR 20, format `XXXXXX{last4}`), `exp_month` (SMALLINT), `exp_year` (SMALLINT), `currency` (CHAR 3), `status` (VARCHAR 20), `fraud_lock` (BOOLEAN DEFAULT FALSE), `status_changed_at` (TIMESTAMPTZ nullable — updated on every status transition), `created_at` / `updated_at` (TIMESTAMPTZ)
- **No `cvv`, `pan`, or `full_token` column may exist** [PCI DSS v4.0 Req 3.3]
- All monetary fields use `Decimal`; `pan_masked` is write-once (never updated)
- `CardRead` must not expose `fraud_lock` to the cardholder role (ops/compliance only)

**DoD:** `CardORM.__table__.columns` contains no column named `cvv`, `pan`, or `full_pan`; `CardStatus.FROZEN` is a valid enum member; Pydantic `CardRead` schema validated against the JSON Shape `{token, last4, pan_masked, status, exp_month, exp_year, currency, created_at}`.

---

#### Task 1.2 — Implement idempotency middleware

**Prompt:** Create a FastAPI middleware that checks the `Idempotency-Key` header, looks up an `idempotency_records` table, and returns the cached response on duplicate; create the `idempotency_records` ORM model and Alembic migration.

**File:** `src/middleware/idempotency.py`, `src/models/idempotency_record.py`

**Class / function:** `IdempotencyMiddleware`, `IdempotencyRecordORM`

**Details:**
- Header: `Idempotency-Key` (UUID v4); missing → `400 IDEMPOTENCY_KEY_REQUIRED`
- `idempotency_records` columns: `key` (UUID PK), `status` (PENDING|COMPLETED|FAILED_RETRYABLE), `response_status_code` (INT), `response_body` (JSONB), `created_at`, `expires_at` (created_at + 24 h)
- On duplicate `COMPLETED`: return `response_body` + `response_status_code` without executing handler
- On duplicate `PENDING`: `409 IN_PROGRESS`
- On duplicate `FAILED_RETRYABLE`: allow new execution
- Applied on `POST` and `PATCH` only; ignored on `GET`/`DELETE`
- Edge cases: E1-1, E3-2

**DoD:** Integration test: two `POST /cards` requests with the same `Idempotency-Key` produce exactly one `cards` row and one `audit_events` row.

---

#### Task 1.3 — Implement KYC gate dependency

**Prompt:** Create a FastAPI `Depends`-compatible function that rejects requests for cardholders with non-APPROVED KYC status; fail-closed on KYC service unavailability.

**File:** `src/dependencies/kyc_gate.py`

**Class / function:** `require_kyc_approved`

**Details:**
- Calls `GET {KYC_SERVICE_URL}/cardholders/{cardholder_id}/kyc`; HTTP timeout 2 s
- `status != APPROVED` → `403 CARDHOLDER_NOT_VERIFIED`
- KYC service timeout / 5xx → `503 KYC_SERVICE_UNAVAILABLE` (fail-closed)
- Cache TTL: 60 s per `cardholder_id` (in-process, invalidated on service restart)
- Edge case: E1-3

**DoD:** Mock test: KYC returns `PENDING` → caller gets `403`; KYC returns 5xx → caller gets `503`, not `500`.

---

#### Task 1.4 — Implement `POST /cards` (issue card)

**Prompt:** Implement the card-issuance endpoint combining auth, KYC gate, idempotency guard, processor integration, and transactional audit write.

**File:** `src/routes/cards.py`

**Class / function:** `issue_card`

**Details:**
- Dependencies in order: `require_auth(scope="cards:write")`, `require_kyc_approved`, `idempotency_guard`
- Call processor `POST /v1/cards`; on 2xx, inside `async with session.begin()`: insert `CardORM`, insert `audit_events` (`action=CARD_ISSUED`, `diff={after: card_snapshot}`), insert `outbox` (`event_type=card.issued`)
- On processor 5xx: do not enter the transaction; mark idempotency record `FAILED_RETRYABLE`; return 503
- Response: `CardRead` with `201 Created`
- Edge cases: E1-1 through E1-5

**DoD:** Processor 503 → no `cards` row exists; all three writes (`cards`, `audit_events`, `outbox`) succeed atomically or all roll back; audit event `diff` contains no PAN/CVV.

---

#### Task 1.5 — Implement reveal handle + `GET /cards/{token}/reveal`

**Prompt:** Implement a two-step PAN/CVV reveal flow: issue a single-use time-bound handle, then proxy PAN/CVV from the processor on handle redemption — never storing sensitive data.

**File:** `src/routes/cards.py`, `src/models/reveal_handle.py`

**Class / function:** `create_reveal_handle`, `redeem_reveal_handle`, `RevealHandleORM`

**Details:**
- `POST /cards/{token}/reveal-handle`: generates a random UUID `handle_id`; stores **`SHA-256(handle_id)`** as the lookup key in Redis (TTL = `REVEAL_HANDLE_TTL_SECONDS`); the raw `handle_id` is given to the caller **and never persisted anywhere**. Also creates `RevealHandleORM` row (`id` = `SHA-256(handle_id)` stored as hex, `card_token`, `used=False`, `version=0`, `expires_at=now()+60s`); returns `{handle_id, expires_at}` to caller.
- `GET /cards/{token}/reveal/{handle_id}`: hash the caller-supplied `handle_id` to `SHA-256(handle_id)`, look up the `RevealHandleORM` row. Check `used=False` and `expires_at > now()`. To prevent double-redemption under concurrent requests, use **optimistic locking**: issue `UPDATE reveal_handles SET used=True, version=version+1 WHERE id=<hash> AND used=False AND version=<current_version>` — if `rows_affected == 0`, another request already redeemed it; return `410 Gone`. On successful update, proxy `GET {PROCESSOR}/v1/cards/{token}/sensitive` in the same request and return PAN+CVV directly to caller **without persisting**. If handle hash not found, or handle used/expired → `410 Gone`.
- PAN and CVV **must not appear** in any log line or `audit_events.diff` [PCI DSS v4.0 Req 3.3]
- `audit_events` row: `action=CARD_REVEALED`, payload contains only `card_token` and `actor_id`
- `RevealHandleORM` columns: `id` (VARCHAR 64 PK — hex of SHA-256(handle_id)), `card_token`, `used` (BOOLEAN DEFAULT FALSE), `version` (SMALLINT DEFAULT 0), `expires_at` (TIMESTAMPTZ)

**DoD:** Two concurrent `GET /reveal/{handle_id}` calls — exactly one succeeds, other returns `410` (optimistic lock test); grep on application logs for a 10-digit numeric string returns no matches after a reveal; no `cvv` or `pan` key in any `audit_events.diff` for a `CARD_REVEALED` event; raw `handle_id` never present in any DB column (only its SHA-256 hash).

---

#### Task 1.6 — Implement `GET /cards` (list cardholder's own cards)

**Prompt:** Implement the card-list endpoint for an authenticated cardholder. Must return only cards belonging to the authenticated cardholder; cross-cardholder access returns an empty list, not a 403.

**File:** `src/routes/cards.py`

**Class / function:** `list_cards`

**Details:**
- Auth: `require_scope("cards:read")`; `cardholder_id` resolved from JWT `sub` → `cardholders.identity_ref` lookup
- Query: `SELECT … WHERE cardholder_id = <resolved_id>` — never cross-user
- Response: `{"items": CardRead[], "total": int}` — 200 even when empty (E4-3)
- No `pan` or `cvv` field in any `CardRead` item
- Edge case: E4-3 (empty list returns `{"items": [], "total": 0}`, not 404)

**DoD:** Cardholder A's JWT returns only cardholder A's cards; response contains no `pan` or `cvv` key; empty cardholder returns `{"items": [], "total": 0}` with HTTP 200.

---

### MLO-2 — Freeze / unfreeze

#### Task 2.1 — Define card state machine

**Prompt:** Implement a deterministic state-machine module for `CardStatus` transitions, raising on invalid transitions and enforcing fraud-lock semantics.

**File:** `src/domain/card_state.py`

**Class / function:** `CardStateMachine`, `InvalidCardStateTransition`, `FraudLockActive`

**Details:**
- Valid transitions: `ACTIVE → FROZEN` (cardholder or fraud analyst), `FROZEN → ACTIVE` (cardholder only if `fraud_lock=False`), `ACTIVE|FROZEN → CANCELLED` (ops role only)
- `FROZEN → ACTIVE` when `fraud_lock=True` → raise `FraudLockActive` (edge case E2-2)
- All other transitions raise `InvalidCardStateTransition(current, target)`
- Pure functions — no I/O

**DoD:** Unit test matrix: all valid transitions succeed; all invalid transitions raise; `FROZEN→ACTIVE` with `fraud_lock=True` raises `FraudLockActive`.

---

#### Task 2.2 — Implement `PATCH /cards/{token}/status` (freeze / unfreeze)

**Prompt:** Implement the status-change endpoint using `SELECT FOR UPDATE`, state-machine enforcement, processor propagation, and transactional audit write.

**File:** `src/routes/cards.py`

**Class / function:** `update_card_status`

**Details:**
- Auth: cardholder (`scope=cards:write`) or fraud analyst (`scope=fraud:freeze`)
- `SELECT … FOR UPDATE` on `CardORM` row (prevents concurrent state corruption — E2-1, E2-4)
- Call `CardStateMachine.transition`; on success, call processor `:freeze` or `:unfreeze`
- On processor 5xx: roll back entire transaction (card stays in original state) — E2-3
- Inside transaction: update `CardORM.status`, write `audit_events` (`action=CARD_FROZEN|CARD_UNFROZEN`, `actor_id` from JWT), write `outbox` (`event_type=card.state_changed`)
- Propagation SLO target: ≤ 2 s p99 from request accepted to processor acknowledgement [ASSUMED — see §3]

**DoD:** Concurrent test (two goroutines or asyncio tasks): both succeed; exactly one `audit_events` row per actor; final `status=FROZEN`; no duplicate state-change outbox events with the same `event_id`.

---

#### Task 2.3 — Implement fraud force-freeze consumer

**Prompt:** Implement an idempotent Kafka consumer for `force_freeze.requested` events that applies a fraud-locked freeze to the target card.

**File:** `src/workers/fraud_freeze_consumer.py`

**Class / function:** `FraudFreezeConsumer`, `FraudFreezeConsumer.handle`

**Details:**
- Consume `force_freeze.requested` topic; deserialise `{event_id, card_token, reason, actor_id}`
- Idempotent by `event_id`: check `audit_events` for prior `CARD_FRAUD_FROZEN` with matching `correlation_id=event_id`; skip if found
- Call internal freeze service with `actor=FRAUD_ENGINE, fraud_lock=True`
- Write `audit_events` (`action=CARD_FRAUD_FROZEN, actor_type=FRAUD_ENGINE, actor_id=event.actor_id, diff={reason}`)
- On transient DB error: retry with exponential backoff (max 5 attempts); on persistent failure: send to dead-letter queue

**DoD:** Redelivered event (same `event_id`) produces exactly one `audit_events` row; card has `fraud_lock=True` after processing; DLQ receives message after 5 failed retries.

---

### MLO-3 — Set limits

#### Task 3.1 — Define spending limit models

**Prompt:** Create Pydantic v2 and SQLAlchemy 2 models for per-card spending limits with cross-field validation.

**File:** `src/models/limit.py`

**Class / function:** `LimitType`, `SpendingLimitBase`, `SpendingLimitCreate`, `SpendingLimitRead`, `SpendingLimitORM`

**Details:**
- `LimitType` enum: `PER_TXN | DAILY | MONTHLY | PER_MCC`
- `SpendingLimitORM` columns: `id` (UUID PK), `card_token` (FK), `limit_type`, `amount` (`NUMERIC(18,4)`), `currency` (CHAR 3), `mcc` (CHAR 4, nullable — only for `PER_MCC`), `created_at`, `updated_at`
- Cross-field constraint: `daily_limit >= per_txn_limit`; `monthly_limit >= daily_limit` — enforced at **two layers**: (1) Pydantic `model_validator(mode='after')` at the API boundary (fast, user-friendly rejection); (2) an `AFTER INSERT OR UPDATE` Postgres trigger that re-reads all sibling rows for the same `(card_token, currency)` using `SELECT … FOR UPDATE` and raises `EXCEPTION` if the ordering is violated — this backstop prevents races and protects against direct DB writes that bypass the API layer. A single `CHECK` constraint cannot enforce cross-row invariants.
- `mcc` must be a 4-digit string `"0000"–"9999"` when `limit_type=PER_MCC`

**DoD:** Pydantic validator rejects `{daily_limit: 50, per_txn_limit: 100}`; migration creates an AFTER trigger (`check_limit_ordering`) that raises on violation; concurrent test (two asyncio tasks setting conflicting limits simultaneously) confirms exactly one succeeds and one receives a 409.

---

#### Task 3.2 — Implement SCA challenge dependency

**Prompt:** Create a FastAPI dependency that detects limit-increase operations and requires a verified SCA token; fail-closed on SCA service failure.

**File:** `src/dependencies/sca_gate.py`

**Class / function:** `require_sca_for_limit_increase`, `SCAContext`

**Details:**
- Detects if any supplied limit is higher than the current stored value for that `LimitType`
- If increase detected and `X-SCA-Token` header absent → `401 SCA_REQUIRED` with body `{challenge_endpoint: "/sca/challenges"}`
- If `X-SCA-Token` present → call `POST {IDENTITY_URL}/sca/verify` with token; require `aal_achieved >= 2` [NIST SP 800-63B AAL2]
- SCA service 5xx → `503 SCA_SERVICE_UNAVAILABLE` (fail-closed — never allow limit increase when SCA is unavailable)
- Limit decreases: bypass SCA entirely
- Applied per risk-based interpretation of PSD2 Art. 97(1)(c) — labelled as industry practice, not black-letter mandate
- Edge cases: E3-2, E3-5

**DoD:** Limit increase without `X-SCA-Token` → 401; with valid SCA token `aal=2` → proceeds; SCA service returns 500 → 503, not 500; limit decrease proceeds without header.

---

#### Task 3.3 — Implement `PATCH /cards/{token}/limits` (set limits)

**Prompt:** Implement the limit-setting endpoint with fraud scoring, SCA gate, idempotency, and transactional audit.

**File:** `src/routes/limits.py`

**Class / function:** `update_card_limits`

**Details:**
- Dependencies: `require_auth(scope="cards:write")`, `require_sca_for_limit_increase`; idempotency enforced by middleware
- Call fraud engine `POST /v1/score`; `decision=BLOCK` → `403 FRAUD_RISK_LIMIT_INCREASE`; `REVIEW` → proceed but set `audit_events.diff.fraud_review_flag=true`
- PATCH semantics: only supplied `LimitType` values updated; omitted limit types stay unchanged; validated by Pydantic cross-field constraint on supplied values only
- `SELECT … FOR UPDATE` on `spending_limits` rows for the card token before reading current values (prevents lost-update anomaly — E3-1)
- Transaction: upsert `SpendingLimitORM`, write `audit_events` (`action=LIMIT_CHANGED`, `diff={before, after}`), write `outbox` (`event_type=card.limit_changed`)
- Edge cases: E3-1 through E3-5

**DoD:** Fraud engine `BLOCK` → no `spending_limits` row changed; idempotent retry returns original 200 response; `audit_events.diff` contains `before` and `after` limit snapshots but no PAN/CVV; PATCH with only `daily_limit` supplied leaves `per_txn_limit` and `monthly_limit` unchanged.

---

#### Task 3.4 — Implement limit enforcement service

**Prompt:** Create a synchronous service function that evaluates an incoming authorization amount against all active spending limits on a card.

**File:** `src/services/limit_enforcement.py`

**Class / function:** `LimitEnforcementService`, `LimitEnforcementService.check`, `LimitEnforcementService.daily_spend`

**Details:**
- Inputs: `card_token`, `auth_amount: Decimal`, `auth_currency: str`, `mcc: str`
- Queries `spending_limits` and `transactions` (daily and monthly totals) in a read-only sub-transaction
- Returns `{allow: bool, violated_limit_type: LimitType | None, available_balance_before_auth: Decimal}`
- Fail-closed: if `transactions` table unreachable → return `{allow: False, violated_limit_type: "SYSTEM_UNAVAILABLE"}`
- Target: < 50 ms per call [ASSUMED — anchor: card-network issuer-response window is sub-200 ms total; limit check must be a fraction of that]
- Called by Task 4.3 (authorization webhook consumer)

**DoD:** Unit tests: card with `daily_limit=100`, `daily_spend=90` — `check(amount=15)` → deny; `check(amount=9)` → allow; per-MCC limit `mcc="5411"` denies only matching MCCs.

---

### MLO-4 — View transactions

#### Task 4.1 — Define transaction models with masked PAN

**Prompt:** Create Pydantic v2 and SQLAlchemy 2 models for authorization transactions; enforce masked-PAN-only policy at the API layer.

**File:** `src/models/transaction.py`

**Class / function:** `AuthorizationStatus`, `TransactionBase`, `TransactionRead`, `TransactionORM`

**Details:**
- `AuthorizationStatus` enum: `AUTHORIZED | AUTHORIZED_PENDING_SETTLEMENT | DECLINED | REVERSED`
- `TransactionORM` columns: `id` (UUID PK), `processor_authorization_id` (VARCHAR, unique — deduplication key), `card_token` (FK), `amount` (`NUMERIC(18,4)`), `currency` (CHAR 3), `mcc` (CHAR 4), `merchant_name` (VARCHAR 255), `authorized_at` (TIMESTAMPTZ), `status`, `pan_last4` (CHAR 4), `data_freshness_at` (TIMESTAMPTZ)
- `TransactionRead` includes `pan_masked` (derived: `f"XXXXXX{pan_last4}"`) — never `pan` or `full_pan`
- Edge case: E4-2 — `data_freshness_at` field always present in response

**DoD:** `TransactionRead.model_json_schema()` contains no key named `pan` or `full_pan`; `pan_masked` always matches `XXXXXX\d{4}` regex.

---

#### Task 4.2 — Implement `GET /cards/{token}/transactions`

**Prompt:** Implement the transaction-list endpoint with cursor pagination, filter support, and strict data isolation.

**File:** `src/routes/transactions.py`

**Class / function:** `list_card_transactions`

**Details:**
- Auth: `scope=cards:read`; data isolation: `cardholder_id` from JWT must match `cards.cardholder_id` → `404` if mismatch (not 403 — E4-1)
- Query params: `from_date`, `to_date` (ISO 8601), `status`, `mcc`, `cursor` (opaque base64 of `(authorized_at, id)`), `page_size` (max 100, default 20)
- Cursor-based (not offset) pagination — stable under concurrent inserts
- Response shape: `{items: TransactionRead[], total_within_filter: int, next_cursor: str | null, data_freshness_at: datetime}`
- Postgres index required: `(card_token, authorized_at DESC)` — must be in migration
- Performance target: p95 < 300 ms for 100 concurrent users on a card with 10 000 transactions [ASSUMED — see §3]

**DoD:** Cardholder A's JWT cannot retrieve cardholder B's transactions (returns 404); page 2 cursor returns items 21–40 correctly; `next_cursor=null` on last page.

---

#### Task 4.3 — Implement authorization webhook consumer

**Prompt:** Implement an idempotent Kafka/HTTP consumer for `authorization.created` processor webhooks, verifying HMAC signatures, writing transactions, and invoking limit enforcement.

**File:** `src/workers/authorization_consumer.py`

**Class / function:** `AuthorizationConsumer`, `AuthorizationConsumer.handle`

**Details:**
- Three sequential checks before any payload processing (see §4 Webhook replay prevention):
  1. **Timestamp check:** extract `t=` from `Stripe-Signature`-style header; reject if skew > 300 s → `401`
  2. **HMAC-SHA256:** reconstruct signed payload as `f"{t}.{raw_body}"`; compare against `v1=` using `hmac.compare_digest`; mismatch → `401`, do not log raw payload
  3. **Event-ID dedup:** `SET webhook:{event.event_id} 1 EX 259200 NX`; already-seen → `200 OK` no-op
- Idempotent by `processor_authorization_id` (business-level dedup, separate from the event-ID dedup above): check before insert; duplicate → `200 OK` no-op
- Call `LimitEnforcementService.check`; record result in `TransactionORM.status` accordingly
- Write `TransactionORM` row + `audit_events` (`action=AUTHORIZATION_RECEIVED`) in same transaction
- `data_freshness_at = event.authorized_at`
- Edge case: E4-2

**DoD:** Replayed webhook (same `event_id`) returns `200 OK` without inserting a new `TransactionORM` row; replayed webhook outside 300 s window → `401`; invalid HMAC → `401`; `DECLINED` authorization stored with `status=DECLINED`.

---

### MLO-5 — Audit and replay

#### Task 5.1 — Define `audit_events` schema (INSERT-only)

**Prompt:** Create the SQLAlchemy ORM model, Alembic migration, and DB-level INSERT-only enforcement for `audit_events`.

**File:** `src/models/audit_event.py`, `alembic/versions/001_create_audit_events.py`

**Class / function:** `AuditEventORM`, migration `upgrade()` / `downgrade()`

**Details:**
- Columns: `id` (UUID PK), `occurred_at` (TIMESTAMPTZ NOT NULL, default `now()`), `actor_type` (VARCHAR — CARDHOLDER|FRAUD_ANALYST|OPS|FRAUD_ENGINE|SYSTEM), `actor_id` (UUID **nullable** — NULL after GDPR redaction; no FK; actor may be a system process or a redacted human), `is_redacted` (BOOLEAN NOT NULL DEFAULT FALSE — set to `TRUE` when GDPR redaction job NULLs PII columns; enables explicit query filtering), `action` (VARCHAR 64), `target_type` (VARCHAR 32), `target_id` (VARCHAR 64), `diff` (JSONB), `request_id` (UUID), `ip_address` (INET nullable — masked to `/24` for GDPR Art. 5(1)(c); NULLed on redaction), `user_agent` (TEXT nullable — NULLed on redaction), `correlation_id` (UUID)
- `actor_id` is NOT a FK (audit must survive cardholder deletion; actor could be FRAUD_ENGINE, OPS, or SYSTEM)
- Migration `upgrade()`: `REVOKE UPDATE, DELETE ON audit_events FROM app_role`; `GRANT UPDATE (actor_id, ip_address, user_agent) ON audit_events TO redactor_role` (column-level UPDATE for GDPR redaction — see §4 "Audit roles"); `GRANT SELECT ON audit_events TO redactor_role`; create index `(target_id, occurred_at)` and `(actor_id, occurred_at)` [PCI DSS v4.0 Req 10 — log searchability]
- `downgrade()`: `DROP TABLE audit_events` is intentionally **absent** (audit data must not be deleted via schema rollback) — migration is non-reversible; add comment in code
- `diff` must **never** contain keys named `pan`, `cvv`, `full_token`, or any raw secret
- Also create the `audit_attempts` table in a separate migration (`002_create_audit_attempts.py`): `id` (UUID PK), `idempotency_key` (UUID), `action` (VARCHAR 64), `target_type` (VARCHAR 32), `target_id` (VARCHAR 64), `status` (PENDING|COMMITTED|FAILED), `error_code` (VARCHAR 64 nullable), `occurred_at` (TIMESTAMPTZ), `committed_at` (TIMESTAMPTZ nullable); index `(idempotency_key)`, `(status, occurred_at)`; retention 90 days

**DoD:** `UPDATE audit_events SET actor_id='x' WHERE id=…` issued under `app_role` raises `PG_INSUFFICIENT_PRIVILEGE`; `DELETE FROM audit_events` under `app_role` raises the same; `UPDATE audit_events SET actor_id=NULL WHERE id=…` under `redactor_role` succeeds; `UPDATE audit_events SET action='X' WHERE id=…` under `redactor_role` raises `PG_INSUFFICIENT_PRIVILEGE`; migration `alembic downgrade -1` raises a documented error (not silently succeeds).

---

#### Task 5.2 — Define `outbox` schema and publisher worker

**Prompt:** Create the outbox ORM model and an outbox publisher worker that atomically reads pending rows and emits to Kafka.

**File:** `src/models/outbox.py`, `src/workers/outbox_publisher.py`

**Class / function:** `OutboxEventORM`, `OutboxPublisher.run_once`, `OutboxPublisher.publish_batch`

**Details:**
- `outbox` columns: `id` (UUID PK), `event_type` (VARCHAR 64), `event_id` (UUID — consumer deduplication key), `occurred_at` (TIMESTAMPTZ), `payload` (JSONB), `status` (PENDING|PUBLISHED|FAILED), `published_at` (TIMESTAMPTZ nullable), `retry_count` (SMALLINT DEFAULT 0)
- Publisher: `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50`; publish each row to Kafka topic matching `event_type`; on success → `status=PUBLISHED, published_at=now()`; on Kafka error → `retry_count += 1`; `retry_count > 5` → `status=FAILED` + alert
- At-least-once delivery: consumers must be idempotent by `event_id`
- Edge case: E5-1

**DoD:** A `PENDING` row is published and marked `PUBLISHED`; restarting the worker mid-batch does not double-publish a row already marked `PUBLISHED`; a row with `retry_count=6` has `status=FAILED`.

---

#### Task 5.3 — Implement `GET /audit/events` (ops/compliance replay)

**Prompt:** Implement a paginated audit-replay endpoint for ops/compliance roles with snapshot-isolation reads and AAL3 enforcement.

**File:** `src/routes/audit.py`

**Class / function:** `list_audit_events`

**Details:**
- Auth: `scope=audit:read`; AAL3 required (`aal >= 3` in JWT claim) [NIST SP 800-63B AAL3]
- Query params: `actor_id`, `target_type`, `target_id`, `action`, `from_date`, `to_date`, `cursor`, `page_size` (max 200)
- Cursor on `(occurred_at, id)`, ascending
- DB transaction isolation: `REPEATABLE READ` to prevent dirty reads during export (E5-3)
- Response: `{events: AuditEventRead[], next_cursor: str | null, total_within_filter: int, query_executed_at: datetime}`
- `diff` field returned as-is; defence-in-depth note: any `diff` key named `pan`/`cvv` stripped before serialisation

**DoD:** Request with `aal=2` JWT → `403`; audit query for `target_id=card_token_X` between T1 and T2 returns events in `occurred_at` ASC order; no dirty reads observed under concurrent write test.

---

#### Task 5.4 — Implement regulator-export job

**Prompt:** Implement a deterministic, hash-verifiable CLI export job that produces regulator-ready bundles for a given entity and time window.

**File:** `src/jobs/regulator_export.py`

**Class / function:** `RegulatorExportJob.run`, `RegulatorExportJob.export_by_card`

**Details:**
- Inputs: `entity_type` (CARD|CARDHOLDER), `entity_id`, `from_date`, `to_date`, `format` (CSV|JSONL)
- Queries `audit_events` under `REPEATABLE READ` transaction; includes all `transactions` and limit snapshots at each mutation point
- Output sorted by `(occurred_at, id)` ASC (deterministic)
- SHA-256 hash of output appended as a footer line: `# SHA256: {hex_digest}`
- Export action itself writes `audit_events` row (`action=REGULATOR_EXPORT`)
- Output written to a configurable sink (local path or S3 pre-signed URL)

**DoD:** Two runs with the same inputs produce byte-identical output; `sha256sum` of body matches footer; the export action appears in `audit_events` with the ops user as actor.

---

#### Task 5.5 — Implement GDPR redaction job

**Prompt:** Implement a CLI job that tombstones cardholder PII in audit and operational tables without deleting the audit chain skeleton.

**File:** `src/jobs/gdpr_redact.py`

**Class / function:** `GDPRRedactionJob.run`, `GDPRRedactionJob.redact_cardholder`

**Details:**
- Input: `cardholder_id`, `requested_by` (ops user UUID), `reason`
- Does **not** delete `audit_events` rows — retained under GDPR Art. 17(3)(b) ("compliance with a legal obligation": PCI DSS 12-month minimum, financial records law) [source: gdpr-info.eu/art-17-gdpr/]
- Tombstones in `audit_events` (executed under `redactor_role` connection — column-level UPDATE grant): sets `ip_address=NULL`, `user_agent=NULL`; if `actor_id` matches `cardholder_id` → `actor_id=NULL, is_redacted=TRUE`; the ORM must name only these three columns in the UPDATE statement (full-model flush would fail the column-level grant check)
- Tombstones in operational tables: cardholder `name`, `email`, `phone` replaced with `SHA-256(value + redaction_salt)` prefix `REDACTED_`
- **Erasure propagation** (see §4 GDPR Erasure Propagation): also propagate to outbox pending rows, Kafka (crypto-shredding or tombstone), log archives, and Redis idempotency keys; write `GDPR_ERASURE_PROPAGATION_COMPLETED` event listing all stores touched
- Retention note: financial records retention period is jurisdiction-dependent — **[ASSUMED typical 5–7 years for EU financial records]** per FATF R10 and EU financial records law; implement as a configurable `AUDIT_RETENTION_YEARS` env var
- Returns structured partial-refusal response (see Task 7.1) for delivery to data subject within 30 days
- Writes `GDPR_REDACTION_COMPLETED` audit event with `{requested_by, cardholder_id, fields_redacted}`

**DoD:** After job run: `audit_events` rows for `cardholder_id` still exist (not deleted); `actor_id` is `NULL` and `is_redacted=TRUE` on affected rows; `ip_address` and `user_agent` are `NULL`; cardholder PII fields in operational table are `REDACTED_*`; pending outbox rows for cardholder have PII fields overwritten; Redis keys `idempotency:{cardholder_id}:*` are deleted; `GDPR_REDACTION_COMPLETED` and `GDPR_ERASURE_PROPAGATION_COMPLETED` events exist in `audit_events`; `audit_events` UPDATE was executed under `redactor_role` (verify in pgaudit log if enabled).

---

#### Task 5.6 — Create `reconciliation_reports` migration

**Prompt:** Create the Alembic migration for the reconciliation reports table used by the daily reconciliation job.

**File:** `alembic/versions/010_create_reconciliation_reports.py`

**Class / function:** migration `upgrade()`, `downgrade()`

**Details:**
- `reconciliation_reports` columns: `run_id` (UUID PK), `run_date` (DATE NOT NULL), `status` (VARCHAR 32 — `clean` | `discrepancies_found`), `cards_checked` (INT), `events_checked` (INT), `discrepancy_count` (INT DEFAULT 0), `discrepancies` (JSONB — array of `{type, entity_id, issuer_value, processor_value}`), `created_at` (TIMESTAMPTZ)
- Unique constraint: `(run_date)` — re-running for the same date upserts, not duplicates
- Index: `(run_date DESC)` for latest-first queries

**DoD:** `alembic upgrade head` creates the table; `alembic downgrade -1` drops it cleanly; `UNIQUE (run_date)` constraint rejects duplicate date inserts.

---

#### Task 5.7 — Implement daily reconciliation job

**Prompt:** Implement a pull-based CLI reconciliation job that compares card inventory and authorization events in the issuer DB against the processor's API for a given date, writes results to `reconciliation_reports`, and exits non-zero on discrepancies.

**File:** `src/reconciliation/daily_reconciler.py`

**Class / function:** `DailyReconciler.run`, `DailyReconciler.reconcile_cards`, `DailyReconciler.reconcile_events`

**Details:**
- CLI: `python -m src.reconciliation.run --date YYYY-MM-DD`
- Pull from processor: `GET /v1/cards` (paginated) and `GET /v1/transactions?start_date=…&end_date=…` for the given date
- Compare card inventory: cards in issuer DB (status, token) vs processor list — flag missing or status-mismatched cards
- Compare authorization events: `processor_authorization_id` values in `audit_events` for the date vs processor transaction list — flag missing events or amount mismatches
- Write `reconciliation_reports` row on every run; upsert on `(run_date)` for idempotency
- Structured log + Prometheus counter `reconciliation_discrepancies_total{type}` on completion
- Exit code: `0` if `status=clean`, `1` if `status=discrepancies_found`

**DoD:** Clean run (no discrepancies) inserts row with `status='clean'`, exits 0; injected mismatch inserts row with `status='discrepancies_found'`, non-empty `discrepancies` JSONB, exits 1; re-running for the same date upserts rather than duplicates the report row; edge case E1-5 triggers a `CARD_ORPHANED_AT_PROCESSOR` discrepancy entry.

---

### MLO-6 — Operate within stated SLOs

#### Task 6.1 — Define observability conventions (structured logging + Prometheus metrics)

**Prompt:** Implement a structured-logging schema and Prometheus metric definitions that encode the §3 SLO targets as monitorable signals.

**File:** `src/observability/logging.py`, `src/observability/metrics.py`

**Class / function:** `StructuredLogger`, `CardServiceMetrics`

**Details:**
- Structured log fields: `timestamp` (ISO 8601 UTC), `level`, `service`, `trace_id`, `span_id`, `cardholder_id_partial` (first char + `***` + last char), `card_token_partial` (last 4 chars only), `action`, `duration_ms`, `status_code`, `error_code`
- **Never log:** full PAN, CVV, `PROCESSOR_API_KEY`, `Idempotency-Key` value, full `card_token` [PCI DSS v4.0 Req 10, Req 3.3]
- Prometheus metrics: `http_request_duration_seconds` (histogram, labels: method, endpoint, status_class), `card_state_transitions_total` (counter, labels: from_status, to_status, actor_type), `outbox_lag_seconds` (gauge), `fraud_freeze_latency_seconds` (histogram)
- Prometheus alert rules (YAML): `p95 > 300 ms reads → warning`, `p95 > 800 ms writes → critical`, `freeze propagation > 2 s p99 → critical/page`, `outbox_lag > 60 s → warning`

**DoD:** `grep -E '\b[0-9]{12,}\b' <(log_output)` returns no matches (no PAN-length numeric strings); Prometheus `/metrics` endpoint exposes all four named metrics; alert rule YAML parses without errors.

---

#### Task 6.2 — Write load-test plan (documentation artifact)

**Prompt:** Write a structured load-test plan that encodes the §3 SLO targets as verifiable scenarios using Locust (Python-native, fits FastAPI stack).

**File:** `docs/load-test-plan.md`

**Details:**
- Scenario 1 — steady-state reads: 100 concurrent `GET /cards/{token}/transactions`, ramp 10 → 100 over 60 s, duration 300 s; acceptance: p95 < 300 ms, 0 % 5xx [ASSUMED target — §3]
- Scenario 2 — write burst: 50 concurrent `PATCH /cards/{token}/status`, ramp 5 → 50 over 30 s, duration 120 s; acceptance: p95 < 800 ms [ASSUMED]
- Scenario 3 — freeze-under-degradation: mock processor returns 503; 20 concurrent freeze requests; acceptance: all requests return HTTP 2xx (local state written); p95 < 800 ms
- Scenario 4 — freeze propagation SLO: measure time between HTTP 200 from `PATCH /status` and processor webhook `card.state_changed` received; acceptance: p99 ≤ 2 s [ASSUMED — §3]
- Each scenario includes: fixture seed data shape (e.g. `50 cards with status=ACTIVE, 1000 transactions each`), Locust `User` class outline, acceptance criterion

**DoD:** Each scenario specifies concurrency, ramp-up, duration, success criteria, and a one-paragraph Locust config example; all numeric targets labelled `[ASSUMED]` with §3 reference.

---

#### Task 6.3 — Implement notification consumer worker

**Prompt:** Implement a Kafka consumer that subscribes to card lifecycle events and calls the notification service for user-facing events. Decoupled from the mutation path — notification failures must never affect the main transaction or card operations.

**File:** `src/workers/notification_consumer.py`

**Class / function:** `NotificationConsumer`, `NotificationConsumer.handle`

**Details:**
- Subscribe to Kafka topics: `card.issued`, `card.state_changed` (frozen/unfrozen), `authorization.created` (approved/declined)
- For each event, call `POST {NOTIFICATION_URL}/notify` with `{cardholder_id, template_id, params: {...}}` and an `Idempotency-Key` (derived from `event_id`)
- Best-effort only: if `POST /notify` returns 5xx or times out, log the error and skip (do not retry indefinitely); notification failure must never cause Kafka consumer lag
- Idempotent by `event_id`: check `processed_notification_events` set (Redis SET or DB table) before calling `/notify`; duplicate events are silently skipped
- Deserialise event payload; resolve `cardholder_id` from `card_token` if not present in event
- Edge case: notification service unavailability → consumer continues processing other events, logs `notification_delivery_failed{template_id}` Prometheus counter

**DoD:** `card.issued` event → `POST /notify` called once with correct `template_id=card_issued`; replayed event (same `event_id`) → `/notify` not called again; notification service 503 → consumer processes next event without crashing; Prometheus counter `notification_delivery_failed_total` incremented on failure.

---

#### Task 6.4 — Implement rate limiter middleware

**Prompt:** Implement a Starlette rate-limiter middleware using `slowapi` (or equivalent) with a Redis sliding-window backend. Rate-limit decisions logged with masked cardholder ID.

**File:** `src/middleware/rate_limiter.py`

**Class / function:** `RateLimiterMiddleware`

**Details:**
- Backend: Redis `INCR + EXPIRE` sliding-window counter per `sha256(cardholder_id + endpoint_path)` key
- Limits (from `Settings`): `RATE_LIMIT_READS_PER_MIN=60` (GET endpoints), `RATE_LIMIT_WRITES_PER_MIN=10` (POST/PATCH endpoints)
- Breach: `429 Too Many Requests` with `Retry-After: <seconds>` header and body `{"error": {"code": "RATE_LIMIT_EXCEEDED", "retry_after": <int>}}`
- Applies only to authenticated requests (cardholder_id from JWT); unauthenticated requests are rate-limited by IP (fallback: `sha256(ip_masked_to_24)`)
- Decisions logged at `DEBUG` level with `cardholder_id_partial` (first char + `***` + last char)
- Config: `Settings.RATE_LIMIT_READS_PER_MIN`, `Settings.RATE_LIMIT_WRITES_PER_MIN` with defaults from §3

**DoD:** 11 consecutive write requests from same cardholder within 60 s → 11th returns 429 with `Retry-After`; 61st read request → 429; counter resets after window expires; unauthenticated request uses IP-based key.

---

#### Task 6.5 — Implement SSRF-safe HTTP transport

**Prompt:** Implement a custom httpx `AsyncBaseTransport` that guards all outbound processor HTTP calls against Server-Side Request Forgery and DNS rebinding attacks.

**File:** `src/http/ssrf_transport.py`

**Class / function:** `SSRFSafeTransport`, `SSRFTransportError`

**Details:**
- Transport performs four sequential checks per request: (1) resolve the hostname to its IP via a single DNS query; (2) reject the resolved IP if it falls within RFC-1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8), link-local (169.254.0.0/16 — AWS metadata endpoint), or IPv6 equivalents; (3) open a TCP connection pinned to the validated IP (no second resolution); (4) re-validate any redirect target through steps 1–3 before following.
- Startup validation: `Settings.SSRF_ALLOWED_PROCESSOR_HOSTNAMES` is a non-empty list; if any configured processor URL resolves to a rejected IP range at startup, raise `ValueError` before accepting requests.
- All outbound HTTP clients for processor calls (card creation, freeze/unfreeze, reconciliation) must use `SSRFSafeTransport`. Do not use plain `httpx.AsyncClient` without this transport for processor calls.
- On rejection: raise `SSRFTransportError` (→ `503 PROCESSOR_SSRF_REJECTED` in the exception handler); log the hostname and rejected IP at WARN level (never log the full URL body, which may contain credentials).

**DoD:** `test_ssrf_rfc1918_rejected` — a request to `10.0.0.1` raises `SSRFTransportError`; `test_ssrf_dns_rebind_rejected` — a request whose DNS resolves to `169.254.169.254` raises `SSRFTransportError`; `grep -r "AsyncClient(" src/ | grep -v "ssrf_transport\|SSRFSafeTransport"` returns no matches for processor call sites.

---

### MLO-5 (compliance extension) — GDPR data-subject rights

> Tasks here fulfil the GDPR data-subject-rights obligations (Art. 15 access, Art. 17 erasure, Art. 20 portability) that attach to the audit and data-retention function of MLO-5. They are compliance obligations, not security-gating controls (MLO-3).

#### Task 7.1 — Implement data-subject-rights endpoints (GDPR Art. 15 / 17 / 20)

**Prompt:** Implement the cardholder's GDPR data-subject rights surface: a data-export endpoint (Art. 15 access / Art. 20 portability) and a documented partial-refusal response for erasure requests on legally-retained audit data (Art. 17(3)(b)).

**File:** `src/routes/privacy.py`

**Class / function:** `export_cardholder_data`, `DataExportResponse`, `ErasureRefusalResponse`

**Details:**
- Auth: `scope=cards:read` (cardholder's own data only); cardholder_id resolved from JWT `sub`
- `GET /cardholders/{cardholder_token}/data-export` (Art. 15 / Art. 20): returns a structured JSON export of all personal data held for the cardholder — `CardholderRead`, all `CardRead` items, all `TransactionRead` items, all limit snapshots; **excludes** raw PAN (only `pan_masked`) and CVV (never stored); `Content-Type: application/json`
- Response shape: `{exported_at: ISO-8601, cardholder: CardholderRead, cards: CardRead[], transactions: TransactionRead[], limits: SpendingLimitRead[], data_retention_notice: string}`
- For audit_events and audit_attempts: include counts only (`audit_event_count: int`), not full payloads (compliance data, not portability-required)
- Erasure partial-refusal: when `GDPRRedactionJob` receives an erasure request, it must return a structured response `{status: "partial_erasure", erasure_completed: [list of fields NULLed], retained_under_legal_obligation: ["audit_events (PCI Req 10.5.1 — 12 months)", "cards (AML/CFT — 7 years)", ...], legal_basis: "GDPR Art. 17(3)(b) — compliance with a legal obligation"}`; operator must deliver this to the data subject within 30 days
- SLA: `GDPR_DSR_SLA_DAYS=30` (configurable); log a `DSR_REQUEST_RECEIVED` audit event on every call

**DoD:** `GET /data-export` returns HTTP 200 with all cardholder's own data; no `pan` or `cvv` key in response body; response validates against `DataExportResponse` Pydantic schema; cross-cardholder access → `404`; `DSR_REQUEST_RECEIVED` audit event written on each call.

---

### Cross-cutting

#### Task X.1 — Define error envelope and exception handlers

**Prompt:** Define the standard error response schema and register FastAPI exception handlers that map all domain exceptions to the envelope format.

**File:** `src/errors/envelope.py`, `src/errors/handlers.py`

**Class / function:** `ErrorEnvelope`, `ErrorDetail`, `register_exception_handlers`

**Details:**
- Envelope: `{"error": {"code": "SNAKE_CASE_STRING", "message": "…", "request_id": "UUID", "details": [{"field": "…", "message": "…"}] | null}}`
- Domain exception → HTTP mapping: `InvalidCardStateTransition` → 409, `FraudLockActive` → 403, `KYCNotApproved` → 403, `SCARequired` → 401, `ProcessorError` → 503, `IdempotencyConflict` → 409, Pydantic `ValidationError` → 422
- `debug=False` in production: no stack traces, no internal identifiers in responses
- `request_id` echoed from `X-Request-ID` header or generated if absent
- `4xx` → not written to `audit_events`; `5xx` → `audit_events` row with `action=INTERNAL_ERROR`, minimal payload

**DoD:** Test: raising `InvalidCardStateTransition` inside a handler produces a JSON body matching `ErrorEnvelope` schema; stack trace absent; `request_id` matches the `X-Request-ID` sent in the test request.

---

#### Task X.2 — Implement config and secrets management

**Prompt:** Implement environment-variable-based configuration using Pydantic `BaseSettings` with startup validation; document all required fields.

**File:** `src/config.py`

**Class / function:** `Settings`

**Details:**
- Required: `DATABASE_URL`, `REDACTOR_DATABASE_URL` (separate DSN for `redactor_role` connection), `REDIS_URL` (**`SecretStr`** — may contain credentials), `KAFKA_BOOTSTRAP_SERVERS`, `PROCESSOR_API_BASE_URL`, `PROCESSOR_API_KEY` (secret), `PROCESSOR_WEBHOOK_SIGNING_KEY` (secret), `IDENTITY_SERVICE_URL`, `FRAUD_ENGINE_URL`, `KYC_SERVICE_URL`, `NOTIFICATION_URL`
- Optional (with defaults): `LOG_LEVEL=INFO`, `IDEMPOTENCY_TTL_HOURS=24`, `REVEAL_HANDLE_TTL_SECONDS=60`, `RATE_LIMIT_WRITES_PER_MIN=10`, `RATE_LIMIT_READS_PER_MIN=60`, `RATE_LIMIT_WINDOW_SECONDS=60`, `AUDIT_RETENTION_YEARS=7`, `OUTBOX_POLL_INTERVAL_MS=500`, `OUTBOX_CLAIM_TIMEOUT_MINUTES=5`
- Security config (required): `ALLOWED_ALGORITHMS=["RS256","ES256"]` (list, hard-coded default, operator may not add HS256); `ALLOWED_ISSUERS` (comma-separated list of exact issuer URLs — at minimum cardholder IdP and ops IdP); `ISSUER_JWKS_ENDPOINTS` (JSON map: `{issuer_url: jwks_endpoint_url}`); `SSRF_ALLOWED_PROCESSOR_HOSTNAMES` (comma-separated FQDN allowlist for processor API base URL)
- `PROCESSOR_API_KEY`, `PROCESSOR_WEBHOOK_SIGNING_KEY`, and `REDIS_URL` must never appear in logs or error bodies; use `SecretStr` from Pydantic
- Startup validation: invalid `DATABASE_URL` scheme raises `ValueError` at import time; `PROCESSOR_API_BASE_URL` hostname not in `SSRF_ALLOWED_PROCESSOR_HOSTNAMES` raises `ValueError`; any issuer in `ALLOWED_ISSUERS` missing from `ISSUER_JWKS_ENDPOINTS` raises `ValueError`

**DoD:** Missing `PROCESSOR_API_KEY` at startup raises `ValidationError` naming the field; `settings.PROCESSOR_API_KEY` is a `SecretStr` and does not appear in `repr(settings)`; `settings.REDIS_URL` is a `SecretStr`; startup with `PROCESSOR_API_BASE_URL=https://evil.internal` raises `ValueError` (not in allowed hostnames).

---

#### Task X.3 — Define Alembic migrations and schema conventions

**Prompt:** Define Alembic migration conventions and create the initial migration covering all tables, indices, and constraints.

**File:** `alembic/env.py`, `alembic/versions/001_initial_schema.py`

**Class / function:** migration `upgrade()`, `downgrade()`

**Details:**
- Convention: UUID PKs (`gen_random_uuid()` default), all timestamps as `TIMESTAMPTZ`, enum values stored as `VARCHAR` (not Postgres `ENUM` — easier evolution), one migration file per logical change
- `audit_events`: no FK to `cardholders` (audit must survive cardholder deletion); no `downgrade()` body (intentional — non-reversible; add comment)
- Indices: `cards(cardholder_id)`, `transactions(card_token, authorized_at DESC)`, `audit_events(target_id, occurred_at)`, `audit_events(actor_id, occurred_at)`, `outbox(status, occurred_at)`
- All other migrations must have a working `downgrade()`

**DoD:** `alembic upgrade head` on blank DB succeeds; `alembic downgrade -1` on non-audit migrations succeeds; `audit_events` downgrade raises `NotImplementedError` with explanatory message.

---

#### Task X.4 — Define test-category conventions

**Prompt:** Create `tests/conftest.py` with shared fixtures and a `docs/test-strategy.md` encoding the §8 verification categories.

**File:** `tests/conftest.py`, `docs/test-strategy.md`

**Class / function:** `app_client`, `db_session`, `mock_processor`, `mock_identity`, `mock_fraud_engine`

**Details:**
- pytest marks: `unit` (pure functions, no I/O), `integration` (real Postgres, mocked externals), `contract` (validates service contracts against named stubs), `e2e` (full docker-compose stack), `security` (auth bypass, PAN-in-log, OWASP checks)
- `integration` requires `TEST_DATABASE_URL` env var; `pytest -m unit` must run without Postgres
- `mock_processor`: `respx`-based fixture with scenarios: happy-path, 503, timeout, HMAC-signing for webhooks
- `mock_identity`: scenarios: AAL2 JWT, AAL3 JWT, expired JWT, SCA success, SCA failure
- CI pipeline: `unit + integration + contract` on every PR; `e2e + security` in nightly
- `docs/test-strategy.md` references each §8 verification fixture by name

**DoD:** `pytest -m unit` completes without a running Postgres instance; `pytest -m integration -k test_issue_card_idempotency` asserts exactly one `audit_events` row for a duplicate `Idempotency-Key` request; `pytest -m security -k test_reveal_no_pan_in_logs` asserts no PAN in log output.

---

## 8. Verification

For each MLO: review checkpoints, test categories, and named fixture shapes. Traceability: each row maps to a task cluster in §7 and an edge-case sub-table in §6.2.

| MLO | Review checkpoint | Test categories | Named fixtures |
|---|---|---|---|
| MLO-1 Issue card | Code review: no `cvv`/`pan` column in migration; `audit_events.diff` contains no sensitive fields; idempotency middleware (not Depends) short-circuits before route; `CardholderORM` migration precedes `CardORM`; `GET /cards` returns only requesting cardholder's cards; JWT `algorithms=["RS256","ES256"]` — never derived from token header; all processor calls use `SSRFSafeTransport` | Unit: `CardORM` schema check; Integration: `test_issue_card_success`, `test_issue_card_idempotency`, `test_issue_card_processor_503`, `test_list_cards_data_isolation`; Contract: processor stub matches `POST /v1/cards` contract; Security: `test_reveal_no_pan_in_logs`, `test_reveal_handle_expired`, `test_jwt_alg_none_rejected`, `test_jwt_unknown_issuer_rejected`, `test_reveal_handle_concurrent_redemption` | `fixture_cardholder_kyc_approved`, `fixture_processor_card_response`, `fixture_processor_503`, `fixture_two_cardholders_each_with_2_cards`, `fixture_jwt_alg_none_token`, `fixture_jwt_unknown_issuer_token`, `fixture_reveal_handle_version_1` |
| MLO-2 Freeze/unfreeze | Code review: `SELECT FOR UPDATE` present on status-change path; processor 5xx rolls back local state but `audit_attempts` row persists; fraud-lock prevents cardholder unfreeze | Unit: state-machine transition matrix (assert `ACTIVE→FROZEN`, `FROZEN→ACTIVE`, `ACTIVE→FROZEN` when `fraud_lock=True` raises `FraudLockActive`, invalid transition raises `InvalidCardStateTransition`). Integration: `test_freeze_concurrent` — fire two concurrent `PATCH status=FROZEN` requests; assert `cards.status == 'FROZEN'`, exactly **two** `audit_events` rows with distinct `actor_id` and `occurred_at[0] < occurred_at[1]`; assert no deadlock / 500. `test_freeze_fraud_lock` — assert `HTTP 403`, `error.code == 'FREEZE_LOCKED_BY_FRAUD'`, zero `cards` row changes, one `audit_events` row with `action='UNFREEZE_DENIED'`. `test_freeze_processor_503_audit_attempts_row` — assert `HTTP 503`, `error.code == 'PROCESSOR_ERROR'`, `cards.status` unchanged from before the request, **zero** new `audit_events` rows (tx rolled back), **one** new `audit_attempts` row with `action='FREEZE_FAILED', reason='PROCESSOR_ERROR'`. Security: `test_unfreeze_fraud_locked_card_returns_403` — assert 403, body matches `ErrorEnvelope` schema, no state change | `fixture_card_active`, `fixture_card_frozen_fraud_locked`, `fixture_fraud_freeze_event`, `fixture_audit_attempts_failed_freeze` |
| MLO-3 Set limits | Code review: SCA gate fail-closed; fraud engine `BLOCK` produces no DB change; PATCH not PUT; cross-field constraint via trigger (not CHECK); `SELECT FOR UPDATE` on spending_limits | Unit: `LimitEnforcementService.check` matrix (assert each limit type × each enforcement path: below daily cap passes, at cap passes, above cap raises `LimitExceeded`; `daily_limit < per_txn_limit` raises `InvalidLimitCombination`). Integration: `test_limit_increase_requires_sca` — assert first PATCH on a limit increase returns `HTTP 401`, `error.code == 'SCA_REQUIRED'`, `challenge_id` in response; after `POST /sca/verify` with `aal=2`, repeat PATCH returns 200, `spending_limits` row updated, one `audit_events` row with `action='LIMIT_CHANGED'`. `test_limit_increase_fraud_block` — assert `HTTP 403`, `error.code == 'FRAUD_RISK_LIMIT_INCREASE'`, zero `spending_limits` changes, one `audit_events` row with `action='LIMIT_CHANGE_DENIED'`, `diff.fraud_score` present (no PAN/CVV). `test_limit_decrease_no_sca` — assert 200 without SCA challenge issued. `test_patch_partial_limit_update` — send body with only `daily_limit`; assert only that field changes in DB; `per_txn_limit` row unchanged. Contract: SCA stub `POST /sca/verify` returns `{verified: true, aal_achieved: 2}` — assert limit is applied; returns `{verified: false}` — assert limit is not applied and `audit_events` records the failure | `fixture_card_with_daily_limit_100`, `fixture_sca_verified_aal2`, `fixture_fraud_engine_block` |
| MLO-4 View transactions | Code review: no full PAN in `TransactionRead`; `data_freshness_at` always present; cursor encodes filter fingerprint; `CURSOR_FILTER_MISMATCH` returned on filter drift; webhook handler performs timestamp → HMAC → event-ID checks in that order | Unit: `pan_masked` derivation, cursor encode/decode; Integration: `test_list_transactions_data_isolation`, `test_pagination_cursor_stability`, `test_cursor_filter_mismatch_returns_400`, `test_empty_card_returns_200`; Security: `test_cross_cardholder_access_returns_404`, `test_webhook_replay_old_timestamp_returns_401`, `test_webhook_event_id_dedup_returns_200_noop` | `fixture_card_with_10k_transactions`, `fixture_two_cardholders`, `fixture_processor_lag_stale_data`, `fixture_webhook_valid_signature`, `fixture_webhook_old_timestamp` |
| MLO-5 Audit and replay | Code review: `REVOKE UPDATE DELETE` in migration; column-level `GRANT` for `redactor_role`; `is_redacted` column present; GDPR job sets `actor_id=NULL` not `'REDACTED'`; reconciliation job tasks present; erasure propagation covers outbox, Redis, Kafka, log archives | Integration: `test_audit_insert_only`, `test_audit_attempts_on_rollback`, `test_outbox_at_least_once`, `test_regulator_export_deterministic`, `test_reconciler_clean_run`, `test_reconciler_discrepancy_detected`, `test_gdpr_erasure_propagates_to_outbox_and_redis`; Security: `test_direct_db_update_audit_events_app_role_fails`, `test_redactor_role_can_null_actor_id`, `test_redactor_role_cannot_update_action`; Manual: spot-check regulator export SHA-256 footer | `fixture_audit_events_for_card_x`, `fixture_audit_attempts_failed_freeze`, `fixture_outbox_pending_rows`, `fixture_cardholder_for_gdpr_redaction`, `fixture_reconciliation_discrepancy_seed` |
| MLO-5 compliance extension (Task 7.1) | Code review: `GET /data-export` returns no `pan`/`cvv` key; cross-cardholder access returns 404; `DSR_REQUEST_RECEIVED` audit event written on every call; partial-refusal response includes `legal_basis` field | Integration: `test_dsr_export_returns_cardholder_data_json`, `test_dsr_export_partial_refusal_for_audit_records`, `test_dsr_export_no_pan_in_response`; Security: `test_dsr_cross_cardholder_access_returns_404` | `fixture_cardholder_with_cards_and_transactions`, `fixture_dsr_partial_refusal_audit_records` |
| MLO-6 SLOs | Code review: alert rules YAML parseable; rate-limiter middleware registered; notification consumer wired; structured log field names match spec; `RATE_LIMIT_WRITES_PER_MIN` in config; `SSRFSafeTransport` used for all processor calls; `SSRF_ALLOWED_PROCESSOR_HOSTNAMES` validated at startup | Unit: metric registration, rate-limiter key derivation; Integration: `test_freeze_under_processor_degradation`, `test_rate_limiter_429_on_11th_write`, `test_notification_consumer_happy_path`, `test_notification_consumer_503_does_not_crash`, `test_ssrf_allowlist_rejects_rfc1918_url`; Load: k6 scenarios in `docs/load-test-plan.md` | `fixture_processor_degraded_503`, `fixture_locust_seed_50_active_cards`, `fixture_rate_limit_11_requests`, `fixture_notification_service_503`, `fixture_ssrf_rfc1918_processor_url` |

---

## References

| Source | URL | Used in |
|---|---|---|
| PCI DSS v4.0 Req 3.3 (SAD prohibition) | [pcisecuritystandards.org](https://blog.pcisecuritystandards.org/faq-can-cvc-be-stored-for-card-on-file-or-recurring-transactions) | §3 PAN/SAD policy, Task 1.5, Task 5.1 |
| PCI DSS v4.0 Req 10.5.1 (audit log retention) | [pcisecuritystandards.org](https://www.pcisecuritystandards.org) | §3 audit retention |
| PSD2 Directive 2015/2366/EU Art. 97(1) | [eur-lex.europa.eu](https://eur-lex.europa.eu) | §3 SCA, Task 3.2 |
| EBA RTS on SCA — Regulation (EU) 2018/389 | [eba.europa.eu](https://www.eba.europa.eu) | §3 SCA |
| NIST SP 800-63B (v4) — AAL2 / AAL3 | [pages.nist.gov/800-63-4](https://pages.nist.gov/800-63-4/sp800-63b/aal/) | §3 auth strength, Task 5.3 |
| GDPR Art. 17(3)(b) — right to erasure exemption | [gdpr-info.eu/art-17-gdpr](https://gdpr-info.eu/art-17-gdpr/) | §3 erasure, Task 5.5 |
| GDPR Art. 5(1)(c) — data minimisation | [gdpr-info.eu/art-5-gdpr](https://gdpr-info.eu/art-5-gdpr/) | §3 privacy, Task 5.1 |
| GDPR Art. 25 — privacy by design | [gdpr-info.eu/art-25-gdpr](https://gdpr-info.eu/art-25-gdpr/) | §3 |
| PostgreSQL column-level GRANT (v17) | [postgresql.org/docs/17/sql-grant.html](https://www.postgresql.org/docs/17/sql-grant.html) | §4 Audit roles, Task 5.1, Task 5.5 |
| EDPB Guidelines 01/2025 — pseudonymisation | [edpb.europa.eu](https://www.edpb.europa.eu) | §4 Two-table audit model, Task 5.5 (is_redacted boolean preferred over sentinel UUID) |
| Stripe Issuing — idempotency | [docs.stripe.com/api/idempotent_requests](https://docs.stripe.com/api/idempotent_requests) | §4 Idempotency, Task 1.2, E1-4 |
| Stripe Issuing — webhooks (async lifecycle) | [docs.stripe.com/issuing](https://docs.stripe.com/issuing) | §5.1 processor contract, H6 scope-out decision |
| RFC 8725 — JWT Best Current Practices | [rfc-editor.org/rfc/rfc8725](https://rfc-editor.org/rfc/rfc8725) | §3 JWT algorithm restriction, §4 JWT validation |
| OWASP JWT Security Cheat Sheet | [cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Tokens_Cheat_Sheet_for_Java](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Tokens_Cheat_Sheet_for_Java.html) | §3 JWT algorithm restriction, §4 JWT validation |
| OWASP SSRF Prevention Cheat Sheet | [cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | §3 SSRF guard, §4 SSRF guard, Task 6.5 |
| Stripe webhook signature docs (timestamp replay prevention) | [docs.stripe.com/webhooks](https://docs.stripe.com/webhooks) | §3 Webhook replay prevention, §4 Webhook replay prevention, Task 4.3 |
| GDPR Art. 6 — lawful basis for processing | [gdpr-info.eu/art-6-gdpr](https://gdpr-info.eu/art-6-gdpr/) | §3 GDPR Art. 6 lawful basis |
| GDPR Art. 15 — right of access | [gdpr-info.eu/art-15-gdpr](https://gdpr-info.eu/art-15-gdpr/) | §3, Task 7.1 |
| GDPR Art. 20 — right to data portability | [gdpr-info.eu/art-20-gdpr](https://gdpr-info.eu/art-20-gdpr/) | §3, Task 7.1 |
| GDPR Art. 30 — records of processing activities | [gdpr-info.eu/art-30-gdpr](https://gdpr-info.eu/art-30-gdpr/) | §3 RoPA |
| GDPR Art. 33/34 — breach notification | [gdpr-info.eu/art-33-gdpr](https://gdpr-info.eu/art-33-gdpr/); [gdpr-info.eu/art-34-gdpr](https://gdpr-info.eu/art-34-gdpr/) | §3 breach notification |
| GDPR Art. 35 — DPIA | [gdpr-info.eu/art-35-gdpr](https://gdpr-info.eu/art-35-gdpr/) | §3 DPIA |
| EDPB Guidelines 9/2022 — personal data breach notification | [edpb.europa.eu](https://www.edpb.europa.eu/our-work-tools/documents/our-documents/guidelines/guidelines-012021-examples-regarding-personal-data_en) | §3 breach notification |
| EDPB WP248 rev.01 — DPIA threshold criteria | [ec.europa.eu](https://ec.europa.eu/newsroom/article29/items/611236) | §3 DPIA mandatory, WP248 criteria |
| PCI DSS v4.0 Req 3.5/3.6 (encryption at rest / key management) | [pcisecuritystandards.org](https://www.pcisecuritystandards.org) | §3 encryption at rest, §5.1 CDE scope |
| PCI SSC Tokenization Guidelines | [pcisecuritystandards.org](https://www.pcisecuritystandards.org/documents/Tokenization_Product_Security_Guidelines.pdf) | §5.1 CDE scope |
| PCI SSC Scoping and Segmentation Guidance | [pcisecuritystandards.org](https://www.pcisecuritystandards.org/documents/Guidance-PCI-DSS-Scoping-and-Segmentation_v1_1.pdf) | §5.1 CDE scope |
| EU AMLR 2024/1624 (replaces AMLD5/6) | [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202401624) | §1.2 Regulatory Model, §1 Scope boundary |
| AMLD6 Directive 2024/1640 | [eur-lex.europa.eu](https://eur-lex.europa.eu) | §1.2 Regulatory Model |
| UK MLRs 2017 (Money Laundering Regulations) | [legislation.gov.uk](https://www.legislation.gov.uk/uksi/2017/692/contents/made) | §1.2 Regulatory Model |
| FATF Recommendation 10 (CDD) | [fatf-gafi.org](https://www.fatf-gafi.org/en/topics/fatf-recommendations.html) | §3 Data retention, §1.2 Regulatory Model |
| EU Directive 2009/110/EC (EMD2) | [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32009L0110) | §1.2 Regulatory Model |
| UK Electronic Money Regulations 2011 | [legislation.gov.uk](https://www.legislation.gov.uk/uksi/2011/99/contents/made) | §1.2 Regulatory Model |
