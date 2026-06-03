# agents.md — AI Agent Operating Guide for the Spending Caps Service

This file tells an AI coding partner how to behave when implementing the **Spending Caps service** described in `specification.md`. It is binding. When this file and a task conflict, this file wins for *how* you work; the spec wins for *what* you build. When something is ambiguous, **ask one focused question** instead of guessing — in a regulated payment system, a wrong assumption is a defect.

---

## 1. Mission & boundaries

You are implementing a FinTech control-plane service that enforces customer spending limits during card authorization. You are **not** building card issuance, the PAN vault, the balance/ledger, fraud scoring, or settlement. Stay inside the service boundary in `specification.md §1`. Do not invent integrations the spec does not list (e.g. no self-FX, no direct email sending).

---

## 2. Tech stack assumptions

- **Language/runtime:** C# / .NET 8, ASP.NET Core. `<Nullable>enable</Nullable>` and `<TreatWarningsAsErrors>` in every project.
- **Persistence:** PostgreSQL via EF Core. Fluent API only — no data annotations on domain entities.
- **Validation:** FluentValidation at the application boundary.
- **Testing:** xUnit + NSubstitute for unit; **TestContainers (real Postgres)** for integration; `WebApplicationFactory` for API/contract; a load harness (k6/NBomber) for the latency SLOs.
- **Layout:** `Api` (transport) → `Application` (use cases, DTOs, validation, mapping) → `Domain` (entities, value objects, invariants) → `Infrastructure` (EF, outbox, audit, jobs, time). Dependencies point inward only.
- Reuse the global engineering rules in `~/.claude/rules/*` (csharp-conventions, api_design, dto_mapping, error_handling, logging, security, database, microservices, testing, infrastructure). Do not restate them — follow them.

---

## 3. Domain rules the agent must never violate (banking)

1. **No PAN, ever.** The card is referenced only by `cardToken`. Never add a field, log line, DTO, or test fixture containing a card number, CVV, expiry, or track data. If a task seems to need the PAN, stop and flag it — the design is wrong.
2. **Money is `decimal`.** Never `float`/`double` for amounts. At rest `numeric(18,2)`. No floating-point comparisons on money.
3. **No self-FX.** Caps are single-currency; measure against the gateway-supplied billing-currency amount. Currency mismatch is a decline (`CURRENCY_MISMATCH`), not a conversion.
4. **Counters are a signed-delta ledger keyed by `authId`**, never blind `+=`/`-=`. This is what makes reversals, partial clearings, and out-of-order events correct. Do not "optimize" it into a mutable running total.
5. **Idempotency is mandatory** on every counter-mutating operation, keyed on `(authId, eventType)`. Prefer idempotent writes by default.
6. **Fail-mode split is law (spec §5.2):** user caps fail **open**; mandated caps and regulatory holds fail **closed**. Never make all caps fail the same way "for simplicity."
7. **Audit is append-only.** Never write an `Update`/`Delete` path against the audit table. Audit rows are written in the same transaction as the change they describe.
8. **Authorization decline is a 200 business outcome**, not an HTTP error. Reserve 5xx for genuine failures (which trigger the fail-mode at the gateway).
9. **Authorization is on the hot path.** Respect the latency budget (p99 ≤ 50 ms, spec §5.1). No N+1 queries, no synchronous calls to slow dependencies, no blocking on async, no per-auth notification sends (use the outbox).

---

## 4. Code style & conventions

- Records for DTOs/commands/value objects; `Async` suffix + `CancellationToken ct` last and propagated; guard clauses over nesting; `IReadOnlyList<T>` returns; constants over magic values; `DateTimeOffset.UtcNow`, never `DateTime.Now`. (All per `csharp-conventions.md`.)
- Controllers are transport-only: inject service interfaces, not `DbContext`/repositories. No mapping or business logic in controllers. (`microservices.md` RULE-01/04/05, `dto_mapping.md`.)
- Mapping entity→DTO happens in the application/service layer only.
- API: `/api/v1`, plural kebab-case nouns, state transitions as `POST /caps/{id}/pause`, 201+`Location` on create, 204 on delete, single error envelope. (`api_design.md`, `error_handling.md`.)
- EF reads: `AsNoTracking` + projection to DTO; one `SaveChangesAsync` per unit of work; named indexes; explicit decimal types. (`database.md`.)

---

## 5. Testing & verification expectations

- **Test behavior, not implementation.** Assert outcomes (decision, counter value, status code), not mock call counts.
- **Never mock the database in unit tests.** Counter concurrency, idempotency, and EF mapping are integration tests against real Postgres via TestContainers.
- Mandatory coverage (the `(must test)` rows in spec §8): E1 no double-spend under concurrency, E2 idempotent replay, E3 reversal restores counter, E5 cross-window refund, E7 currency mismatch, E8 lower-below-usage, E10 mandated minimum, E11 regulatory hold, E12 fail-mode split, E15 input validation.
- Every low-level task with **Acceptance Criteria** is "done" only when those criteria have passing tests.
- The load test must assert the spec §5.1 budget (p99 auth-eval ≤ 50 ms at ≥500/s) — performance is a test, not a hope.
- Test names: `Method_Condition_Expected`.

---

## 6. Security & compliance constraints

- Authenticate every endpoint; authorize customer endpoints to the **owning customer** via resource-based checks (never raw `userId ==`). Ops endpoints require an Ops/Compliance policy. (`security.md` S02/S03.)
- Validate all inbound data before any business logic (S01).
- No secrets in code/config; env vars / secret manager only (S06). `.env`/`appsettings.*.json` with secrets are git-ignored.
- HTTPS/mTLS; authenticate the gateway→caps service-to-service call (S07/S02).
- DTOs are whitelists — never return entities, never leak internal fields (S05).
- **Logging:** structured templates only, `correlationId` on every entry, never log amounts tied to PII beyond compliance need, **never** log card data or tokens at `Information`+. Declines at `Information`, fail-open degradations at `Warning`, unexpected at `Error`. (`logging.md`, `security.md` S04.)

---

## 7. How to treat edge cases (default postures)

- **When unsure whether an event is a duplicate → assume it might be.** Make the write idempotent; don't rely on "it won't happen twice."
- **When a counter would go negative → don't.** Re-examine which window the delta belongs to (cross-window refund, E5) before clamping.
- **When two writers race → use optimistic concurrency** (`version`); the late writer gets 409 and refetches. Mandated/ops changes win on retry.
- **When a dependency is down → apply the fail-mode split**, log it, and emit it for reconciliation. Never silently swallow.
- **When timezone/DST is involved → compute in the cap's IANA timezone**, not UTC and not the server's local zone.
- **When input is invalid → reject the whole operation** (`VALIDATION_FAILED` + field errors); no partial state.
- **When a regulatory control conflicts with a user preference → the regulatory control wins**, always.

---

## 8. Working agreement

- Make the smallest change that satisfies the task and its acceptance criteria; do not add unrequested abstractions, patterns, or endpoints.
- Build bottom-up in the T1→T18 order unless told otherwise; keep each task's deliverables traceable to its mid-level objective (spec §10).
- Branch/commit per `~/.claude/rules/git.md` (ask for the Jira ticket if not given; never commit to `main`).
- If a requested change would violate a rule in §3, **refuse and explain** rather than implement it. The cost of a quiet violation in a regulated payment path is far higher than a clarifying question.
