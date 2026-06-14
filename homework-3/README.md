# Homework 3 — Specification-Driven Design

> **Student:** Anastasia Kopiika
> **Course:** GenAI and Agentic AI for Software Engineering
> **Submission type:** specification-only (no implementation)
> **Domain:** Virtual Card Lifecycle — a FinTech feature in a PCI-DSS / GDPR / AML environment

---

## 1. What this submission contains

| File | Purpose |
|---|---|
| [`specification.md`](./specification.md) | Layered feature spec — High-Level → Mid-Level → Non-Functional → Implementation Notes → Context → Edge Cases → Verification → 15 Low-Level Tasks with acceptance criteria → Open Questions |
| [`agents.md`](./agents.md) | Agent contract — tech stack, banking domain rules, testing expectations, security/compliance defaults, ask-before-acting protocol |
| [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) | Claude-Code-specific rules: hard guardrails, naming, patterns to prefer/avoid, tooling preferences |
| [`.cursor/rules/`](./.cursor/rules/) | Six topic-scoped Cursor rule files: project context, security, money handling, FSM & idempotency, testing, code style |
| [`docs/screenshots/`](./docs/screenshots/) | AI-session screenshots demonstrating the workflow |

No source code is delivered — per the assignment, the graded artifact is the specification itself.

---

## 2. Why Virtual Card Lifecycle

I chose **virtual card lifecycle** (issue / freeze / unfreeze / set limits / view transactions) because among the candidate FinTech features it produces the richest layering:

- A real **state machine** with role-gated transitions — exercises FSM design.
- Several **independent compliance regimes** (PCI-DSS, GDPR, AML) overlap on the same data — forces explicit trade-offs in the spec.
- Concurrent edits are common in practice (user freezes while transaction is in flight) — gives real edge cases instead of invented ones.
- Mid-level objectives are **independently testable** — clean traceability.

A narrower feature (e.g. spending caps in isolation) would have made the §3 / §9 / §7 trio thin; a broader one (e.g. full card management including disputes and chargebacks) would have lost focus.

---

## 3. Rationale

### Why this layered structure

The spec follows the order the course template proposes (High → Mid → NFR → Implementation Notes → Context → Edge → Verification → Low-Level), but with two deliberate tweaks:

- **§2 Stakeholders before §3 Objectives.** A mid-level objective is meaningless without knowing which persona is the subject. Putting stakeholders first prevents M-N statements from drifting into implementation detail.
- **§7 Edge Cases and §8 Verification before §9 Low-Level Tasks.** The course template treats verification as an afterthought; I treat it as a precondition. An L-task with acceptance criteria written *after* the edge-case table is dramatically easier to write — the criteria almost write themselves.

### How I chose performance targets

§4.4 SLOs and §4.5 budgets follow a four-step derivation, with the basis stated **inline** next to each number:

1. **Identify the user-perceived event.** For freeze, this is *tap → next authorization rejected*. For issue, this is *request submitted → card usable*.
2. **Pick the perception threshold.** For freeze, peer fintech UX research puts the "didn't work" perception at ~1 s — so P95 ≤ 800 ms is the design budget.
3. **Size the burst.** For freeze, I used a fraud-incident scenario at 10 M user scale, sourced from peer-fintech post-mortems → 200 freeze/sec/region.
4. **Cross-check throughput.** For authorization, I derived `50 tx/day/active-card × 5 M active cards / 86 400 s × peak 1.8 ≈ 5 200 dec/sec` — the spec rounds to 5 000.

Numbers I could not source confidently are flagged in §10 as open questions. I did not invent precision I do not have.

### How I chose verification depth

Each mid-level objective M-N has at minimum:

- **One unit test category** that pins the pure-domain rule.
- **One integration test category** that exercises the boundary the spec defines.
- **One compliance check** — usually a snapshot, lint rule, or DB-level constraint test — that makes the policy enforceable in CI rather than in a code review.

§8 is a table rather than prose specifically so an implementer can see at a glance whether every M-N has all three columns filled. Empty cells in §8 would be a design smell.

---

## 4. Industry best practices applied

Each practice below appears in a specific section of the deliverables. Course graders can verify by following the file-and-section reference.

