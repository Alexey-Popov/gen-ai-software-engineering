# Copilot / AI Instructions — Spending Caps Service

These instructions steer GitHub Copilot, Copilot Chat, and any AI assistant working in this repository. They are project-specific and FinTech-sensitive. The full intent lives in `specification.md` and `agents.md`; this file is the always-on, short-form guardrail. **When in doubt, prefer the safe/regulated default and ask.**

## What this repo is
A .NET 8 / ASP.NET Core service that enforces customer **spending caps** (daily / monthly / per-category) during card authorization. It does **not** own the PAN, balances/ledger, fraud scoring, or settlement.

## Hard rules — never generate code that violates these
- **Never** introduce, store, log, or fixture a PAN, CVV, expiry, or track data. Cards are `cardToken` only. If a suggestion needs the card number, the design is wrong — stop.
- **Money is `decimal`** (`numeric(18,2)` at rest). Never suggest `float`/`double` for amounts. Never do floating-point equality on money.
- **Never do FX conversion.** Caps are single-currency; a currency mismatch is a `CURRENCY_MISMATCH` decline, not a conversion.
- **Counter updates are a signed-delta ledger keyed by `authId`** — not `running += amount`. Reject suggestions that mutate a plain running total.
- **Every counter-mutating call is idempotent** on `(authId, eventType)`. Default to idempotent writes.
- **Fail-mode split:** user caps fail **open**, mandated caps & regulatory holds fail **closed**. Don't collapse them.
- **Audit log is append-only.** Never generate an update/delete against audit tables.
- **An authorization decline returns HTTP 200** with a decision body. 5xx is only for real failures.
- **Never log secrets, tokens, or amounts tied to PII.** Structured templates with a `correlationId`, always.
- **No secrets in code or `appsettings.json`.** Use env vars / secret manager; keep secret config git-ignored.

## Architecture & naming
- Layers: `Api` → `Application` → `Domain` → `Infrastructure`; dependencies point inward only.
- Controllers are **transport-only**: inject `I…Service` interfaces, not `DbContext` or repositories. No mapping or business logic in controllers.
- Map entity→DTO in the **application/service layer**. Never return EF entities from a controller or service.
- DTOs / commands / value objects are `record`s. `Money` is a value object (decimal + ISO-4217 currency).
- Async methods end in `Async`, take `CancellationToken ct` last, and propagate it. No `.Result`/`.Wait()`.
- Use `DateTimeOffset.UtcNow`; compute cap windows in the cap's **IANA timezone**, never server-local.
- Constants over magic numbers; guard clauses over nested `if`s; return `IReadOnlyList<T>`, never `null` collections.

## API conventions
- Versioned `/api/v1`, plural kebab-case nouns, no verbs in paths. State transitions: `POST /caps/{id}/pause`.
- `201 Created` + `Location` on create; `204 No Content` on delete; `409` on optimistic-concurrency conflict.
- One error envelope everywhere: `{ errorCode, message, correlationId }`.

## Data access (EF Core)
- Fluent API only — **no data annotations** on domain entities.
- `AsNoTracking()` + projection to DTO for reads; one `SaveChangesAsync` per unit of work; no `SaveChanges` in loops.
- Explicit `decimal(18,2)` columns; named indexes (`ix_…`); unique index on `(authId, eventType)` and `(capId, windowKey)`; `version` concurrency token.

## Testing
- xUnit + NSubstitute (unit), TestContainers Postgres (integration), `WebApplicationFactory` (API), k6/NBomber (load).
- **Never mock `DbContext`.** Counter concurrency / idempotency / refunds are integration tests against real Postgres.
- Test behavior, not mock call counts. Name tests `Method_Condition_Expected`.
- A feature isn't done until its acceptance criteria (spec §9) have passing tests, including the latency load test (p99 auth-eval ≤ 50 ms).

## What to avoid
- Adding endpoints, abstractions, or dependencies not in the spec.
- "Simplifying" the signed-delta counter, the idempotency check, or the fail-mode split.
- Catching `Exception` and swallowing it; per-controller try/catch (use the global middleware).
- Offset pagination without a max page size (clamp to 100; default 20).

When a request conflicts with a hard rule above, **refuse and explain** instead of generating the code.
