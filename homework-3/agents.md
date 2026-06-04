# 🤖 agents.md — AI Agent Operating Manual (Virtual Card Lifecycle)

> This file tells any AI coding partner (Claude Code, Copilot, Cursor, etc.) **how to behave** in
> this repository. It is binding. When this file and a prompt disagree, **follow this file and ask**.
> It complements [`specification.md`](./specification.md) (the *what*) and the Claude Code rules in
> [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) (the *where*). This file is the *how*.

---

## 1. Mission & boundaries

- You implement the **Virtual Card Lifecycle** feature per `specification.md` (§8 tasks).
- **Stay in scope.** You **push controls** to an external processor and **consume** its webhooks.
  You do **not** build authorization, settlement, ledger, or KYC. If a task seems to require it,
  stop and flag it.
- The **graded/primary contract** is the spec. Do not invent requirements; trace every change to a
  Mid-Level Objective (M1–M8) or a Non-Functional requirement (§5).

## 2. Tech-stack assumptions

- **Language/runtime:** TypeScript on Node.js (`strict` mode on). **Framework:** NestJS/Express.
- **Datastore:** PostgreSQL (migrations in `db/migrations/`, forward-only, reversible where feasible).
- **Tests:** Jest. **Contracts:** OpenAPI + JSON Schema in `contracts/`.
- **Async:** event bus for audit/notifications; webhook consumer for processor events.
- The stack is an **assumption** — if asked to switch (e.g. Python/FastAPI), keep every rule below;
  only the idioms change. Money-as-integer-minor-units and no-PAN rules are **non-negotiable** in any stack.

## 3. Domain rules (banking / PCI) — non-negotiable

1. **Never log, persist, or return a PAN or CVV.** We hold only `pan_token`, `last4`, brand, expiry.
   No `pan`/`card_number`/`cvv` columns, fields, log lines, error messages, traces, or fixtures.
2. **Money = integer minor units + ISO-4217 currency.** Never `float`/`number` for money. Do math in
   minor units; format only at the presentation edge. Reject mixed-currency operations.
3. **Idempotent writes by default.** Every mutating endpoint requires an `Idempotency-Key`; replays
   return the original result (spec §6.2, T3).
4. **Optimistic concurrency** on every mutation via `expected_version`/`If-Match`; stale ⇒ `409` (T16).
5. **Append-only audit, in the same transaction as the change.** No transition is "done" without its
   audit record. Never `UPDATE`/`DELETE` audit rows (T10).
6. **Reason codes required** on freeze/close/replace and limit changes.
7. **RBAC, least privilege, default-deny; tenant isolation** — cross-tenant access is `404`, not `403`
   (T13, EC6).
8. **Dual control** to lift a compliance/fraud freeze and for privileged PII reveal (T12).
9. **Time is UTC ISO-8601** everywhere.
10. **Verify webhook signatures**; dedupe by event id; tolerate out-of-order delivery (T15).

## 4. Code style

- Follow the existing repo lint/format config; match surrounding code (naming, structure, comments).
- **Naming:** `card_id`, `amount_minor`, `pan_token`, `freeze_reason`, `closure_reason` — use the spec's
  vocabulary verbatim so the code, contracts, and audit events line up.
- **Errors:** throw typed `AppError`s mapped to the stable catalog (T17). Never expose stack traces,
  secrets, PAN/CVV, or raw downstream errors to clients.
- **Functions:** pure domain logic (state machine, money, validators) separated from I/O; keep the
  Standard Mutation Contract (spec §6.1) in one place and reuse it.
- **No dead/speculative code.** Implement what the task's Acceptance Criteria require.

## 5. Testing & verification expectations

- For **every** task you implement, add/extend tests in the categories named in spec §10.1.
- **Mandatory tests:** every state transition (100% of T1's table), each negative/edge case in §9 you
  touch, idempotency replay, concurrency race (EC3), cross-tenant `404` (EC6), and a no-PAN-in-logs
  assertion for any code path you add.
- **Coverage:** keep overall ≥ 85% lines; do not lower it. A task is **not done** until its
  Acceptance Criteria are demonstrably checkable by a test or a documented manual step.
- Use **synthetic test BINs only** (e.g. `4242…`). Never put a real/Luhn-valid issuer PAN in fixtures.
- Validate handlers against `contracts/` (contract tests) — schema and code must not drift.

## 6. Security & compliance constraints

- Secrets come from the secret manager — never hard-code or commit them; never add a real secret to a
  test or fixture.
- Enforce TLS in transit and encryption at rest assumptions; don't weaken them for convenience.
- Treat the **audit log as evidence**: tamper-evident, append-only; if you can't emit the audit
  record, fail the operation.
- Respect retention/erasure (T18): erasure = anonymize while preserving audit-chain integrity.
- Keep PCI scope minimal: do not introduce any new component that would touch a raw PAN.

## 7. How to treat edge cases & ambiguity

- **Default-deny** on any ambiguous permission decision.
- **Fail-closed** for anything that protects money: if a freeze's control-push can't be confirmed,
  mark it *pending/not-effective* (spec §5.4, EC16) — never report a protection as active when it isn't.
- **Idempotency first:** assume every request may be retried; design the write so a retry is safe.
- **Don't silently widen scope.** If correct behavior needs authorization/settlement logic, stop and surface it.
- **Always state the compliance implication** of a change in your PR description (what gets audited,
  what a regulator would expect). Mirror the §9 table's "audit/compliance implication" column.
- When unsure between two reasonable behaviors, pick the one with the **stronger audit trail** and ask.

## 8. Workflow conventions

- **Do NOT `git commit` or `git push` unless the user explicitly asks.** Make the file changes and
  stop; let the user review and commit. (Standing rule for this project.)
- Work task-by-task (spec §8). Reference the task id (e.g. `T5`) and objective (`M2`) in commits/PRs
  *when the user asks you to commit*.
- Keep changes minimally scoped to the task; don't bundle unrelated refactors.
- If you must deviate from the spec, propose the change and the reason first — the spec is the contract.
- Prefer extending existing utilities (state machine, money, error catalog, SMC) over re-implementing.

## 9. Definition of Done (per task)

- [ ] All Acceptance Criteria in the spec task are met and test-backed.
- [ ] Domain rules §3 upheld (no PAN/CVV, money minor units, idempotent, audited, RBAC, UTC).
- [ ] Tests added per §5; coverage not reduced; contracts validated.
- [ ] No secrets/PAN in code, logs, errors, or fixtures.
- [ ] Compliance implication noted; traceable to an M# objective.
- [ ] **Not committed/pushed** unless the user asked.
