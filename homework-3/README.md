# Homework 3: Specification-Driven Design

**Student:** Кучук Олександр  
**Course:** GenAI and Agentic AI for Software Engineering  
**Task:** Design a specification package for a finance-oriented application

---

## Summary

This submission presents a complete **specification package** for a Virtual Card Lifecycle Management feature — a self-service module that allows bank customers to create virtual payment cards, control their status (freeze/unfreeze), configure spending limits, and review transaction history, all within a regulated banking environment.

No implementation code is included. The deliverable is the specification itself: layered, traceable, and actionable enough for an engineering team or an AI agent to execute without guessing.

### Delivered Files

| File | Purpose |
|---|---|
| `specification.md` | Full layered product specification (682 lines) |
| `agents.md` | AI agent guidelines for this project domain |
| `.cursor/rules/fintech-virtual-card.md` | Cursor IDE rules for FinTech-safe code generation |
| `README.md` | This file — rationale, best practices, author |
| `HOWTORUN.md` | How to read and use this specification package |

---

## Rationale

### Why Virtual Card Lifecycle?

Virtual card lifecycle is a compact but representative FinTech feature: it touches every concern that matters in regulated software — identity, authorization, sensitive data handling, audit trails, real-time payment flows, and compliance retention. It is narrow enough to be fully specified in one document, yet complex enough to demonstrate real decomposition.

### Why This Layered Structure?

The specification follows a deliberate top-down layering:

1. **High-Level Objective** anchors every subsequent decision. When a design question arises ("should we support batch card creation?"), the answer is found here: it falls outside the scope boundary.

2. **Mid-Level Objectives (MO-1 through MO-6)** are phrased as observable outcomes — not as implementation tasks. This separation forces clarity: *what changes in the world* is distinct from *how we change it*. Each MO received a code (MO-1, MO-6) to enable explicit traceability from Low-Level Tasks back to business goals.

3. **Non-Functional Requirements** use specific numbers (p50/p95/p99 latency tables, rate limits, uptime percentage) rather than vague adjectives. In FinTech, "should be fast" is not a contract — "p95 ≤ 500 ms" is. All numbers are labeled as *assumed targets* with reasoning grounded in UX and payment processing realities.

4. **Implementation Notes** capture the decisions that must not be left to the implementer's discretion: `Decimal` over `float`, UTC-only timestamps, cursor-based pagination, fail-closed behavior for audit log outages. An agent without these guardrails will make subtly wrong choices that are expensive to fix post-implementation.

5. **Context (Beginning/Ending)** makes the agent's workspace explicit. Rather than discovering mid-task that an Identity Provider or Card Network Adapter needs to exist, both are declared upfront as hypothetical pre-conditions with defined interfaces.

6. **Low-Level Tasks** are the core execution surface: 16 tasks, each with a single responsibility, explicit artifacts, and acceptance criteria phrased as checkable items. Every task references which MO it serves — closing the traceability loop from business goal to atomic work item.

### How Performance Targets Were Chosen

| Target | Rationale |
|---|---|
| Freeze propagation ≤ 2 s | A customer who freezes a card because it was compromised expects immediate protection. 2 s is a widely-cited threshold for real-time payment system state propagation. |
| Authorization p95 ≤ 200 ms | Authorization sits on the critical payment path. Card network SLAs typically require responses within 300 ms end-to-end; 200 ms leaves margin for network overhead. |
| Card creation p95 ≤ 800 ms | Customer-facing synchronous operation. Nielsen's UX research places 1 s as the limit before users feel the system is "sluggish". |
| Transaction list p50 ≤ 400 ms | Read-heavy, cached-friendly. 400 ms at p50 with cursor pagination is achievable with proper indexing on `(card_id, occurred_at DESC)`. |

### Why Fail-Closed for Audit Log?

A common shortcut is to make audit logging asynchronous and "best-effort" to avoid blocking the primary operation. In a regulated banking context this is unacceptable: if an operation executes without an audit record, compliance cannot reconstruct what happened. The specification mandates that if the audit log writer is unavailable, the primary operation is **rejected**. This is a deliberate, conservative choice that prioritizes regulatory integrity over availability.

### Verification Depth

Rather than a single "test this feature" bullet, the Verification Plan maps each MO to a specific test file and test function name. This serves two purposes: it forces the specifier to think through *how* each objective would be proven, and it gives an AI agent or a QA engineer a concrete starting point rather than an open-ended mandate.

---

## Industry Best Practices Applied

| Practice | Where It Appears in the Spec |
|---|---|
| **PCI-DSS PAN masking** (`**** **** **** XXXX`) | `specification.md` → NFR-3 Security; Implementation Notes → Sensitive Data Rules; `.cursor/rules` → Sensitive Data section |
| **CVV never persisted after provisioning** | `specification.md` → Implementation Notes → Sensitive Data Rules; `agents.md` → Absolute Rules #3 |
| **Decimal arithmetic for money** | `specification.md` → Implementation Notes → Money & Identifiers; `agents.md` → Absolute Rules #4; `.cursor/rules` → Money & Decimals |
| **Optimistic locking for concurrent writes** | `specification.md` → Implementation Notes → Concurrency; TASK-06 Acceptance Criteria; `.cursor/rules` → Database & ORM |
| **Idempotency Keys on mutating endpoints** | `specification.md` → Implementation Notes → Idempotency; NFR-2; TASK-13; `.cursor/rules` → Idempotency |
| **Append-only audit log with 5-year retention** | `specification.md` → MO-5; TASK-04; NFR-4; `agents.md` → Absolute Rules #8 and #9 |
| **Actor ID hashing in audit log (no raw PII)** | `specification.md` → Implementation Notes → Audit Log Rules; TASK-04; `agents.md` → Absolute Rules |
| **Cursor-based pagination** | `specification.md` → Implementation Notes → Pagination; TASK-08; `.cursor/rules` → Pagination |
| **Fail-closed on audit log outage** | `specification.md` → NFR-2 Reliability; Edge Cases → Card Provisioning |
| **Horizontal privilege escalation prevention** | `specification.md` → MO-6; NFR-3; TASK-06 AC; Edge Cases → Security table |
| **ISO 4217 currency codes** | `specification.md` → Implementation Notes → Money & Identifiers; TASK-07 Details |
| **UUID v4 public identifiers** | `specification.md` → Implementation Notes → Money & Identifiers; `agents.md` → Code Style; `.cursor/rules` → Identifiers |
| **Structured error responses with correlation IDs** | `specification.md` → Implementation Notes → Error Semantics; `agents.md` → Error Handling |
| **p95/p99 latency SLOs** | `specification.md` → NFR-1 Performance table; TASK-11 AC (200 ms authorization) |
| **Rate limiting with `Retry-After` header** | `specification.md` → NFR-1 Rate limiting |
| **UTC-only timestamps** | `specification.md` → Implementation Notes → Audit Log Rules; `agents.md` → Absolute Rules #10; `.cursor/rules` → Datetime Handling |

---
