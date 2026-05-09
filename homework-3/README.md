# Homework 3 — Specification-Driven Design

**Student:** Denys Kondrat  
**Course:** GenAI and Agentic AI for Software Engineering

---

## Task Summary

This homework produces a layered specification package for a **virtual payment card lifecycle** feature in a regulated FinTech context. The package includes:

| File | Purpose |
|---|---|
| `specification.md` | Full feature spec: high-level objective, 6 mid-level objectives, NFR/policy, implementation notes, beginning/ending context, 29 edge cases, 34 low-level tasks, and a per-MLO verification table |
| `HOWTORUN.md` | Reader guide: artifact reading order, verification commands |
| `docs/test-strategy.md` | Test-category matrix, fixture catalogue, security grep harness |
| `docs/load-test-plan.md` | Workload model, SLO targets, k6 ramp profile |
| `agents.md` | AI-agent invariants: domain rules, stack conventions, security constraints, test category requirements |
| `.claude/CLAUDE.md` | Claude Code workflow rules: when-to-do-what nudges, naming conventions, what to avoid |
| `.cursor/rules/general.mdc` | Cursor: file structure and naming |
| `.cursor/rules/security.mdc` | Cursor: security and PCI/GDPR workflow triggers |
| `.cursor/rules/fintech.mdc` | Cursor: money types, idempotency, audit-on-mutation pattern |
| `.cursor/rules/testing.mdc` | Cursor: test category requirements and mandatory assertions |

No implementation code is produced. The graded artifact is the specification itself.

---

## Rationale

### Why this structure?

The specification follows a strict 8-section hierarchy: **high-level objective → mid-level objectives → NFR/policy → implementation notes → context → edge cases → low-level tasks → verification**. Each layer answers a different question for the implementer (or AI agent):

- The high-level objective provides the north star and a one-sentence scope boundary — without the boundary, scope creep is invisible until it is too late.
- The six mid-level objectives are phrased as **observable outcomes with acceptance hooks** rather than as feature descriptions. This lets a grader, a QA engineer, or an AI agent independently verify whether each MLO is met — they do not need to infer what "success" looks like.
- The NFR/policy section treats regulatory constraints as first-class targets with citations, not as prose afterthoughts. Every number is either anchored to a public peer SLO or explicitly labelled `[ASSUMED]` with reasoning.
- Implementation notes are guardrails, not hints. The auditor-on-mutation invariant, the Decimal-only money rule, and the fail-closed dependency rules are written as non-negotiable constraints rather than suggestions. An AI agent reading them cannot accidentally comply halfway.
- Edge cases use Layout C (global summary + per-flow detail). The global table answers "is each failure category covered?" and the per-flow tables answer "what exactly happens in flow X when Y goes wrong?" — the two questions a reviewer and an implementer ask respectively.
- Low-level tasks each carry a single MLO reference, a single artifact to produce, and explicit acceptance criteria. This mirrors the "one task per outcome" discipline that makes AI-assisted development predictable.

### How were performance targets chosen?

All targets are either anchored to a named public reference or explicitly labelled `[ASSUMED]` with a one-sentence justification. No number is invented. Examples:

- **Freeze propagation ≤ 2 s p99** is anchored to the ISO 8583 / card-network issuer-response window: Visa and Mastercard require issuers to respond to authorization requests within approximately 2 seconds end-to-end. Post-freeze, the next authorization must reflect the new state within the same window. This makes the freeze SLO the tightest in the system — intentionally, because it is a safety-critical action.
- **p95 < 300 ms for reads** and **p95 < 800 ms for writes** are labelled `[ASSUMED]`. The read target is anchored to "comfortable above the FastAPI + Postgres baseline (≈ 50 ms), with headroom for complex joins at scale". The write target accounts for a processor API round-trip of ≈ 200 ms (consistent with Marqeta/Stripe Issuing class public benchmarks).
- **Availability 99.9 % reads / 99.95 % freeze** are labelled `[ASSUMED]`, reasoned from the safety-critical difference: if the freeze endpoint is down, a cardholder cannot stop a fraudulent transaction.

### Why this verification depth?

The TASKS.md rubric asks for verification as a **first-class part of the spec**. The verification section (§8) was designed to answer three simultaneous questions: (a) what review checkpoint confirms the MLO is correctly implemented? (b) which test categories are required and what do they assert? (c) what fixture shapes do those tests need? This three-column structure lets a developer set up a test suite directly from §8 without re-reading the spec's task section.

Several low-level tasks end with an explicit **Definition of Done** (e.g. "grep for PAN-length numeric strings in log output returns no matches"). These are phrased so an implementer can tick them off without interpretation.

---

## Industry Best Practices — Traceability Map