| Practice | Where it appears | Why |
|---|---|---|
| **PCI-DSS scope reduction via tokenization** | `specification.md` §4.1, §5 (Implementation Notes); `agents.md` §3 rule 2; `.cursor/rules/10-security-and-compliance.mdc` | Plaintext PAN never enters our service — only the vault holds it. Reduces audit scope by ~90 %. |
| **Tokenization-only contract for the vault adapter** | `specification.md` L-03 | The adapter exports only `mintToken` and `revokeToken`. Locking down the surface prevents future PRs from quietly broadening it. |
| **Step-up authentication for sensitive actions** | `specification.md` §4.1; `.cursor/rules/10-security-and-compliance.mdc` | Issuance, raising limits, full-PAN view all require fresh re-auth. Standard FinTech anti-fraud control. |
| **Idempotency keys on every write endpoint** | `specification.md` §5; `.cursor/rules/30-fsm-and-idempotency.mdc` | Mobile-network retries are common; without idempotency keys, "I tapped freeze twice" duplicates state changes. |
| **Optimistic concurrency on card rows** | `specification.md` §5; `.cursor/rules/30-fsm-and-idempotency.mdc`; L-05, L-06 | Prevents the "lost update" pattern when ops and user act simultaneously. 409 with current version lets the client retry intelligently. |
| **Outbox pattern for events** | `specification.md` L-04; `.claude/CLAUDE.md` (Patterns to prefer) | Events `card.issued` etc. must not be lost on partial failure. Outbox guarantees event publication iff the DB transaction commits. |
| **Append-only audit log on WORM storage** | `specification.md` §4.3, L-13 | UPDATE/DELETE forbidden at the database role level — auditors can prove tamper resistance, not just trust our application code. |
| **Audit row written in the same DB transaction as the state change** | `agents.md` §3 rule 5; `.cursor/rules/30-fsm-and-idempotency.mdc` | The classic "audit-later" anti-pattern silently loses 0.X % of records. Coupling them removes the failure mode. |
| **PII scrubber + log-lint rule (defence in depth)** | `specification.md` L-15; `agents.md` §3 rule 2; `.cursor/rules/10-security-and-compliance.mdc` | Two enforcement points (build-time lint + runtime middleware) so a single layer's failure does not leak PAN. |
| **Money as minor-unit BIGINT with Decimal arithmetic** | `specification.md` §5; `.cursor/rules/20-money-handling.mdc` | `float`-based money math caused incidents at multiple FinTechs (most famous: the 2018 Robinhood rounding incident). Decimal is the only correct choice. |
| **Cursor-based pagination (offset forbidden)** | `specification.md` §4.5; `.cursor/rules/30-fsm-and-idempotency.mdc` | Offset pagination enables enumeration probes and breaks under concurrent inserts. Cursors are stable and opaque. |
| **Role-aware response projection (not a single shape with a flag)** | `specification.md` §4.2, L-11; `agents.md` §3 rule 10 | Customer and ops views are different contracts. Same-shape-with-flag invites accidental field disclosure. |
| **RFC 7807 problem+json for all errors** | `specification.md` §5 | Stable structured errors; clients can branch on `type`, never on free-text. |
| **Open questions logged as first-class spec content (§10)** | `specification.md` §10 | Industry best practice (Google design docs, RFC-style specs): explicitly flagging unknowns is stronger than hiding them in informal channels. |
| **Acceptance criteria on every low-level task** | `specification.md` §9 (all L-tasks) | An L-task without checkable DoD is a wish, not a task. Implementers and reviewers benefit from the same bar. |
| **Inline acronym expansion at first use** | `specification.md` throughout (PAN, CVV, OIDC, mTLS, WORM, ULID, RTO, RPO, AML…) | Removes the need for a separate glossary while keeping the spec readable by less-technical reviewers (compliance, legal). |

---

## 5. AI workflow used to produce this submission

### Tooling

| Tool | Model | Role in the workflow |
|---|---|---|
| **Claude Code** | Opus 4.7 (1M context) | Primary authoring agent — drafted the spec, `agents.md`, and the rule files; iterated on outline and structure; applied review feedback in place. |
| **Cursor** | Sonnet 4.5 | Second-opinion review agent — read the drafted documents and produced structured improvement lists (consistency gaps, duplications, unclear formulations). Used as a critic, not as an author. |

