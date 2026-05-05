# 💳 Homework 3: Virtual Card Lifecycle Specification

> **Student Name**: Ruslan Formanchuk
> **Date Submitted**: May 6, 2026
> **AI Tools Used**: Claude Code (Sonnet 4.5)

---

## 📋 Project Overview

**Assignment:** Specification-Driven Design
**Feature:** Virtual Card Lifecycle Management System in a regulated FinTech environment

### Summary

This specification package defines a comprehensive, multi-layered blueprint for a virtual card lifecycle management system in a regulated FinTech environment. The system enables end-users to create, manage, freeze/unfreeze, configure spending limits, and view transactions for virtual payment cards with full auditability and regulatory compliance (PCI DSS, GDPR, CCPA).

The specification is structured in layers from high-level business objectives down to 20 detailed, implementable tasks with explicit acceptance criteria. It emphasizes security (PAN masking, encryption), compliance (immutable audit logs, 7-year retention), and reliability (idempotency, optimistic locking, performance targets) as first-class requirements, not afterthoughts.

**Scope:** CRUD operations for virtual cards, state management, spending limit enforcement, transaction visibility, audit logging, and compliance reporting.

**Out of Scope:** Physical card management, card-to-card transfers, rewards programs, and full merchant dispute resolution (intake only).

---

## Rationale

### Specification Structure

#### Layered Approach
The specification follows a **top-down decomposition** from vision to implementation:

1. **High-Level Objective** (North star): One-sentence description of user/business outcome with clear scope boundary. This ensures all stakeholders understand the purpose without getting lost in details.

2. **Mid-Level Objectives** (Observable outcomes): Six testable objectives that answer "what changes in the world when this succeeds?" Each objective is measurable and can be independently verified (e.g., "Users can freeze cards" is verifiable by attempting a freeze operation and checking the result).

3. **Non-Functional Requirements** (How well/safely): Explicitly separated into Security, Privacy, Audit, Reliability, and Performance sections. This prevents non-functional requirements from being implicit or vague ("should be fast"). Instead, specific targets are defined (p95 < 500ms for card creation).

4. **Implementation Notes** (Guardrails): Detailed rules for data handling (Decimal for money, PAN masking, idempotency) that an AI agent or developer must not violate. These prevent common mistakes like using `float` for currency or logging sensitive data.

5. **Context** (Beginning/Ending state): Explicitly defines what exists before and after implementation. This eliminates ambiguity about whether certain infrastructure (database, auth service) needs to be built or already exists.

6. **Low-Level Tasks** (Executable slices): 20 detailed tasks, each with a specific prompt, file to create/update, implementation details, and acceptance criteria. Each task is small enough to complete in a few hours but large enough to deliver meaningful functionality.

**Why this structure:** It allows both high-level understanding (executives, product managers can read objectives) and deep implementation detail (engineers and AI agents can execute tasks without guessing). Traceability is explicit—every task maps to a mid-level objective.

#### Visual Diagrams for Clarity
The specification includes **3 Mermaid diagrams** for enhanced understanding:
1. **System Architecture Overview** (after High-Level Objective): Shows client, API, business logic, data, and external service layers
2. **State Machine Diagram** (Card Status Transitions section): Visualizes all valid card state transitions with annotations
3. **API Request Flow** (after Context section): Sequence diagram showing complete card creation flow including auth, validation, database transactions, processor integration, and error handling

These diagrams enhance readability and provide visual context for complex flows and state machines.

