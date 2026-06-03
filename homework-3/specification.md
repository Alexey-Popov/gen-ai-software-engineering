# Spending Caps Service — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives. Treat the Non-Functional & Policy section and the Edge Cases table as hard constraints, not suggestions. When a task lists Acceptance Criteria, that is its Definition of Done.

---

## 0. Glossary (read first)

| Term | Meaning in this spec |
|------|----------------------|
| **Cap** | A user- or ops-defined spending limit rule. Has a *scope*, *type*, optional *category*, *amount*, *currency*, *status*. |
| **Scope** | What the cap applies to: `Account` (all cards of a customer) or `Card` (one card token). |
| **Type** | The window the cap resets on: `Daily`, `Monthly`, or `Category` (a category cap is itself daily or monthly — see §4). |
| **Window** | The time interval a cap measures spend over (e.g. one calendar day in the customer's timezone). |
| **Counter** | The cumulative *authorized-and-not-reversed* spend attributed to a cap inside its current window. |
| **Authorization (auth)** | A request from the card-processing gateway asking "may this transaction proceed?" carrying an idempotent `authId`. |
| **Reversal / refund** | A later event that releases or returns funds, decrementing a counter. |
| **Mandated cap** | A cap imposed by Ops/Compliance that the customer cannot raise or remove (regulatory or risk-driven). |
| **Card token** | Opaque reference to a card. **The PAN never enters this service.** |

---

## 1. High-Level Objective

- Build a **Spending Caps service** that lets customers set and manage spending limits (daily, monthly, and per-category) on their account or individual cards, enforces those limits in real time during card authorization, and gives internal Ops/Compliance the visibility and override controls required in a regulated environment.

**Scope boundary (one sentence):** This service owns cap rules, per-window spend counters, cap-threshold notifications, and the authorization *decision for caps only*; it does **not** own card issuance, the PAN, balances/ledger, fraud scoring, or the final clearing/settlement pipeline — it consumes events from those systems.

---

## 2. Stakeholders & Primary Use Cases

| Stakeholder | Needs |
|-------------|-------|
| **End-user** | Create/edit/pause/delete own caps; see live usage vs cap; receive a notification before they hit a cap. |
| **Ops / Compliance** | View any customer's caps and usage; set a **mandated minimum cap** or **regulatory hold**; review an immutable audit trail of who changed what and when. |
| **Card-processing gateway** (system actor) | Get a fast, deterministic approve/decline for caps at authorization time; report reversals/refunds/clearings back. |
| **Fraud** (read-only consumer) | Subscribe to "cap breached" / "cap changed" events as a risk signal. |

---

## 3. Mid-Level Objectives (the testable "what")

Each objective is observable — it states what changes in the world when the feature succeeds. Low-level tasks (§9) reference these IDs.

- **MO1 — Cap management.** A customer can create, read, update, pause/resume, and delete caps of type Daily, Monthly, and Category, scoped to Account or Card. Observable: after a successful create, the cap appears in the customer's cap list and starts being enforced on the next authorization.
- **MO2 — Real-time enforcement.** For every authorization, the service evaluates **all applicable caps** and returns a single `Approve`/`Decline` (with a machine-readable reason) inside the latency budget (§5). Observable: a transaction that would push any applicable cap over its limit is declined with `CAP_EXCEEDED`; one that fits is approved.
- **MO3 — Accurate counters.** Per-cap, per-window spend is tracked **atomically and idempotently**, and correctly decremented by reversals, partial clearings, and refunds. Observable: replaying the same `authId` does not double-count; a full reversal returns the counter to its pre-auth value; a refund into a closed window does not corrupt the current window.
- **MO4 — Proactive notifications.** When cumulative spend crosses configurable thresholds of a cap (default 80% and 100%), the customer is notified exactly once per threshold per window. Observable: an event/notification is emitted at the crossing and not re-emitted on subsequent spend within the same window.
- **MO5 — Ops/Compliance control.** Ops can view any customer's caps/usage, impose a **mandated cap** (which the customer cannot raise/remove) and a **regulatory hold** (which declines all spend regardless of caps), and these always win over user-set caps. Observable: a user attempt to raise a cap above a mandated ceiling is rejected; a held account declines every authorization.
- **MO6 — Auditability.** Every cap change and every authorization decision is recorded in an **append-only, tamper-evident** audit log with actor, timestamp, before/after, and correlation ID, queryable by Ops. Observable: a compliance reviewer can reconstruct the full history of any cap and the reason for any decline.

---

## 4. Domain Model (conceptual — no code here, see §9 for implementation)

```
Customer 1───* Card
Customer 1───* Cap            (scope = Account)
Card     1───* Cap            (scope = Card)
Cap      1───1 Counter(currentWindow)   + historical counters
Cap      *───1 CategoryGroup? (only when type = Category)
```

**Cap fields:** `id`, `customerId`, `cardToken?` (null when scope=Account), `scope`, `type` (Daily|Monthly), `categoryGroup?` (null unless category cap), `amount` (decimal money), `currency` (ISO-4217), `status` (Active|Paused), `source` (User|Mandated), `thresholds` (e.g. [0.80, 1.00]), `timezone` (IANA, drives window reset), `effectiveFrom`, `createdAt`, `updatedAt`, `version` (optimistic concurrency).

**Counter fields:** `capId`, `windowKey` (e.g. `2026-06-03` for daily in cap timezone, `2026-06` for monthly), `authorizedAmount` (decimal), `lastUpdatedAt`, `version`. The counter is the **source of truth for enforcement** and is reconciled against the ledger (§9 T16).

**Category model:** categories are **MCC groups** (e.g. `Groceries`, `Travel`, `Gambling`), resolved from the transaction's MCC via a versioned mapping table. A category cap is enforced *in addition to* the account/card daily/monthly cap (all applicable caps must pass).

---

## 5. Non-Functional & Policy Requirements (hard constraints)

### 5.1 Performance & latency budgets
> Numbers below are **assumed targets** for a mid-size FinTech; rationale follows each. They are SLOs to design against, verified by the load tests in T18.

| Operation | Target | Why this number |
|-----------|--------|-----------------|
| Authorization decision (`POST /authorizations/{authId}/evaluate`) | **p50 ≤ 10 ms, p99 ≤ 50 ms, p99.9 ≤ 120 ms** (service-internal, excludes network to gateway) | Caps sit on the card-auth hot path; the card scheme allows the whole auth round-trip only a few hundred ms, and caps is one of several checks. 50 ms p99 leaves headroom for fraud + balance checks. |
| Counter update on clearing/reversal event | **p95 ≤ 100 ms** to durably commit | Counters must be correct quickly so the next auth sees them; not as tight as auth read. |
| Cap management read (`GET /caps`) | **p95 ≤ 300 ms** | Interactive UI; not on a payment path. |
| Cap management write (create/update) | **p95 ≤ 500 ms** | Includes validation + audit write. |
| Time-to-consistency: usage read after an auth | Counter is **strongly consistent within the auth transaction**; UI usage read is **eventually consistent ≤ 2 s** | Enforcement cannot tolerate staleness; the customer-facing "how much have I spent" number can. |
| Sustained throughput | **≥ 500 auth-evals/s** with the latency budget held; burst **1500/s** for 60 s | Sized to a ~1–2M active-card base at typical TPS. |
| Notification delivery (threshold crossed → event published) | **p95 ≤ 5 s** | "Proactive" must feel timely but is not transactional. |

### 5.2 Availability & failure mode (explicit per cap source)
- Service availability target: **99.95%** monthly.
- **Auth path fail mode is policy, not accident:**
  - If the caps service / its store is unavailable during an auth evaluation, **user-source caps fail OPEN** (transaction approved) — declining all legitimate spend on a control-plane outage is worse for the customer and the business. Every fail-open decision is logged with `reason=CAP_SERVICE_DEGRADED` and flagged for reconciliation.
  - **Mandated caps and regulatory holds fail CLOSED** (transaction declined) — a regulatory control must never be silently bypassed. To make this honored even during an outage, the gateway caches the *existence* of a hold/mandated ceiling (not user caps) so it can fail closed locally.
- This split (open for convenience controls, closed for regulatory controls) is the single most important reliability decision in the spec and must be implemented exactly.

### 5.3 Security & privacy
- **No PAN, CVV, expiry, or track data ever enters, is logged by, or is stored by this service.** Cards are referenced only by opaque `cardToken`. (Maps to global rule `security.md` S04/S05.)
- All endpoints require authentication; customer endpoints are authorized to the **owning customer only** (resource-based authz, never raw `userId ==` checks). Ops endpoints require an Ops policy/role. (S02/S03.)
- All transport HTTPS/mTLS; service-to-service calls (gateway → caps) are authenticated. (S07.)
- Secrets via environment/secret manager only. (S06.)
- PII minimization: store `customerId` + `cardToken`, not names/emails; notification fan-out is delegated to a notifications service by reference.

### 5.4 Money & ID conventions
- **All monetary values use `decimal`** (`decimal(18,2)` at rest), never `float`/`double`. (`csharp-conventions.md`, `database.md` DB07.)
- A cap and the spend measured against it are **single-currency**. Transactions in a different currency are converted using the **authorization-time FX rate supplied by the gateway** (the gateway already knows the billing-currency amount); this service measures caps against the **billing-currency amount**, never doing its own FX. Tasks must not introduce FX lookups.
- IDs are `Guid` (string form in API). `authId` is supplied by the gateway and is the **idempotency key** for counter mutation.
- Timestamps are ISO-8601 UTC (`DateTimeOffset.UtcNow`); window boundaries are computed in the **cap's IANA timezone**.

### 5.5 Idempotency & ordering
- Counter-mutating operations (auth, clearing, reversal, refund) are **idempotent on `(authId, eventType)`**. A processed `(authId, eventType)` is recorded; replays are no-ops returning the prior result.
- Events may arrive **out of order** (reversal before its clearing, duplicate clearings). The counter logic must be commutative/safe under reordering — model it as a ledger of signed deltas keyed by `authId`, not as blind `+=`/`-=`.

### 5.6 Audit & logging
- Audit log is **append-only and tamper-evident** (hash-chained rows or WORM store); no updates/deletes.
- Structured logging only, with `correlationId` on every entry (`logging.md`). Log identifiers, never amounts tied to PII beyond what compliance requires, never card data.
- Authorization *declines* are logged at `Information` (business event); fail-open degradations at `Warning`; unexpected errors at `Error`.

### 5.7 Error semantics
- Single error envelope `{ errorCode, message, correlationId }` (`error_handling.md`). Cap-domain errors: `CAP_NOT_FOUND` (404), `CAP_BELOW_MANDATED_MINIMUM`/`VALIDATION_FAILED` (400), `CAP_LIMIT_REACHED` for the management API (409 when e.g. too many caps), `REGULATORY_HOLD_ACTIVE` (the auth API uses decision codes, not HTTP errors — see §6).

---

## 6. API surface (contract sketch — implemented in §9, not here)

Versioned under `/api/v1`. DTOs only, never entities (`api_design.md`, `dto_mapping.md`).

| Method & path | Purpose | Auth |
|---|---|---|
| `GET /api/v1/caps?scope=&cardToken=&page=&pageSize=` | List caller's caps (paginated) | Customer |
| `POST /api/v1/caps` | Create a cap | Customer |
| `GET /api/v1/caps/{id}` | Get one cap + current usage | Customer (owner) |
| `PATCH /api/v1/caps/{id}` | Update amount/thresholds | Customer (owner) |
| `POST /api/v1/caps/{id}/pause` / `/resume` | Toggle status | Customer (owner) |
| `DELETE /api/v1/caps/{id}` | Delete a cap | Customer (owner) |
| `POST /api/v1/authorizations/{authId}/evaluate` | **Hot path.** Returns `{ decision: Approve\|Decline, reason, evaluatedCaps[] }` | Gateway (service) |
| `POST /api/v1/transactions/{authId}/clearing` | Apply final cleared amount (may differ from auth) | Gateway (service) |
| `POST /api/v1/transactions/{authId}/reversal` | Release/reverse an auth | Gateway (service) |
| `POST /api/v1/transactions/{authId}/refund` | Refund (signed delta) | Gateway (service) |
| `GET /api/v1/ops/customers/{customerId}/caps` | Ops view of any customer | Ops |
| `POST /api/v1/ops/customers/{customerId}/mandated-caps` | Impose mandated cap | Ops |
| `POST /api/v1/ops/customers/{customerId}/holds` / `DELETE …/holds/{id}` | Apply/lift regulatory hold | Ops |
| `GET /api/v1/ops/audit?capId=&customerId=&from=&to=` | Query audit trail | Ops |

The auth-evaluate endpoint returns **200 with a decision body** for both Approve and Decline (a decline is a valid business outcome, not an HTTP error); 5xx only on genuine service failure (which triggers the §5.2 fail mode at the gateway).

---

## 7. Context

### 7.1 Beginning context (what exists before work starts — hypothetical)
- An **empty ASP.NET Core (.NET 8) solution** scaffold: `SpendingCaps.Api`, `SpendingCaps.Application`, `SpendingCaps.Domain`, `SpendingCaps.Infrastructure`, `SpendingCaps.Tests`.
- A **PostgreSQL** instance available (connection via env var); EF Core chosen for data access.
- A **card-processing gateway** exists and will call this service's auth endpoint and post clearing/reversal/refund events. Its contract for `authId`, billing-currency amount, MCC, and `cardToken` is fixed and given.
- A **notifications service** exists (publish-an-event integration); this service does not send emails/SMS directly.
- An **MCC→CategoryGroup mapping** (versioned reference data) is available as a seedable table.
- Global engineering rules in `~/.claude/rules/*` apply; `agents.md` and `.github/copilot-instructions.md` (this package) are in effect.

### 7.2 Ending context (what exists after — deliverables of an implementation)
- A running Spending Caps service exposing the §6 API, with:
  - Domain model + EF Core configuration (Fluent API only) + migrations.
  - Cap CRUD with validation, mandated-cap/hold enforcement, optimistic concurrency.
  - Atomic, idempotent counter engine handling auth/clearing/reversal/refund and window resets.
  - Threshold notification publisher (once-per-threshold-per-window).
  - Append-only audit log + Ops query API.
  - Reconciliation background job (counters vs. ledger).
  - Health endpoints `/health/live`, `/health/ready`; metrics + structured logs + correlation-id propagation.
  - Test suites: unit (domain/eval/window math), integration (DB + concurrency via TestContainers), API/contract, and a load test asserting §5.1 budgets.
- Compliance documentation: the audit schema, the fail-mode matrix, and the data-handling note (no PAN).

---

## 8. Edge Cases & Failure Modes (scoped to spending caps)

Every important flow states **expected behavior** and, where relevant, the **audit/compliance implication**. These are first-class requirements; the verification tasks in §9 must cover the rows marked **(must test)**.

| # | Situation | Expected behavior | Audit/compliance implication |
|---|-----------|-------------------|------------------------------|
| E1 **(must test)** | Two authorizations race against the same near-full cap | Counter mutation is serialized (row lock / optimistic retry on `version`); **at most one** auth that would breach is approved — no double-spend over the cap | Decline reason recorded; both decisions auditable |
| E2 **(must test)** | Same `authId` evaluated/cleared twice (duplicate webhook) | Idempotent: second call returns the first result; counter unchanged | — |
| E3 **(must test)** | Auth approved, then fully reversed | Counter returns to pre-auth value; if a threshold was crossed then uncrossed, threshold state resets so it can fire again | Reversal logged |
| E4 | Partial clearing (cleared < authorized) or over-clearing (tip > auth) | Counter adjusted to the **cleared** amount via signed delta on `authId`; over-clearing within scheme tolerance allowed, beyond tolerance flagged | Over-tolerance clearing flagged for ops |
| E5 **(must test)** | Refund posts in a **new** window for spend in a **closed** window | Refund applies to the window identified by the original `authId`'s window key, **not** the current window; current window counter is not driven negative | Cross-window refund visible in audit |
| E6 | Daily window reset & timezone | Window key computed in the **cap's IANA timezone**; DST transitions handled (a "day" may be 23/25h); reset is lazy (computed on read/write, no cron needed) | — |
| E7 **(must test)** | Transaction currency ≠ cap currency | Use gateway-supplied **billing-currency amount**; never self-FX. If billing currency ≠ cap currency, decline with `CURRENCY_MISMATCH` (caps are single-currency) | Mismatch decline auditable |
| E8 **(must test)** | User lowers a cap below current window usage | Allowed; existing usage stays, **new** spend that exceeds the lowered cap is declined immediately; no retroactive reversal of already-approved auths | Change + first subsequent decline auditable |
| E9 | Cap created mid-window | Enforced from `effectiveFrom`; spend *before* creation is not counted (counter starts at 0 for that window) | Creation time recorded |
| E10 **(must test)** | User tries to raise/remove a cap below a **mandated minimum** | Rejected with `CAP_BELOW_MANDATED_MINIMUM` (400); mandated ceiling is the binding limit | Rejected attempt auditable |
| E11 **(must test)** | Regulatory hold active | **Every** authorization declined with `REGULATORY_HOLD_ACTIVE` regardless of caps/usage; fail-CLOSED even on service degradation | All declines auditable; hold lifecycle auditable |
| E12 **(must test)** | Caps service degraded/unreachable at auth time | User caps **fail OPEN** (approve + `CAP_SERVICE_DEGRADED`); mandated caps/holds **fail CLOSED** | Every fail-open flagged for post-hoc reconciliation |
| E13 | Multiple applicable caps (daily + category + account) | **All** must pass; decline cites the **first/most-restrictive** cap breached and lists all evaluated | Decline reason names the binding cap |
| E14 | Frozen/closed card with active caps | Auth declined upstream by card status (not this service); cap state preserved; no counter mutation | — |
| E15 **(must test)** | Invalid cap input (amount ≤ 0, absurdly large, unsupported currency, threshold outside (0,1], unknown category) | Rejected `VALIDATION_FAILED` (400) with field errors; no partial create | — |
| E16 | Stale usage read in UI vs enforcement | UI read may lag ≤ 2 s (§5.1); enforcement always uses the strongly-consistent counter | UI must label usage as "near real-time" |
| E17 | Fraud-ish pattern: many small auths just under threshold to avoid the cap | Out of scope to *score*, but the per-window counter aggregates all auths so the cap still binds; "cap breached" events are emitted as a fraud signal | Events available to fraud consumer |
| E18 | Concurrent edit of the same cap by user and ops | Optimistic concurrency on `version`; the late writer gets `409 Conflict` and must refetch; mandated changes by ops always take precedence on retry | Both edit attempts auditable |
| E19 | Notification service down when threshold crossed | Threshold-crossing recorded as state; event published via outbox with retry; never blocks the auth path | — |
| E20 | Duplicate threshold crossing (spend wobbles around 80%) | Each threshold fires **once per window**; crossing-state cleared only on window reset or a reversal that uncrosses it (E3) | — |

---

## 9. Low-Level Tasks

Tasks are ordered to build bottom-up. Each names the prompt to drive it, the file(s) to create/update, the function/type, the driving detail, the **mid-level objective(s)** it serves, and (where applicable) **Acceptance Criteria / Definition of Done**. Follow `~/.claude/rules/*` for all code conventions.

---

### T1. Solution scaffold & cross-cutting setup
**Prompt:** "Create the layered .NET 8 solution (Api/Application/Domain/Infrastructure/Tests), enable `<Nullable>enable`, wire DI, structured logging with correlation-id middleware, the global exception-handling middleware, and `/health/live` + `/health/ready`."
**Files:** `src/SpendingCaps.*/*.csproj`, `Program.cs`, `Infrastructure/Middleware/CorrelationIdMiddleware.cs`, `Infrastructure/Middleware/ExceptionHandlingMiddleware.cs`.
**Serves:** all (foundation).
**Details:** Error envelope `{errorCode,message,correlationId}`; health checks per `infrastructure.md` (`/live` self-only, `/ready` includes DB).
**Acceptance Criteria:** App boots; `/health/live` → 200 with no deps; `/health/ready` → 200 only when DB reachable; an unhandled exception returns the standard envelope with a correlation id, not a stack trace.

### T2. Domain model — Cap & Counter
**Prompt:** "Model the `Cap` aggregate and `WindowCounter` as domain types with behavior (no EF attributes). Encapsulate invariants: amount > 0, thresholds in (0,1], single currency, mandated caps can't be raised by users."
**Files:** `Domain/Caps/Cap.cs`, `Domain/Caps/WindowCounter.cs`, `Domain/Caps/Money.cs`, `Domain/Caps/CapScope.cs`, `Domain/Caps/CapType.cs`, `Domain/Caps/CapSource.cs`.
**Type/function:** `Cap.Create(...)`, `Cap.ChangeAmount(...)`, `Cap.Pause()/Resume()`, `Money` value object (decimal + currency).
**Serves:** MO1, MO5.
**Details:** `Money` is a `record` with decimal; guard clauses, not deep nesting; `DomainException` with error codes for invariant violations.
**Acceptance Criteria:** Constructing a cap with amount ≤ 0 or threshold > 1 throws `DomainException`; a `Mandated` cap rejects a user-initiated raise; unit tests cover each invariant.

### T3. Window math
**Prompt:** "Implement window-key computation for Daily and Monthly caps in the cap's IANA timezone, DST-safe, with lazy reset (no scheduler)."
**Files:** `Domain/Caps/WindowKey.cs`, `Domain/Caps/IWindowCalculator.cs`, `Infrastructure/Time/WindowCalculator.cs`.
**Type/function:** `WindowCalculator.CurrentWindowKey(CapType, timezone, DateTimeOffset utcNow)` → `string`.
**Serves:** MO3 (E6).
**Details:** Daily key `yyyy-MM-dd`, monthly `yyyy-MM`, computed after converting UTC→cap tz. No `DateTime.Now`.
**Acceptance Criteria:** Unit tests prove a transaction at 23:30 local on a DST-change day maps to the correct calendar day; UTC vs local boundary cases pass; monthly rollover at month-end local time is correct.

### T4. EF Core configuration & migrations
**Prompt:** "Map Cap, WindowCounter, ProcessedEvent (idempotency), AuditEntry, MandatedCap, RegulatoryHold, MccCategoryMap with Fluent API only; explicit decimal(18,2), named indexes, optimistic concurrency token."
**Files:** `Infrastructure/Persistence/SpendingCapsDbContext.cs`, `Infrastructure/Persistence/Configurations/*.cs`, `Infrastructure/Persistence/Migrations/*`.
**Serves:** MO1, MO3, MO6.
**Details:** Per `database.md`: Fluent API (no annotations on entities), `decimal(18,2)`, indexes named (`ix_counters_cap_window`, unique on `(capId, windowKey)`; unique on `(authId, eventType)` for `ProcessedEvent`), `version` rowversion/`xmin`.
**Acceptance Criteria:** `dotnet ef database update` creates schema; unique constraint on `(authId,eventType)` exists; decimal columns are `numeric(18,2)`; no data annotations on domain entities.

### T5. Repositories (no IQueryable leakage)
**Prompt:** "Create repository interfaces returning DTOs/entities, never IQueryable; AsNoTracking for reads; concrete EF implementations."
**Files:** `Application/Abstractions/ICapRepository.cs`, `ICounterRepository.cs`, `IAuditRepository.cs`; `Infrastructure/Persistence/Repositories/*.cs`.
**Serves:** MO1, MO3, MO6.
**Details:** `database.md` DB01/DB04 (AsNoTracking + projection for reads); `microservices.md` RULE-07 (no `IQueryable` out).
**Acceptance Criteria:** No repository method returns `IQueryable<T>`; read methods use `AsNoTracking`; counter update method uses tracking + concurrency token.

### T6. Cap CRUD application service + validation
**Prompt:** "Implement `ICapService` with Create/Get/List/Update/Pause/Resume/Delete. Validate input with FluentValidation; enforce mandated-minimum on raise/delete; map entities→DTOs in the service."
**Files:** `Application/Caps/ICapService.cs`, `Application/Caps/CapService.cs`, `Application/Caps/Validators/*.cs`, `Application/Caps/Dtos/*.cs`, `Application/Caps/Commands/*.cs`.
**Serves:** MO1, MO5 (E8, E10, E15).
**Details:** Validation per `security.md` S01; mapping in service per `dto_mapping.md`; reject below-mandated with `CAP_BELOW_MANDATED_MINIMUM`. Pagination DTO `PagedResult<T>`.
**Acceptance Criteria:** Creating a valid cap returns a `CapDto` and the cap is listable; amount ≤ 0 → `VALIDATION_FAILED` with field error; lowering below current usage is allowed (E8); raising above a mandated ceiling → `CAP_BELOW_MANDATED_MINIMUM`; unit tests cover each.

### T7. Cap management controller
**Prompt:** "Thin controller for `/api/v1/caps` delegating to `ICapService`; transport only; correct status codes; resource-based authorization to the owning customer."
**Files:** `Api/Controllers/CapsController.cs`.
**Serves:** MO1.
**Details:** `api_design.md` (plural nouns, versioned, 201+Location on create, 204 on delete); no business logic/mapping/DbContext in controller (`microservices.md` RULE-01/04/05).
**Acceptance Criteria:** API tests show `POST` → 201 + `Location`; `GET {id}` of another customer's cap → 403; `DELETE` → 204; controller injects only `ICapService`/`ILogger`.

### T8. Idempotency ledger
**Prompt:** "Implement an idempotency store keyed on `(authId, eventType)` recording the outcome; a helper that wraps a counter mutation so replays are no-ops."
**Files:** `Application/Idempotency/IIdempotencyStore.cs`, `Infrastructure/Persistence/Repositories/IdempotencyStore.cs`.
**Serves:** MO3 (E2).
**Details:** §5.5; insert-or-detect within the same transaction as the counter mutation.
**Acceptance Criteria:** Submitting the same `(authId,eventType)` twice mutates the counter exactly once and returns the original result; concurrency test (two parallel identical calls) yields exactly one effective mutation.

### T9. Counter engine (signed-delta ledger)
**Prompt:** "Implement the counter engine as a ledger of signed deltas keyed by `authId`, not blind +=/-=. Operations: ApplyAuthHold, ApplyClearing(adjust to cleared), ApplyReversal, ApplyRefund. Resolve the window from the original auth's window key. Atomic with optimistic-concurrency retry."
**Files:** `Application/Counters/ICounterEngine.cs`, `Application/Counters/CounterEngine.cs`, `Domain/Caps/CounterDelta.cs`.
**Serves:** MO3 (E1, E3, E4, E5, E20).
**Details:** §5.5 ordering-safety; cross-window refund per E5; never drive a window counter negative spuriously; retry on `DbUpdateConcurrencyException` (bounded, then surface).
**Acceptance Criteria:** Unit + integration tests prove: full reversal restores pre-auth counter (E3); partial clearing adjusts to cleared amount (E4); refund into a closed window targets the original window (E5); concurrent increments serialize without lost updates (E1, TestContainers).

### T10. Authorization evaluation service
**Prompt:** "Implement `IAuthorizationEvaluator` that, for an auth (cardToken, customerId, billing-currency amount, currency, MCC), resolves all applicable caps (account daily/monthly, card daily/monthly, category), checks regulatory hold, evaluates each against its counter, and returns Approve/Decline + reason + evaluatedCaps. Apply the §5.2 fail-mode split."
**Files:** `Application/Authorization/IAuthorizationEvaluator.cs`, `Application/Authorization/AuthorizationEvaluator.cs`, `Application/Authorization/AuthDecision.cs`.
**Serves:** MO2, MO5 (E7, E11, E12, E13).
**Details:** Currency mismatch → `CURRENCY_MISMATCH` decline (E7); hold → `REGULATORY_HOLD_ACTIVE`, fail-closed (E11); all caps must pass, decline cites most-restrictive (E13); user caps fail-open on degradation, mandated/hold fail-closed (E12). Reserve (hold) the amount on Approve via the counter engine within the same transaction.
**Acceptance Criteria:** Given a near-full daily cap, an over-cap auth → `Decline/CAP_EXCEEDED` naming the cap; an active hold → `Decline/REGULATORY_HOLD_ACTIVE`; a simulated store outage → user-cap path `Approve` + `CAP_SERVICE_DEGRADED`, hold path `Decline`; decision returns within budget under the load test (T18).

### T11. Authorization & transaction-event controllers
**Prompt:** "Controllers for `/authorizations/{authId}/evaluate` (returns 200 + decision body for both approve and decline) and `/transactions/{authId}/clearing|reversal|refund` (idempotent). Service-to-service auth."
**Files:** `Api/Controllers/AuthorizationsController.cs`, `Api/Controllers/TransactionsController.cs`.
**Serves:** MO2, MO3.
**Details:** Decline is a 200 business outcome, not an HTTP error (§6); these endpoints require the gateway service identity (`security.md` S02).
**Acceptance Criteria:** API tests: evaluate returns 200 for both decisions; replayed clearing returns the same result and does not double-count; missing service auth → 401.

### T12. Mandated caps & regulatory holds (Ops)
**Prompt:** "Implement Ops services + controllers to impose a mandated minimum cap, list/apply/lift regulatory holds, scoped by Ops policy. Mandated/hold state must be readable by the auth evaluator and (for fail-closed) cacheable by the gateway."
**Files:** `Application/Ops/IMandatedCapService.cs`, `IRegulatoryHoldService.cs`, impls; `Api/Controllers/OpsCustomersController.cs`.
**Serves:** MO5 (E10, E11, E12, E18).
**Details:** Policy-based authz `RequireRole("Ops","Compliance")` (`security.md` S03); mandated change wins on concurrency conflict with a user edit (E18); publish a `HoldApplied`/`HoldLifted` event the gateway consumes for local fail-closed.
**Acceptance Criteria:** Ops can set a mandated minimum that blocks a user's lower cap (E10); applying a hold causes subsequent evaluates to decline (E11); non-Ops caller → 403; mandated vs user concurrent edit resolves to mandated.

### T13. Threshold notification (outbox)
**Prompt:** "Detect threshold crossings (default 80%, 100%) during counter mutation; record crossing-state per (cap, window, threshold) so it fires once; publish a `CapThresholdReached` event via a transactional outbox; reset crossing-state on window reset or uncrossing reversal."
**Files:** `Application/Notifications/ThresholdEvaluator.cs`, `Infrastructure/Outbox/*`, `Domain/Caps/ThresholdState.cs`.
**Serves:** MO4 (E3, E19, E20).
**Details:** §5.1 (≤5 s p95); outbox so it never blocks the auth path and survives notification-service downtime (E19); once-per-threshold-per-window (E20); reversal that uncrosses 100% re-arms it (E3).
**Acceptance Criteria:** Crossing 80% emits exactly one event; wobbling around 80% within the window emits nothing further; a reversal below 100% then re-crossing emits again; notification-service downtime delays but does not drop the event (outbox retry).

### T14. Append-only, tamper-evident audit log
**Prompt:** "Implement an append-only audit writer that records actor, action, before/after, correlationId, timestamp, hash-chained to the previous entry; expose an Ops query API with paging and date filters."
**Files:** `Application/Audit/IAuditWriter.cs`, `Infrastructure/Audit/HashChainedAuditWriter.cs`, `Api/Controllers/OpsAuditController.cs`.
**Serves:** MO6.
**Details:** No update/delete paths; each row stores `prevHash` + `rowHash` (§5.6); writes happen in the same transaction as the change they describe.
**Acceptance Criteria:** Every cap create/update/pause/delete, mandated-cap, hold, and auth decline writes an audit row; a verification routine detects a tampered/removed row by a broken hash chain; Ops can retrieve the full history of a given `capId`.

### T15. Read model for live usage
**Prompt:** "Add a `GET /caps/{id}` and `/caps` projection that returns each cap with current-window usage and percent-used, served from the strongly-consistent counter but labeled near-real-time for UI."
**Files:** `Application/Caps/Queries/GetCapUsageQuery.cs`, DTO `CapUsageDto`.
**Serves:** MO1, MO4 (E16).
**Details:** Projection per `database.md` DB04; usage = counter for current window key.
**Acceptance Criteria:** Returned `percentUsed` matches the counter; response within the read budget (§5.1).

### T16. Reconciliation background job
**Prompt:** "Implement a hosted background job that periodically reconciles per-cap counters against the authoritative clearing ledger and against the set of processed events, reporting drift and any fail-open auths that need review."
**Files:** `Infrastructure/Jobs/CounterReconciliationJob.cs`.
**Serves:** MO3, MO5 (E12 follow-up).
**Details:** `logging.md` (Info on start/complete with counts; Warning on drift); batch-bounded; idempotent; surfaces fail-open events (E12) for compliance review.
**Acceptance Criteria:** Job detects an artificially injected counter drift and logs it with the affected `capId` and magnitude; processing N caps stays within a documented batch window.

### T17. Observability, rate limiting, pagination defaults
**Prompt:** "Add metrics (auth-eval latency histogram, decline-rate, fail-open count, outbox lag), per-customer rate limiting on management endpoints, and enforce pagination defaults/maximums."
**Files:** `Infrastructure/Observability/Metrics.cs`, `Program.cs` (rate-limiter), `Application/Common/Paging.cs`.
**Serves:** MO2 (SLO visibility), MO1.
**Details:** Default `pageSize=20`, max `100`; rate limit management writes (e.g. 30/min/customer); auth-eval is exempt from customer rate limiting (it's service-to-service).
**Acceptance Criteria:** Metrics expose p50/p99 auth-eval latency and fail-open counter; requesting `pageSize=10000` is clamped to 100; exceeding the write rate limit returns 429.

### T18. Verification suites (unit / integration / API / load)
**Prompt:** "Author the test suites that prove the mid-level objectives and the (must test) edge cases, plus a load test asserting the §5.1 latency budgets."
**Files:** `tests/SpendingCaps.Tests/Unit/*`, `Integration/*` (TestContainers Postgres), `Api/*` (WebApplicationFactory), `Load/auth_eval_loadtest.*`.
**Serves:** all MOs (verification).
**Details:** Per `testing.md`: domain/eval/window math at unit level (mocked deps); counter concurrency & idempotency at integration level with **real Postgres via TestContainers** (no DbContext mocks); status-code/contract at API level; load test drives ≥500 auth-eval/s and asserts p99 ≤ 50 ms.
**Acceptance Criteria (Definition of Done for the feature):**
- Unit: window math (T3), cap invariants (T2), evaluator decisions incl. fail-mode (T10) — all green.
- Integration: E1 (no double-spend under concurrency), E2 (idempotent replay), E3 (reversal restores), E5 (cross-window refund), E10/E11 (mandated/hold) — all green against real DB.
- API: 201+Location, 403 cross-customer, 200-decline body, 401 missing service auth — all green.
- Load: p99 auth-eval ≤ 50 ms at 500/s sustained; fail-open count = 0 under healthy conditions.
- Audit: hash-chain tamper-detection test passes (T14).

---

## 10. Traceability Matrix (task → mid-level objective)

| Task | MO1 | MO2 | MO3 | MO4 | MO5 | MO6 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| T2 Domain model | ✅ | | | | ✅ | |
| T3 Window math | | | ✅ | | | |
| T4 EF/migrations | ✅ | | ✅ | | | ✅ |
| T5 Repositories | ✅ | | ✅ | | | ✅ |
| T6 Cap CRUD + validation | ✅ | | | | ✅ | |
| T7 Caps controller | ✅ | | | | | |
| T8 Idempotency | | | ✅ | | | |
| T9 Counter engine | | | ✅ | ✅ | | |
| T10 Auth evaluator | | ✅ | ✅ | | ✅ | |
| T11 Auth/txn controllers | | ✅ | ✅ | | | |
| T12 Mandated/holds | | ✅ | | | ✅ | |
| T13 Threshold notifications | | | | ✅ | | |
| T14 Audit log | | | | | | ✅ |
| T15 Usage read model | ✅ | | | ✅ | | |
| T16 Reconciliation | | | ✅ | | ✅ | |
| T17 Observability/limits | ✅ | ✅ | | | | |
| T18 Verification suites | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Every mid-level objective is served by at least one build task and exercised by T18.
