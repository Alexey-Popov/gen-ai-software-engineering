# Homework 3 — Specification-Driven Design

## Student & task summary

**Student:** Dmitry Upatov

**Task:** Produce a *specification package* (documents only, no implementation) for a regulated finance feature. The deliverable is graded on decomposition clarity, traceability from goals → tasks, and how well edge cases, verification, and non-functional expectations are treated as first-class.

**Chosen domain:** **Spending Caps / Limits** — customers set daily, monthly, and per-category spending limits on their account or individual cards; the service enforces them in real time during card authorization, notifies users near their caps, and gives Ops/Compliance override and audit capabilities. Assumed stack: **.NET 8 / ASP.NET Core + PostgreSQL/EF Core**.

**Files in this package:**

| File | Purpose |
|------|---------|
| `specification.md` | Layered spec: high-level → mid-level objectives → non-functional & policy → implementation notes → beginning/ending context → 18 low-level tasks, plus an edge-case table, verification, performance budgets, and a task→objective traceability matrix. |
| `agents.md` | How an AI coding partner must behave in this domain: stack, banking rules, code style, testing/verification, security/compliance, edge-case postures. |
| `.github/copilot-instructions.md` | Always-on, short-form editor/AI guardrails (FinTech-sensitive defaults). |
| `README.md` | This file — rationale and best-practices mapping. |

---

## Rationale — why the spec is written this way

**Why "spending caps" over the virtual-card example.** Caps are deceptively small but force the genuinely hard FinTech problems into the open: a control that lives **on the card-authorization hot path**, **concurrency** (two transactions racing one near-full limit), **idempotency** (duplicate webhooks), **money correctness under reversals/refunds**, **timezone-dependent windows**, and a **regulatory override** layer. That gave more meaningful decomposition and edge cases than CRUD-heavy card lifecycle, while staying small enough to specify fully.

**Layering for "executable without guessing."** Each layer answers a different question — north star (§1), observable *what* (§3 mid-level objectives MO1–MO6), *how well/how safely* (§5), guardrails (§5.4–5.7), workspace (§7), and *executable slices* (§9, 18 tasks). Every low-level task names its mid-level objective and most end with **Acceptance Criteria**, so an implementer or agent can check work off. §10 is a **traceability matrix** proving every objective is built and tested — that closes the goals→tasks loop the rubric asks for.

**How performance targets were chosen.** They are labeled **assumed targets** (§5.1) with a one-line justification each, not vague "should be fast":
- **Auth-eval p99 ≤ 50 ms** because caps is one of several checks inside a card-scheme auth round-trip that the network allows only a few hundred ms — caps must take a small, bounded slice.
- **Usage read eventually consistent ≤ 2 s** but the **enforcement counter strongly consistent within the transaction** — the split reflects that money decisions can't tolerate staleness but a UI "spent so far" number can.
- **≥ 500 auth-eval/s sustained** is sized to a ~1–2M active-card base at typical TPS. The load test (T18) turns these into assertions, so performance is verified, not hoped.

**How verification depth was chosen.** Verification is layered to match risk (§9 T18, `testing.md`): pure logic (window math, cap invariants, decision/fail-mode) at unit level; the money-critical paths (concurrency, idempotency, reversal, cross-window refund, mandated/hold) at integration level **against real Postgres via TestContainers** — never mocked, because that's exactly where correctness bugs hide; transport at API level; and the SLOs in a load test. The edge-case table marks the **`(must test)`** rows so coverage isn't left to judgment.

**The one decision I want a reviewer to notice:** the **fail-mode split** (§5.2). On a service outage, *user* caps fail **open** (don't block legitimate spend over a convenience control) while *mandated caps and regulatory holds* fail **closed** (a regulatory control must never be silently bypassed). Collapsing both to one behavior is the easy wrong answer; the spec, `agents.md`, and the Copilot rules all forbid it explicitly.

---

## Industry best practices — what I added and where it appears

| Best practice | Where in the package |
|---|---|
| **PCI-style data minimization — no PAN in scope** | `specification.md` §5.3, Glossary; `agents.md` §3.1; `copilot-instructions.md` (first hard rule) |
| **Decimal money, never float; single-currency caps, no self-FX** | spec §5.4, edge case E7; `agents.md` §3.2–3.3; copilot rules |
| **Idempotency on `(authId, eventType)`** for all financial mutations | spec §5.5, T8, E2; `agents.md` §3.5 |
| **Signed-delta counter ledger** (correct under reordering, reversals, partial clearing) | spec §4, §5.5, T9, edge cases E3/E4/E5; `agents.md` §3.4 |
| **Explicit failure-mode policy** (fail-open vs fail-closed by control type) | spec §5.2, E11/E12, T10/T12; `agents.md` §3.6 |
| **Append-only, tamper-evident (hash-chained) audit trail** | spec §5.6, MO6, T14; `agents.md` §3.7 |
| **Optimistic concurrency** to prevent lost updates / over-limit double-spend | spec §4, E1/E18, T9; `agents.md` §7 |
| **Resource-based & policy-based authorization** (no raw `userId ==`) | spec §5.3, §6; `agents.md` §6 — sourced from `~/.claude/rules/security.md` S03 |
| **Structured logging + correlation ID, no sensitive data** | spec §5.6; `agents.md` §6 — `logging.md`, `security.md` S04 |
| **Transactional outbox** so notifications never block the auth path or get lost | spec T13, E19 |
| **Reconciliation job** (counters vs. authoritative ledger; surfaces fail-open auths) | spec T16 |
| **SLOs with latency percentiles, throughput, time-to-consistency, rate limits** | spec §5.1, T17, verified in T18 |
| **Testing pyramid; real DB via TestContainers, never mock the DB** | spec T18; `agents.md` §5 — `~/.claude/rules/testing.md` |
| **REST/versioning/error-envelope discipline; controllers transport-only** | spec §6, T7/T11; `agents.md` §4 — `api_design.md`, `error_handling.md`, `microservices.md` |
| **Health checks `/health/live` + `/health/ready`** for safe deploys | spec §7.2, T1 — `infrastructure.md` |

The cross-cutting rubric requirements live **inside the spec**, not only here: **edge cases & failure modes** in §8 (20 rows with expected behavior + audit implication), **verification** woven through §9 acceptance criteria and consolidated in T18, and **performance** as measurable budgets in §5.1 verified by the T18 load test.