| Practice | Where it appears |
|---|---|
| **PCI DSS v4.0 SAD prohibition** (Req 3.3 — CVV/CVV2 never stored post-auth) | `specification.md §3` NFR table; `specification.md §7` Task 1.5 (reveal flow), Task 5.1 (audit schema no-CVV constraint); `agents.md §1.1` |
| **PCI DSS v4.0 PAN tokenisation** (Req 3 — raw PAN never at rest) | `specification.md §3` NFR table; `specification.md §4` implementation notes; `agents.md §1.1`; `.cursor/rules/security.mdc` |
| **PCI DSS v4.0 audit log retention** (Req 10.5.1 — 12 months / 3 months immediate) | `specification.md §3` NFR table; `specification.md §7` Task 5.1 (audit schema) |
| **PCI DSS v4.0 log integrity** (Req 10 — protect from modification) | `specification.md §7` Task 5.1 (`REVOKE UPDATE, DELETE`); `specification.md §6.2` edge case E5-2; `agents.md §1.2` |
| **Transactional outbox pattern** (atomic mutation + audit + event emission) | `specification.md §2` MLO-5; `specification.md §4` implementation notes (audit-on-mutation invariant); `specification.md §7` Tasks 5.1, 5.2; `agents.md §1.2`; `.cursor/rules/fintech.mdc` |
| **Idempotency keys on write endpoints** (Stripe-style, UUID v4, 24 h window) | `specification.md §3` NFR; `specification.md §4` implementation notes; `specification.md §7` Task 1.2; `agents.md §2.5`; `.cursor/rules/fintech.mdc` |
| **Append-only audit log** (INSERT-only, DB-level enforcement) | `specification.md §7` Task 5.1; `agents.md §1.2`; `.cursor/rules/security.mdc` |
| **PSD2 Art. 97(1)(c) SCA on high-risk account actions** (risk-based, industry practice) | `specification.md §2` MLO-3 acceptance hook; `specification.md §3` NFR SCA row; `specification.md §7` Task 3.2; `agents.md §7` |
| **NIST SP 800-63B AAL2 / AAL3** (cardholder MFA; hardware key for ops/audit) | `specification.md §3` NFR auth rows; `specification.md §7` Tasks 3.2, 5.3; `agents.md §3.1` |
| **GDPR Art. 17(3)(b) — redaction-in-place under legal-obligation basis** | `specification.md §3` NFR erasure row; `specification.md §7` Task 5.5; `agents.md §7` |
| **GDPR Art. 5(1)(c) data minimisation** (IP masked to /24 in audit log) | `specification.md §7` Task 5.1 schema; `agents.md §1.5`; `.cursor/rules/security.mdc` |
| **Cursor-based pagination** (stable under concurrent inserts; prevents N+1) | `specification.md §7` Task 4.2; `specification.md §3` NFR pagination row |
| **SELECT FOR UPDATE on mutable shared rows** (prevents lost-update anomaly) | `specification.md §7` Tasks 2.2, 3.3; `agents.md §2.3`; `.cursor/rules/fintech.mdc` |
| **Fail-closed on security-gating service failures** (KYC, SCA, fraud engine) | `specification.md §7` Tasks 1.3, 3.2; `specification.md §5` edge cases E1-3, E3-5; `agents.md §5`; `.cursor/rules/security.mdc` |
| **Existence-oracle prevention** (404 not 403 on cross-user access) | `specification.md §6.2` E4-1; `specification.md §7` Task 4.2; `agents.md §3.1`; `.cursor/rules/security.mdc` |
| **Structured logging with no sensitive data** (PCI Req 10, GDPR Art. 5) | `specification.md §7` Task 6.1; `agents.md §1.1`; `.cursor/rules/security.mdc` |
| **Prometheus SLO alerting as code** (alert rules encode NFR targets) | `specification.md §7` Task 6.1; `specification.md §8` MLO-6 verification row |
| **Processor timeout re-POST idempotency** (ghost-card prevention; no GET-by-key endpoint exists at any major processor) | `specification.md §6.2` E1-4; `specification.md §7` Task 1.4; `.cursor/rules/fintech.mdc` |
| **GDPR Art. 25 privacy by design** (defaults configured for least access) | `specification.md §3` NFR privacy-by-design row; `agents.md §7` |
| **PostgreSQL column-level GRANT for surgical GDPR redaction** (`redactor_role` can UPDATE only PII columns on append-only table; `app_role` remains INSERT-only) | `specification.md §4` Audit roles; `specification.md §7` Task 5.1, Task 5.5; `agents.md §1.2`; `.cursor/rules/security.mdc` |
| **Two-table audit model** (committed mutations in `audit_events`; failed attempts in `audit_attempts` via autonomous AUTOCOMMIT connection) | `specification.md §4` Two-table audit model; `specification.md §6.2` E2-3; `agents.md §1.2` |
| **Cursor pagination with filter fingerprint** (SHA-256 of canonical filter params in cursor; `400 CURSOR_FILTER_MISMATCH` on filter drift — prevents silent wrong results) | `specification.md §3` NFR cursor pagination row; `specification.md §7` Task 4.2; `specification.md §8` MLO-4 |
| **Starlette middleware for cross-cutting infrastructure** (idempotency and rate limiting as middleware, not per-route Depends — genuine short-circuit before route invocation) | `specification.md §4` Idempotency; `specification.md §7` Tasks 1.2, 6.4; `agents.md §2.1, §2.5`; `.cursor/rules/fintech.mdc` |
| **FastAPI auth closure factories** (`require_scope` / `require_aal` as parameterised dependency factories; composable with custom JWT claims) | `specification.md §4` FastAPI patterns; `agents.md §2.1`; `specification.md §7` Task 1.3, Task 3.2, Task 5.3 |
| **RFC 8725 JWT algorithm pinning** (allowlist `["RS256","ES256"]`; never derive algorithm from token header; eliminates `alg=none` and HS256/RS256 confusion attacks) | `specification.md §3` JWT algorithm restriction row; `specification.md §4` JWT validation; `agents.md §3.1`; `.cursor/rules/security.mdc` |
| **JWT issuer allowlist** (`ALLOWED_ISSUERS` array, each bound to its JWKS endpoint; `(iss, sub)` identity pair; prevents cross-IdP token acceptance) | `specification.md §3` JWT issuer allowlist row; `specification.md §4` JWT validation; `agents.md §3.1` |
| **Stripe-style webhook replay prevention** (timestamp ±300 s window + event-ID Redis dedup `SET NX` 72 h TTL; eliminates both old-replay and within-window rapid-replay) | `specification.md §3` webhook replay row; `specification.md §4` Webhook replay prevention; `agents.md §3.2`; `.cursor/rules/security.mdc`; `specification.md §7` Task 4.3 |
| **Redis ACL + TLS hardening in PCI context** (Redis 6+ ACL with named users and key-pattern scope; TLS on port 6380; `REDIS_URL` as `SecretStr`) | `specification.md §3` Redis security row; `specification.md §4` Redis hardening; `agents.md §3.6`; `.cursor/rules/security.mdc` |
| **SSRF guard for config-driven outbound URLs** (startup FQDN allowlist + runtime SSRF-safe httpx transport with DNS rebind protection; startup validation alone insufficient) | `specification.md §3` SSRF guard row; `specification.md §4` SSRF guard; `agents.md §3.4`; `.cursor/rules/security.mdc` |
| **Reveal-handle optimistic locking** (version-field `UPDATE … WHERE version=<current>` prevents double-redemption under concurrent requests; SHA-256(handle_id) in storage — raw handle is bearer token, never persisted) | `specification.md §7` Task 1.5; `.cursor/rules/fintech.mdc` |
| **PCI DSS CDE scope declaration** (textual table classifying each component as IN CDE / connected-to / out of CDE; reveal-proxy in CDE; token-only DB out of CDE with QSA-validated segmentation) | `specification.md §5.1` CDE scope table; `specification.md §3` encryption at rest row |
| **AES-256 envelope encryption + HSM-backed KMS** (PCI Req 3.5/3.6 for CDE-scope components; DEK wrapped by CMK; annual rotation; disk-level TDE alone is insufficient) | `specification.md §3` encryption at rest row |
| **GDPR erasure propagation beyond the primary DB** (outbox, Kafka crypto-shredding, log archives, Redis DEL; EDPB 2025 enforcement found most failures in secondary stores) | `specification.md §4` GDPR Erasure Propagation; `specification.md §7` Task 5.5; `agents.md §1.2` |
| **GDPR Art. 35 DPIA mandatory declaration** (four WP248 criteria met; prior-consultation trigger documented; reference to external DPIA document) | `specification.md §3` DPIA row; EDPB WP248 rev.01 |
| **GDPR Art. 15/20 data-subject-rights API** (self-service JSON export endpoint; 30-day SLA; Art. 17(3)(b) partial-refusal response template for legally-retained data) | `specification.md §7` Task 7.1; `specification.md §3` |
| **EMD2 program-manager model declaration** (BIN-sponsor EMI holds authorisation; primary AML/CFT liability on sponsor; operator posture documented to avoid Wirecard-style dependency risk) | `specification.md §1.2` Regulatory Model; EU Directive 2009/110/EC |
| **AML/CFT scope boundary with integration surface** (EU AMLR 2024/1624 / UK MLRs 2017 cited; service emits AML hooks to Kafka for external AML engine; not itself an obliged AML entity) | `specification.md §1` Scope boundary; `specification.md §1.2` Regulatory Model |
| **SSRF-safe HTTP transport task** (Task 6.5 creates `src/http/ssrf_transport.py`; DNS-rebind protection + RFC-1918 rejection; all processor call sites use this transport) | `specification.md §7` Task 6.5; `agents.md §3.4`; `.cursor/rules/security.mdc` |

---

## AI Tools Used

This specification was developed with **Claude Code** (claude-sonnet-4-6, Anthropic) as the primary AI assistant across multiple iterative sessions. Key uses:

- Gap analysis against 21 implementation concerns and 22 legal/security audit findings
- Regulatory research briefs for PCI DSS v4.0, GDPR, RFC 8725 JWT BCP, EU AMLR 2024/1624, EMD2, and EBA AML/CFT guidelines
- Specification writing, cross-artifact consistency checks, and traceability verification across all 7 deliverable files