#### Edge Cases as First-Class Requirements
Rather than relegating edge cases to "implementation details," this specification includes a **12-scenario edge case table** in the main document. Each scenario defines:
- Expected behavior (what should happen)
- HTTP status code (for API errors)
- Audit/compliance impact (how it's logged)

**Why:** Edge cases are where financial systems fail. By making them explicit, we prevent "forgot to handle" errors (e.g., What happens if a user tries to freeze an already frozen card? Answer: 200 OK idempotent response, log duplicate operation).

#### Verification Strategy by Objective
For each mid-level objective, the specification defines **how to verify** it's met:
- Unit tests (what business logic to test)
- Integration tests (what external interactions to verify)
- E2E tests (what user journeys to execute)
- Performance tests (what latency/throughput to measure)

**Why:** This ensures completeness. A specification without verification strategy is aspirational, not actionable. By defining test categories upfront, implementers know when they're "done."

---

### Performance Target Justification

Performance targets are **derived from FinTech industry standards and user expectations**, not arbitrary numbers:

#### Card Creation: p95 < 500ms, p99 < 1000ms
**Rationale:**
- **User Expectation:** Users expect card provisioning to feel instant (< 1 second). Stripe virtual cards provision in ~300ms, setting the industry bar.
- **Technical Breakdown:** Includes database INSERT (10-50ms), payment processor API call (200-400ms), audit log write (10-30ms), and network latency (50-100ms).
- **Why p95/p99:** p50 (median) can be misleading; p95/p99 captures worst-case user experience. 5% of users experiencing >1s latency is acceptable; more would degrade UX.

#### State Changes (Freeze/Unfreeze): p95 < 200ms, p99 < 400ms
**Rationale:**
- **Security Context:** Freezing a card is often a fraud response. Users need immediate feedback to feel secure ("Is my card really frozen?").
- **Technical Simplicity:** State change is a database UPDATE + processor API call, both fast operations. If this exceeds 400ms, it indicates infrastructure issues.
- **Industry Comparison:** Square's card freeze is near-instant (<200ms observed).

#### Transaction Queries: p95 < 300ms for 100 records
**Rationale:**
- **Fraud Review Use Case:** Real-time fraud detection requires fast transaction access. Analysts reviewing suspicious patterns need sub-second response.
- **Technical Approach:** Composite index on `(card_id, timestamp DESC)` + read replica ensures queries don't hit primary database. Pagination limits result set size.
- **Acceptable Trade-Off:** Transaction history can tolerate 5-second eventual consistency (synced from processor), so read replicas with minor lag are acceptable.

#### Spending Limit Updates: p95 < 300ms
**Rationale:**
- **User Experience:** Users changing limits want immediate confirmation. However, limit enforcement can be eventually consistent (< 5s), so this operation is less critical than freeze.
- **Technical Breakdown:** Database UPDATE with version check (optimistic locking) + audit log + eventual consistency propagation to processor.

#### Rate Limiting: 100 req/min per user
**Rationale:**
- **Abuse Prevention:** Prevents brute force attacks, credential stuffing, and runaway client loops.
- **Legitimate Use Case:** 100 requests/minute = 1.67 req/sec, sufficient for normal user interactions. Batch operations (e.g., exporting transactions) should use dedicated endpoints with higher limits.
- **Industry Standard:** GitHub API: 5000 req/hour (~83/min), Stripe: 100 req/sec but with bursting. Our limit is conservative for a user-facing financial API.

**Why Eventual Consistency is Acceptable (< 5s):**
- Limit changes don't need instant propagation to the processor. A 5-second window where old limits are enforced is acceptable because:
  - Fraud scenarios (sudden limit increase before large transaction) are detected by compliance reporting (Task 18: suspicious pattern detection).
  - User UX: Immediate confirmation in UI ("Limit updated") is sufficient; backend propagation can be async.
  - CAP theorem trade-off: Availability (system remains responsive) vs. Consistency (all nodes see same data instantly). We choose availability for non-critical operations.

---

### Verification Depth

#### Why Multi-Level Testing?
A single test type is insufficient for a financial system:

1. **Unit Tests (> 80% coverage for business logic):**
   - **Purpose:** Verify individual functions work correctly in isolation.
   - **Example:** `enforce_spending_limits()` correctly rejects amounts exceeding per-transaction limit.
   - **Limitation:** Doesn't test database transactions, external API interactions, or authorization.

2. **Integration Tests (All database operations, API mocks):**
   - **Purpose:** Verify components work together correctly.
   - **Example:** Card creation writes to database AND generates audit log in same transaction.
   - **Limitation:** Doesn't test complete user journey via HTTP API.

3. **E2E Tests (Critical user journeys):**
   - **Purpose:** Verify end-to-end flows work from API gateway to database.
   - **Example:** POST /v1/cards → 201 Created → GET /v1/cards/{id} returns created card.
   - **Limitation:** Slow (seconds per test), doesn't cover all edge cases.

4. **Performance Tests (2x peak load):**
   - **Purpose:** Verify system meets latency/throughput targets under load.
   - **Example:** 200 cards/second creation for 5 minutes, measure p95/p99 latency.
   - **Limitation:** Doesn't test correctness, only performance.

5. **Security Tests (OWASP Top 10, authorization boundaries):**
   - **Purpose:** Verify system is secure against known vulnerabilities.
   - **Example:** Scan all API responses for full PAN (should find none), attempt to access other users' cards (should get 403).
   - **Limitation:** Doesn't catch all vulnerabilities (zero-days, logic flaws).

6. **Compliance Tests (Audit log completeness):**
   - **Purpose:** Verify regulatory requirements are met.
   - **Example:** Every card operation generates corresponding audit event with required fields.
   - **Limitation:** Doesn't verify legal compliance (requires legal review).

**Why all six types?** Each catches different failure modes. Unit tests catch logic bugs, integration tests catch interaction bugs, E2E tests catch API contract bugs, performance tests catch scalability bugs, security tests catch vulnerability bugs, compliance tests catch regulatory bugs.

#### Test Coverage Philosophy
- **Business logic > 80%:** High coverage because this is where bugs cause financial loss.
- **Overall > 60%:** Lower threshold because testing framework code, getters/setters is low-value.
- **Edge cases explicitly tested:** Boundary conditions (zero, negative, exact limit), concurrency (optimistic locking conflicts), error paths (processor timeout, database unavailable).

**Anti-pattern avoided:** "100% coverage" as a goal. Chasing 100% leads to testing trivial code (e.g., `get_id() { return self.id }`), wasting effort.

---

## Industry Best Practices

This specification incorporates **12 FinTech industry best practices**, each with explicit references to where they appear in the specification documents.

| Practice | Rationale | Specification Reference |
|----------|-----------|-------------------------|
| **PCI DSS Compliance: Never store/log/display full PAN** | Primary Account Number (card number) is sensitive cardholder data subject to PCI DSS. Storing full PAN requires SAQ-D compliance (most rigorous). Tokenization reduces scope to SAQ-A. Masking format (`****1234`) is PCI DSS requirement for receipts/logs. | **specification.md:** "Non-Functional Requirements > Security" section, "Edge Cases" table<br>**implementation-tasks.md:** Task 8 "Define PAN Masking Strategy"<br>**agents.md:** "Domain Rules > PCI DSS Compliance"<br>**CLAUDE.md:** "Security First Principles > Never Expose PAN" |
| **Idempotency: Prevent duplicate operations** | Network retries, client bugs, or user double-clicks can cause duplicate requests. In finance, duplicates mean double charges ($500 charge becomes $1000). RFC 7807 defines idempotency keys. 24-hour window balances storage cost with retry window. `409 Conflict` on same key + different payload prevents malicious key reuse. | **specification.md:** "Implementation Notes > Idempotency" section<br>**implementation-tasks.md:** Task 9 "Specify Idempotency Implementation"<br>**agents.md:** "Domain Rules > Idempotency Required"<br>**CLAUDE.md:** "Coding Patterns > Idempotency Keys" |
| **Audit Logging: Immutable trail for compliance** | Regulatory requirements (SOX, PCI DSS, GDPR Article 30) mandate audit trails for financial operations. Immutability prevents tampering (forensic evidence). 7-year retention is standard for financial records (SEC Rule 17a-4, tax law). Before/after state enables compliance review ("why was this limit increased?"). Structured format (JSON) enables automated querying for suspicious patterns. | **specification.md:** "Non-Functional Requirements > Audit & Compliance" section, Mid-Level Objective #5<br>**implementation-tasks.md:** Task 7 "Specify Audit Logging Requirements"<br>**agents.md:** "Domain Rules > Audit Logging Mandatory"<br>**CLAUDE.md:** "FinTech-Specific Defaults > Audit Logs" |
| **Decimal for Money: Prevent rounding errors** | IEEE 754 floating-point cannot represent 0.1 exactly (0.1 = 0.1000000000000000055...). This causes errors: $0.10 + $0.20 = $0.30000000000000004. In finance, even 1-cent errors compound to regulatory violations and user distrust. `DECIMAL` type uses fixed-point arithmetic (exact). Database `DECIMAL(19,4)` supports $999 trillion with cent precision. | **specification.md:** "Implementation Notes > Data Handling Rules" section<br>**agents.md:** "Domain Rules > Decimal for Money"<br>**CLAUDE.md:** "Coding Patterns > Decimal for All Monetary Calculations" |
| **Optimistic Locking: Handle concurrent operations** | Concurrency is common in APIs (multiple users, browser tabs, race conditions). Without locking, "lost update" problem: User A and B read card (version 1), both update limits, last write wins, one update lost. Optimistic locking: `UPDATE ... WHERE version = 1` fails for second user, returns 409 Conflict. Client re-fetches current state (version 2) and retries. Cheaper than pessimistic locking (no table locks). | **specification.md:** "Implementation Notes > Concurrency Control" section, "Edge Cases" table<br>**implementation-tasks.md:** Task 17 "Specify Concurrent Operation Handling"<br>**agents.md:** "Edge Case Handling > Concurrent Operations"<br>**CLAUDE.md:** "Coding Patterns > Optimistic Locking" |
| **Rate Limiting: Prevent abuse, ensure fair use** | Without rate limiting: Brute force attacks (credential guessing), DDoS (overwhelm server), runaway clients (infinite loops), unfair resource usage (one user consumes all capacity). Sliding window algorithm is more accurate than fixed window (prevents boundary exploitation). 429 response with `Retry-After` header is RFC 6585 standard. Separate read/write limits: reads are cheaper (queries), writes are expensive (transactions, processor calls). | **specification.md:** "Non-Functional Requirements > Performance Targets" section<br>**implementation-tasks.md:** Task 13 "Specify Rate Limiting Strategy"<br>**agents.md:** "Security & Compliance Constraints > Rate Limiting"<br>**CLAUDE.md:** "Security First Principles > Rate Limiting" |
| **Fail Securely: Default deny for authorization** | Security principle: Explicit allow, default deny. Permissive authorization ("allow unless denied") introduces vulnerabilities (forgot to add deny rule). Explicit authorization ("deny unless allowed") forces developers to consciously grant access. Example: Admin role should explicitly list allowed actions, not implicitly get all access. Logging denied attempts enables intrusion detection (10+ failures = brute force attack). | **specification.md:** "Edge Cases" table<br>**implementation-tasks.md:** Task 14 "Define Permission Model"<br>**agents.md:** "Domain Rules > Fail Securely"<br>**CLAUDE.md:** "Security First Principles > Fail Securely" |
| **Privacy by Design: GDPR/CCPA compliance** | GDPR Article 25 requires "privacy by design" (minimize data collection, encryption by default). GDPR Article 17 "Right to Erasure" requires deletion on request (with legal hold exceptions). CCPA requires data export API. 7-year retention is financial regulation (cannot delete immediately), so solution: anonymize `user_id` to `deleted_user` after retention period. Data residency (EU data in EU) is GDPR Article 44 (cross-border transfer restrictions). | **specification.md:** "Non-Functional Requirements > Privacy" section<br>**implementation-tasks.md:** Task 15 "Specify Card Deletion/Closure Logic"<br>**agents.md:** "Domain Rules > Privacy by Design"<br>**CLAUDE.md:** Security principles section |
| **RFC 7807 Errors: Consistent error responses** | Without standard format, API errors are inconsistent ("error": "bad request" vs {"message": "validation failed"}). RFC 7807 Problem Details defines structure: `type` (URL to docs), `title` (human summary), `status` (HTTP code), `detail` (specific explanation), `instance` (request that failed). Machine-readable (`type` URL) enables client logic. Human-readable (`detail`) enables debugging. Extension fields (`invalid_fields`) add context without breaking standard. | **specification.md:** "Implementation Notes > Error Response Format" section<br>**implementation-tasks.md:** Task 11 "Specify Error Handling Standards"<br>**agents.md:** "Code Style > Error Response Format"<br>**CLAUDE.md:** "Common Patterns Reference > API Error Response" |
| **Structured Logging: Operational visibility** | Unstructured logs ("Card card_abc123 frozen by user user_xyz789") are hard to parse/query. Structured logs (JSON with fields) enable automated alerting ("alert if `event=card_frozen` AND `reason=suspected_fraud`"). Context fields (`request_id`, `user_id`, `card_id`) enable tracing (follow request through multiple services). Security: Structure enables automatic PII redaction (remove `email` field from logs sent to third-party aggregator). | **specification.md:** "Edge Cases" table<br>**implementation-tasks.md:** Task 19 "Specify Monitoring and Alerting"<br>**agents.md:** Coding style section<br>**CLAUDE.md:** "Coding Patterns > Structured Logging" |
| **Circuit Breakers: Resilience to external failures** | When payment processor is down, naive retry causes cascading failure: API → processor (timeout 30s) → retry → timeout → retry = 90s blocked thread. Circuit breaker: After 50% error rate, "open circuit" (stop calling processor, return 503 immediately). After 60s, "half-open" (try 1 request). If success, "close circuit" (resume normal). Prevents resource exhaustion, enables graceful degradation (serve cached data, queue writes). | **specification.md:** "Non-Functional Requirements > Reliability" section<br>**implementation-tasks.md:** Task 20 "Define Payment Processor Integration Contract"<br>**agents.md:** "Edge Case Handling > Timeouts"<br>**CLAUDE.md:** Resilience patterns section |
| **Principle of Least Privilege: Minimal necessary permissions** | Security principle: Grant minimum access needed for function. USER role: manage own cards only. ADMIN role: view all cards (read-only, for debugging). COMPLIANCE role: audit logs only (no card access). OPS role: view and modify (for customer support, logged with elevated severity). JWT role claims enable stateless authorization (no database lookup per request). Resource ownership check (`card.user_id == user.id`) prevents horizontal privilege escalation. | **specification.md:** "Non-Functional Requirements > Security" section<br>**implementation-tasks.md:** Task 14 "Define Permission Model"<br>**agents.md:** "Security & Compliance Constraints > JWT Security"<br>**CLAUDE.md:** "Security First Principles > Fail Securely" |

---

### Cross-Cutting Concerns

These practices appear across all three specification documents (specification.md, agents.md, CLAUDE.md) to ensure consistency:

#### Security (PAN Masking, Parameterized Queries, Rate Limiting)
- **Why cross-cutting:** Security failures can occur at any layer (database, application logic, API, UI).
- **Enforcement:** Database views (force masked PAN), ORM (parameterized queries by default), middleware (rate limiting at API gateway), code review checklist (manual verification).

#### Testing (Unit, Integration, E2E, Security, Compliance)
- **Why cross-cutting:** Tests verify specification at all levels (business logic, database transactions, HTTP API, security boundaries, regulatory compliance).
- **Enforcement:** CI pipeline (all tests must pass before merge), coverage tool (reject PRs below 80% business logic coverage), security scanner (automated OWASP Top 10 checks).

#### Audit Logging (Every State Change)
- **Why cross-cutting:** Regulatory requirement, not optional. Must be enforced in agent rules, code patterns, and verification strategy.
- **Enforcement:** Code generation template (include audit log in every state-changing function), integration tests (verify audit log exists), compliance tests (verify all operations logged).

---

## Conclusion

This specification package demonstrates **depth over breadth**: Rather than covering 10 features superficially, it deeply specifies one feature (virtual card lifecycle) with:

- **Traceability:** Every low-level task maps to a mid-level objective, which maps to the high-level objective.
- **Completeness:** Edge cases, verification, and performance are first-class requirements, not afterthoughts.
- **Implementability:** An AI agent or engineering team can execute without guessing, thanks to detailed tasks with acceptance criteria.
- **Industry rigor:** 12 FinTech best practices explicitly incorporated and referenced across specification, agent rules, and Claude Code rules.

The resulting system would be **secure** (PAN masking, encryption, rate limiting), **compliant** (immutable audit logs, GDPR/CCPA support), **reliable** (idempotency, optimistic locking, performance targets), and **maintainable** (structured logging, comprehensive testing, clear documentation).

---

## File Structure

```
homework-3/
├── README.md                  # This file: rationale and best practices
├── specification.md           # Main specification (high → low level)
├── agents.md                  # AI agent configuration and domain rules
└── CLAUDE.md                  # Claude Code specific rules and patterns
```

## Document Sizes

- **specification.md:** ~3,500 words, 800+ lines (main deliverable)
- **agents.md:** ~4,000 words, 470+ lines (comprehensive agent configuration)
- **CLAUDE.md:** ~3,000 words, 530+ lines (detailed coding patterns and rules)
- **README.md:** ~3,000 words (this file)

**Total:** ~13,500 words of specification documentation, significantly exceeding template depth with substantial industry-specific detail.
