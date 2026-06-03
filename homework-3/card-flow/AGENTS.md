# AGENTS.md — CardFlow Agent Guidance

This file governs how AI coding agents (Claude Code, Copilot, Cursor, etc.) should
understand and operate within the CardFlow codebase. Read it before making any change.
All rules here are binding unless explicitly overridden by the user in the current session.

---

## 1. Project Overview

CardFlow is a **PCI-DSS Level 1** consumer credit card management platform. It covers the
full card lifecycle: application, activation, account overview, payments, security controls,
notifications, and spending insights.

- **Backend**: Node.js 22 LTS + TypeScript 5 + Fastify 5
- **Web**: React 19 + Vite 6 + TanStack Query 5 + Tailwind CSS 4
- **Mobile**: React Native 0.76 + Expo SDK 52 + React Navigation 7
- **Database**: PostgreSQL 16 (primary) + Redis 7 (cache / queues / pub-sub)
- **ORM**: Prisma 6 (migrations + type-safe queries)
- **Job queues**: BullMQ 5 (Redis-backed; durable, retryable)
- **Auth**: Custom JWT (Jose 5) — RS256, 15-min access token + 90-day rotating refresh
- **Card vault**: Basis Theory (PAN tokenisation; CardFlow never stores raw PANs)
- **Monorepo**: pnpm workspaces — `backend/`, `frontend/`, `mobile/`, `packages/shared/`

Full rationale for every technology choice is in
[specs/001-credit-card-lifecycle/plan.md](specs/001-credit-card-lifecycle/plan.md).

---

## 2. Domain Rules (Banking / Financial)

These rules encode regulatory and domain invariants. Violating them is a blocking issue.

### Card numbers (PAN)
- **NEVER** store, log, print, or transmit a raw PAN anywhere in CardFlow.
- The only card identifier in the DB is `CreditCard.panToken` (a Basis Theory vault token)
  plus `CreditCard.lastFour` (display only, never used for auth).
- Any code path that receives a full card number from a UI MUST proxy it directly to the
  vault and discard it immediately — no intermediate variable, no log line.

### Sensitive fields — log redaction
- **Never log**: PAN, full card number, SSN (even last-four), bank account numbers,
  passwords, refresh tokens, confirmation tokens, or amounts tied to a specific cardholder
  if the log line also includes PII.
- Pino's `redact` config at the app root covers the standard paths. When adding new fields
  that contain PII or credentials, add them to the redaction list, not just remove the log.

### Idempotency
- Every payment creation endpoint requires an `Idempotency-Key` UUID header.
- The service MUST store the response for 24 hours and return it unchanged on replay.
- Duplicate detection: reject (HTTP 409) if a payment with the same `cardId` + `amount`
  exists in `SCHEDULED` or `PROCESSING` status within the last 60 seconds.
- BullMQ jobs that process payments MUST be idempotent: re-running a completed job MUST
  produce the same DB state, not a second charge.

### Balance updates
- `CreditCard.currentBalance` MUST only be updated via the Transaction service (Prisma
  middleware hook `balanceRecalc`). Never write to it directly in route handlers or workers.
- `availableCredit` is always computed (`creditLimit − currentBalance`); never persisted.

### Card status machine
Allowed transitions only (from [data-model.md](specs/001-credit-card-lifecycle/data-model.md)):
```
ISSUED_PENDING_ACTIVATION → ACTIVE
ACTIVE ↔ FROZEN
ACTIVE | FROZEN → LOST_STOLEN   (irreversible)
any → CLOSED
```
Do not implement shortcuts or new transitions without explicit spec change.