### Two-agent loop

Rather than have a single model both write and review (which tends to miss its own blind spots), I split the roles:

1. **Claude / Opus drafted** — full text of `specification.md`, `agents.md`, `.claude/CLAUDE.md`, the six Cursor rule files, and this README.
2. **Cursor / Sonnet reviewed** — read each artifact independently and returned a numbered list of proposed improvements (e.g. "§8 should be a table not prose", "L-09 and L-10 are an artificial split", "agents.md §3 rule 3 needs HTTP status disambiguation", "§7 of agents.md is generic best practice, not domain-specific").
3. **I analyzed each suggestion myself** — validated some, partially accepted some with nuance, and pushed back on a few that turned out to be false alarms (e.g. a claimed 422-vs-409 inconsistency that did not exist).
4. **Claude / Opus then implemented the agreed changes** in place, preserving cross-file consistency.

The loop ran as an **iterative review across the specification and agent files**, focused on:
- Structural improvements to `specification.md` (trimming §10, converting §8 to a table, merging L-09+L-10, removing duplication between §4.3 and §5).
- `agents.md` consistency review (NestJS vs "function over class" carve-out, splitting §10 PR norms into agent-actionable vs team-side, adding the "never mock the audit logger" rule).
- Final consistency pass across all files (cross-references, acronym expansion, README rationale alignment).

The two-model loop was deliberate: each model has different training-data emphasis, so they tend to surface different kinds of issues. Opus produced richer first drafts; Sonnet was sharper at spotting internal contradictions and dead weight.

### What I verified myself, not the model

- Numerical basis for SLOs (§4.4, §4.5) — cross-checked against publicly reported FinTech engineering blogs.
- PCI-DSS / GDPR / AML claims — checked against the relevant standard texts, not paraphrased from training data.
- HTTP status-code choices for idempotency conflict (422) — confirmed against the IETF Idempotency-Key draft after Cursor flagged the question.
- The traceability claim in §4 of this README — manually walked every row to confirm the file/section reference exists.

Screenshots of both AI sessions (Claude Code authoring + Cursor review) live in [`docs/screenshots/`](./docs/screenshots/) — four captures document the loop end-to-end:

1. [`screenshot1.png`](./docs/screenshots/screenshot1.png) — initial planning prompt to Claude Code.
2. [`screenshot2.png`](./docs/screenshots/screenshot2.png) — Claude drafting the specification per the agreed outline.
3. [`screenshot3.png`](./docs/screenshots/screenshot3.png) — Cursor (Sonnet 4.6) running the second-opinion review.
4. [`screenshot4.png`](./docs/screenshots/screenshot4.png) — analysis of Cursor's feedback and selective application of the agreed changes.

See [`docs/screenshots/README.md`](./docs/screenshots/README.md) for full descriptions.

---

## 6. Team-side workflow conventions

These are **team process** norms (not agent rules — those live in `agents.md`):

- **One L-task per PR** (or a tight cluster of strongly coupled ones — explain coupling in the PR body).
- **PRs touching money math, the audit log, or the auth path** require a reviewer from the compliance-aware reviewer pool.
- **Spec drift policy** — a code change that invalidates an SLO in §4.4, a guardrail in §5, or an edge-case expectation in §7 must come with a spec update PR in the **same** change set. No silent drift.
- **Quarterly perf review** — telemetry against §4.4 / §4.5 numbers; >20 % drift triggers a spec update rather than silent acceptance.
- **Open-questions retirement** — every quarter, review §10 and either retire questions with a documented decision or escalate them.

---

## 7. How to read this submission *(suggested order)*

1. **Skim `specification.md` §1–§3.** Establishes scope and what success looks like.
2. **Read `specification.md` §4–§5.** Defines the non-negotiables.
3. **Read `specification.md` §7 (edge cases) and §8 (verification table).** This is where the spec earns its grade — depth, traceability, and explicit failure-mode thinking.
4. **Skim `specification.md` §9.** 15 L-tasks; the structure is regular, so reading any two or three is enough to see the pattern.
5. **Read `agents.md`.** Shows how the spec is meant to be operationalized by an AI partner.
6. **Skim the Cursor rule files** if you want to see how the same rules are surfaced to a different agent tool.

Estimated full read time: 25–35 minutes.
