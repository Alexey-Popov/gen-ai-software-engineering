# CLAUDE.md — Project rules for Claude Code

> Loaded automatically by Claude Code when working in this repo. Defines defaults specific to the Virtual Card Lifecycle codebase. See `specification.md` for *what* to build and `agents.md` for the broader agent contract; this file is the Claude-Code-specific overlay.

---

## Project context

You are working on the **Virtual Card Lifecycle** service — a FinTech feature in a regulated environment (PCI-DSS, GDPR, AML).

- Spec: `specification.md` (source of truth for behavior).
- Agent contract: `agents.md` (banking domain rules, testing, security defaults).
- The README explains rationale and traceability.

Before changing code, locate the relevant L-task in `specification.md` §9 and reference it in the commit / PR.

---

## Hard rules — never violate

1. **No PAN / CVV / expiry / magstripe in any code, comment, test fixture, log, error message, or commit message.** Use obvious fakes (e.g. `4242 4242 4242 4242`) when a placeholder is needed.
2. **No `float` / `double` for money.** Use a Decimal library and store amounts as minor units in `BIGINT`. Always pair with an ISO 4217 currency code.
3. **No direct UPDATE on `cards.state`.** The FSM module is the only writer.
4. **No state change without an audit row in the same DB transaction.**
5. **No `--no-verify`, no `--no-gpg-sign`, no bypassing CI checks.**
6. **No secrets in source.** If a value looks like a secret (API key, signing key, vault token), refuse to add it and propose KMS.

---

## Naming

- Files: `kebab-case.ts` for modules, `PascalCase.ts` only for files exporting a single class.
- Domain types: `PascalCase`. Constants: `SCREAMING_SNAKE_CASE`. Functions and variables: `camelCase`.
- Endpoint handlers: `{verb}{Resource}Handler` (e.g. `freezeCardHandler`).
- Money fields in DB end with `_minor` (e.g. `daily_cap_minor`).
- Audit-log fields match `specification.md` §4.3 exactly — do not invent variants.

---

## Patterns to prefer

- **Pure domain logic in `services/card-lifecycle/domain/`** — no IO imports there.
- **Validation at boundaries** via Zod (or equivalent). Reject early, with structured `problem+json`.
- **Outbox pattern** for events (`card.issued`, `card.frozen`, etc.). Write to outbox in the same DB transaction; relayer publishes async.
- **Idempotency** — every write endpoint accepts and enforces `Idempotency-Key`. 24-h dedup; same key + different body → 422.
- **Optimistic concurrency** via a `version` column. Mismatch → 409 with current version in the response.
- **Cursor pagination** with opaque, encrypted cursors. Hard cap 200 items/page. **Never offset pagination.**
- **Step-up auth** for sensitive actions (issuance, raising limits, full-PAN view) — see §4.1 of spec.

---

## Patterns to avoid

- Default exports — use named exports.
- `any` without a justifying inline comment.
- Empty `catch` blocks.
- Comments that describe **what** the code does. If the code needs that explanation, rename it.
- Backwards-compatibility shims when the spec says behavior changes.
- New dependencies without a one-line justification in the PR.
- "Helpful" abstractions for hypothetical future requirements.
- Logging objects whose keys include `pan`, `cvv`, `card_number`, `expiry`, or `magstripe` (case-insensitive). The CI lint rule from L-15 will fail; do not bypass it.

---

## When to ask before acting

Ask for clarification rather than guessing when:

- The relevant spec value is flagged in §10 as an open question.
- The user requests behavior that contradicts a hard rule above.
- A library or stack choice differs from `agents.md` §2.
- The change touches money math, audit log, or auth path and the L-task does not exist yet.

---

## Testing expectations for any PR

Per the L-task being closed, deliver:

- Unit tests for any new domain function.
- Integration test for any new endpoint covering the green path + at least one §7 edge case.
- Redaction snapshot test for any response that varies by role.
- Updated contract test for any changed event payload.

A PR that closes L-XX must tick every `Acceptance criteria` checkbox from the spec in its description.

---

## Commit / PR norms

- One L-task per PR (or a tight cluster — explain why in the body).
- Commit subjects: `feat(card-lifecycle): L-06 freeze and unfreeze endpoints`. Tense: imperative.
- PR body lists: which acceptance criteria are met, which §7 edge cases the change exercises, and which mid-level objective(s) it advances.
- PRs touching money math, audit log, or auth path tag a compliance-aware reviewer.
- Never amend a pushed commit — append a new one.

---

## Tooling preferences in this repo

- Prefer the `Edit` tool over `Bash sed/awk` for file changes.
- Prefer `Read` over `cat` / `head` / `tail`.
- When exploring an unfamiliar area, spawn an `Explore` agent rather than running many sequential greps in the main thread.
- Long-running tasks (full test suite, perf bed) → run in background and poll.