### Application status machine
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | DECLINED
SUBMITTED | UNDER_REVIEW → WITHDRAWN
```
`APPROVED` and `DECLINED` are terminal — no further mutations are permitted.

### Audit log
All writes to `CreditCard`, `SecurityControl`, `Payment`, and `CreditCardApplication` MUST
produce an `AuditLog` record (handled by Prisma middleware). Never bypass this hook. The
`AuditLog` table is append-only — no UPDATE or DELETE on it, ever.

### Re-authentication for security actions
Any mutation to `SecurityControl` (freeze, unfreeze, restrictions, spend limits) and the
lost/stolen report MUST validate a short-lived `X-Auth-Confirmation` token (TTL 60 s,
single-use) issued by `POST /auth/confirm`. The service layer MUST reject the request
without this token — do not skip or stub this check outside of test doubles.

### GDPR / soft-delete
- User deletion MUST set `deletedAt`, not hard-delete the row.
- Financial records (Transaction, Payment) are pseudonymised after 30 days — never deleted.
- Prisma middleware `softDelete` and `sensitiveFieldRedact` hooks handle this. Do not
  bypass them.

### Regulation Z / FCRA
- A declined application MUST have `declineReasonCode`, `declineReasonSummary`, and
  `adverseActionNoticeUrl` set before the status transitions to `DECLINED`.
- The adverse-action PDF is generated and uploaded to S3 before the webhook response is
  sent to the client. If generation fails, the transition must not complete.

---

## 3. Code Style

Follow these rules strictly. They are enforced by CI (ESLint 9 + Prettier + TypeScript
strict mode). Do not introduce patterns that would require disabling lint rules.

### TypeScript
- `strict: true` and `noUncheckedIndexedAccess: true` are enabled in all `tsconfig.json`
  files. **No `any`** — use `unknown` and narrow it.
- Service boundary return types MUST use `Result<T, E>` (discriminated union). Do not
  `throw` untyped errors from service code.
- All environment config MUST be loaded and validated via Zod at startup
  (`backend/src/config/`); never read `process.env` directly in feature code.

### Naming
- Files: `kebab-case.ts`
- Classes, types, interfaces: `PascalCase`
- Functions, variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Database columns: `camelCase` (Prisma handles the `snake_case` DB mapping)

### Comments
- Only add a comment when the **why** is non-obvious (hidden constraint, workaround,
  subtle invariant). Never explain what the code does — names do that.
- No docblock walls. One short line max.

### No dead code
- Unused imports, variables, and commented-out blocks MUST NOT be merged.
- Remove, do not comment out.

### Abstractions
- Do not introduce an abstraction unless you need it in at least two places right now.
  Three similar lines beats a premature helper.

---

## 4. Architecture Constraints

### API
- All routes live under `/api/v1/`. Breaking changes require a new version prefix.
- Error responses MUST use RFC 9457 Problem Details (`application/problem+json`).
- Financial data responses MUST carry `Cache-Control: no-store`.
- OpenAPI spec auto-generated from Fastify JSON Schema definitions. Keep schemas complete
  and accurate — do not add a route without a schema.

### Database
- **Prisma migrations only** — no manual `ALTER TABLE` or schema edits outside of
  `prisma migrate dev`. Every migration is committed to VCS and reviewed in PR.
- **No raw SQL with user input** — use Prisma's parameterised query builder. If
  `$queryRaw` is truly necessary, use tagged template literals (Prisma enforces this).
- Pagination on transaction and notification lists MUST use cursor-based (keyset)
  pagination. Never use `OFFSET` — it degrades at scale.
- PostgreSQL RLS policies are active. Do not assume the application layer is the only
  guard against cross-user data access.

### Caching
- Redis TTL on account summary: 60 s, invalidated on new transaction. Do not cache
  financial balances for longer without explicit spec approval.
- Session tokens and confirmation tokens live in Redis. Expiry MUST be set; no
  indefinite-TTL keys for auth data.

### Workers (BullMQ)
- Payment and notification jobs MUST use exponential back-off with a dead-letter queue.
- `removeOnComplete: false` on payment jobs — they must be replayable for reconciliation.
- Workers MUST be idempotent. Check job state before applying side effects.

### Auth
- JWT access tokens: RS256, 15-min expiry, no revocation (short window is the mechanism).
- Refresh tokens: cryptographically random 256-bit opaque token, stored as bcrypt hash,
  delivered in `HttpOnly; SameSite=Strict; Secure` cookie (web) or SecureStore (mobile).
- Theft detection: presenting a revoked refresh token MUST invalidate all sessions for
  that user immediately.

---

## 5. Testing & Verification Requirements

The constitution mandates TDD. These rules are **non-negotiable**.

### TDD sequence
1. Write an acceptance test derived from a spec scenario — it MUST fail before any
   implementation is written.
2. Get peer review on the test.
3. Confirm test fails in CI.
4. Implement until the test passes.
5. Refactor — keep tests green.

Do not write implementation code before a failing test exists.

### Test layers (all required)
| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Services, utilities, validators — all business logic in isolation |
| Integration | Vitest + Supertest + testcontainers | API routes against a real PostgreSQL DB |
| Contract | Pact JS | Every API endpoint; consumer tests in `frontend/` + `mobile/` |
| E2E web | Playwright | All P1–P3 user stories, full happy path |
| E2E mobile | Detox | All P1–P3 user stories, full happy path |

### No DB mocks
Mock databases are **prohibited** in integration tests. Use `testcontainers-node` to spin
up a real PostgreSQL instance. This rule exists because mock/prod divergence masked a
broken migration in a prior incident.

### Coverage gate
80% line/branch coverage per module. Drops below this threshold block merging in CI.

### What to test per feature
- The happy path.
- At least two failure or edge cases (e.g., invalid input, state machine violation,
  idempotency replay, concurrent duplicate).
- Any acceptance scenario marked in `spec.md`.

---

## 6. Security & Compliance Constraints

| Control | Rule |
|---|---|
| Transport | TLS 1.3 required; HSTS max-age 1 year. Never downgrade. |
| Input validation | Zod at the service boundary; Fastify JSON Schema at the HTTP boundary. Both are required — not one or the other. |
| SQL injection | Prisma parameterised queries only. No string-concatenated SQL. |
| XSS | React auto-escaping + CSP headers via Helmet. Never use `dangerouslySetInnerHTML` without explicit review. |
| CSRF | `SameSite=Strict` cookies + `X-Requested-With` header check on state-changing requests. |
| Secrets | AWS Secrets Manager only. No secrets in `.env` files committed to VCS. No hardcoded credentials anywhere in the codebase. |
| PAN | Delegated to Basis Theory. Zero raw PANs in CardFlow. See §2 above. |
| Rate limiting | Redis sliding window. Default 300 req/min per user; 10 req/min on auth and security endpoints. Do not remove rate-limit decorators from routes. |
| Security headers | Helmet.js registered as a Fastify plugin. Do not disable or override its defaults without a documented security review. |
| Dependency scanning | Dependabot + `npm audit` in CI. Do not merge PRs with critical vulnerabilities. |
| SAST | `eslint-plugin-security` runs in CI. Do not suppress its findings without a documented reason. |
| PII in logs | Pino `redact` list covers standard paths. Extend it when adding new sensitive fields. |
| `ssnLastFour` | Stored AES-256-GCM encrypted at rest. Never returned in API responses. Never logged. |
| `totpSecret` | Stored AES-256-GCM encrypted at rest. |

---

## 7. Edge Case Handling

These patterns MUST be followed consistently across all features.

### Payment gateway non-response
Tell the user the outcome is uncertain. Do NOT attempt a second charge. Mark the payment
`PROCESSING` and let the reconciliation worker confirm or fail it asynchronously. Never
assume success on timeout.

### Card freeze network timeout
Return HTTP 504. Set the card's display state to "freeze pending" — do NOT mark it as
frozen until the card-network confirms. Notify the user when the operation completes.

### Service unavailability during form submission
Save the draft. Notify the user when the retry succeeds. Do not silently drop user data.

### Duplicate requests / retries
All payment and state-change endpoints must handle replay via idempotency keys. A second
identical request MUST return the stored response, not create a new record.

### Activation lockout
After 3 failed activation attempts set `activationLocked = true`. Do not unlock
programmatically — the user must contact support. Do not reset the counter between sessions.

### Theft detection on refresh token
If a revoked refresh token is presented, immediately revoke all `RefreshToken` records for
that user. Do not issue a new token. Return HTTP 401.

### Multiple cards
Every journey (activation, payment, security, insights) operates on the explicitly selected
card. Never infer which card is "current" from session state alone — require an explicit
`cardId` parameter.

### GDPR erasure
After the 30-day grace period: pseudonymise PII fields in `User` with `[REDACTED-<hash>]`.
Do not delete `Transaction` or `Payment` records — pseudonymise their `User` reference.
The Prisma middleware handles this; do not add parallel deletion logic.

---

## 8. Performance Budgets (blocking)

These are CI-enforced gates, not aspirational targets.

| Metric | Budget |
|---|---|
| Account overview load (p95, 4G) | ≤ 2 s |
| Transaction notification delivery (p95) | ≤ 60 s |
| Card freeze/unfreeze round-trip | ≤ 5 s |
| API reads (p95) | ≤ 200 ms |
| API writes (p95) | ≤ 500 ms |
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |

Do not make changes to the critical rendering path or data-access layer without running
the Playwright Lighthouse performance gate locally first.

---

## 9. CI Quality Gates

Every PR must pass all of these before merge. Do not skip or bypass them.

1. Lint (ESLint 9, zero warnings)
2. Type check (`tsc --noEmit`, zero errors)
3. Unit tests (Vitest)
4. Integration tests (Vitest + Supertest + testcontainers)
5. Contract tests (Pact JS)
6. Coverage gate (≥ 80% per module)
7. Security scan (`eslint-plugin-security` + `npm audit`)
8. Build succeeds

On merge to `main`, E2E (Playwright + Detox) and Playwright Lighthouse also run.

---

## 10. Commit & Branch Conventions

- Branches: created via `/speckit-git-feature` (sequential numbering).
- Commits: atomic, referencing a task ID — `feat: T012 implement card creation service`.
- Definition of Done: implementation complete, all tests passing, code reviewed,
  documentation updated.
- No force-push to `main` or `release/*`.
- No `--no-verify` to skip hooks without explicit user instruction.

---

## 11. Where to Find Things

| Need | Location |
|---|---|
| Full tech stack + architecture | [specs/001-credit-card-lifecycle/plan.md](specs/001-credit-card-lifecycle/plan.md) |
| Feature specification + acceptance scenarios | [specs/001-credit-card-lifecycle/spec.md](specs/001-credit-card-lifecycle/spec.md) |
| Data model (all entities + state machines) | [specs/001-credit-card-lifecycle/data-model.md](specs/001-credit-card-lifecycle/data-model.md) |
| API contracts | [specs/001-credit-card-lifecycle/contracts/](specs/001-credit-card-lifecycle/contracts/) |
| Project principles (constitution) | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Task list | [specs/001-credit-card-lifecycle/tasks.md](specs/001-credit-card-lifecycle/tasks.md) |
| Developer quick-start | [specs/001-credit-card-lifecycle/quickstart.md](specs/001-credit-card-lifecycle/quickstart.md) |
