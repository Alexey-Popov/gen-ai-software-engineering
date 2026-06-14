# agents.md — AI Agent Guidelines for Virtual Card Lifecycle

> How an AI coding agent should behave while implementing `specification.md`. When this file and a generic best practice disagree, this file wins for this codebase.

---

## 1. Source of truth

- The spec is `specification.md` in this directory.
- If the spec is unclear, **ask before coding**. Guessing in a regulated environment is how compliance findings happen.
- A code change that invalidates an SLO or a §5 guardrail must come with a spec update in the same PR.

---

## 2. Tech stack assumptions

Default to:
- **TypeScript** (Node.js LTS) for service code; **SQL** for migrations.
- **Fastify** (or NestJS, project-level decision — do not switch silently).
- **PostgreSQL** with a migration tool (Flyway, Sqitch, or node-pg-migrate).
- **Managed pub-sub** (Kafka / NATS / cloud-native); outbox pattern for events that must not be lost.
- **Redis-compatible** cache.
- **KMS-backed secrets** — never `.env` files in source control.
- **`decimal.js` or `dinero.js`** for money — never `number`.
- **ULID** for new entity ids.
- **Zod** (or equivalent) for validation at every external boundary.

If the user picks a different stack, ask which defaults change before writing code.

---

## 3. Banking domain rules (non-negotiable)

These are hard constraints, not preferences:

1. **Money is Decimal.** Never `float`. Always paired with an ISO 4217 currency code.
2. **PAN / CVV / expiry / magstripe never logged, returned, or cached outside the PCI zone.** Only `last_four` and the vault token cross the boundary.
3. **All writes are idempotent.** Every state-changing endpoint accepts `Idempotency-Key`. Same key + different body is 422.
4. **All state changes go through the FSM.** Direct UPDATE on the card row's `state` is forbidden.
5. **State change + audit row in the same DB transaction.** No "add audit later" PRs.
6. **Optimistic concurrency on card rows.** A write without a version check is a defect.
7. **Step-up auth gates sensitive actions** (issuance, raising limits, full-PAN view).
8. **Time is UTC.** Local-time arithmetic is a bug.
9. **Errors are RFC 7807 problem+json.** No stack traces or internal hostnames on the wire.
10. **PII minimization** — ops and customer views are different shapes, not one shape with a feature flag.

---

## 4. Code style

- TypeScript strict mode. `any` is a code smell — if used, an inline comment must justify it.
- Named exports, not default exports.
- Function over class unless lifecycle/state demands it, **or** the project uses NestJS — its DI container is class-based by design and that idiom wins inside NestJS modules.
- Pure domain logic in `domain/`; IO in `integrations/` or `api/`. Domain imports zero IO.
- One responsibility per file.
- Comments explain **why**, never **what**. Code that needs a "what" comment should be renamed.
- No dead code or commented-out blocks — use git history.
- No future-proofing — the spec is the requirements.

---

## 5. Testing expectations

Per mid-level objective in `specification.md` §8:

| Type | Where it lives | What it covers |
|---|---|---|
| **Unit** | `domain/` | Every pure function; FSM transitions exhaustive; money arithmetic |
| **Integration** | Ephemeral DB + vault stub | Every endpoint, green path plus the §7 edge cases — with a **real** audit logger |
| **Contract** | Event payloads & outbound HTTP | Pinned schemas that fail when the shape changes |
| **Redaction snapshot** | Role-varying responses | Customer-view and ops-view snapshots; CI fails on any PAN-shaped string |
| **Property-based** | Money and limit derivation | `fast-check` or equivalent |
| **Performance** | The four SLO surfaces (§4.4) | Perf-bed tests; blocking pre-release |
| **Chaos** | `tests/chaos/` | Freeze-during-auth, cache-failover scenarios |

**Never mock the audit logger in integration tests.** Audit completeness is a verifiable property of the system; mocking it hides exactly the failure mode auditors look for. Run against the real WORM-backed table (ephemeral or container-isolated).

Coverage is outcome-driven. A 90 % coverage suite that misses E-2 is worse than 80 % coverage that covers all §7 rows.

---

## 6. Security and compliance defaults

- **Threat model** — an attacker with a stolen session cookie trying to exfiltrate card data or move money. Step-up auth + idempotency keys are the primary mitigations.
- **PCI zone** — plaintext PAN runs only in the vault. Our service must pass a PCI scoping review by showing PAN cannot reach our processes.
- **Audit completeness** — auditors will randomly sample 30 days and expect every customer-visible state change to map to an audit row. Untraced state changes are a finding.
- **GDPR Art. 17** — distinguish pseudonymization (default) from hard delete (only the card row's PII columns; never the audit log).
- **Secrets in PRs** — if asked to add a secret to any file, even an example, refuse and suggest KMS instead.

---

## 7. Edge-case handling

- **Prefer idempotent writes.** If a write cannot be safely replayed, document why; the idempotency key is the safety net.
- **Never swallow errors.** `catch (e) {}` without a comment is a review block.
- **Reject empty input loudly.** Missing required fields are 422, not "treated as default".
- **Never leak existence.** A 404 for unknown and a 403 for unauthorized must be indistinguishable to a network observer when the threat model demands it.
- **Concurrency races are not bugs to hide.** They are explicit FSM-conflict responses with a documented retry strategy.

---

## 8. When to ask the user

Mandatory clarification before coding:

- The relevant spec value is flagged in §10 as an open question, or marked inline as an assumed target, and the answer affects implementation.
- The user asks for behavior that contradicts a §3 rule above.
- The user asks to skip step-up auth, logging, or audit "to ship faster".
- A third-party contract is unclear and the spec does not pin it.
- A library upgrade changes observable behavior in a regulated path.

The cost of pausing is small. The cost of guessing in a regulated codebase is large.

---

## 9. What the agent must not do

- Generate, log, or echo PANs / CVVs / expiries in any context, including comments and fixtures (use obvious fakes like `4242 4242 4242 4242`).
- Add backwards-compatibility shims when the spec says behavior changes.
- Introduce a new dependency without a one-line PR note explaining why stdlib or existing deps cannot do the job.
- Bypass hooks or CI with flags like `--no-verify`.
- Submit code that has not been run locally at least once when local execution is possible.

---

## 10. Commit and PR norms *(agent-actionable)*

What the agent itself produces on every change:

- **Commit subject** references the L-XX (or M-X) it implements — e.g. `feat(card-lifecycle): L-06 freeze and unfreeze endpoints`. Imperative tense.
- **PR body** lists which `Acceptance criteria` from the L-task are checked off and which §7 edge cases the change exercises.
- Never amend a pushed commit — append a new one.

Team-side workflow norms (one L-task per PR, reviewer routing for money / audit / auth paths) live in the project `README.md` — they are the team's process, not the agent's responsibility.
