> **Note:** This file was added only in case it is more convenient for checking the homework and is built based on `specification-TEMPLATE-example.md`. The main specification file for the CardFlow project is located at: `homework-3\card-flow\specs\001-credit-card-lifecycle\spec.md`

# CardFlow — Credit Card Lifecycle Management Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective

- Build a finance-oriented web and mobile application that enables consumers to manage their credit cards throughout the entire card lifecycle — from application and activation to payments, security controls, notifications, and spending insights — without needing to call customer support.

## Mid-Level Objectives

- **US1 — Card Application & Status Tracking**: Users can start, save, and resume a credit card application; track real-time status (Draft → Submitted → Approved/Declined); receive a plain-language adverse-action notice on decline (Reg Z / FCRA compliance).
- **US2 — Card Activation**: Cardholders with an unactivated card see a prominent activation prompt; activation requires card-detail confirmation and identity verification; the card is active within 5 seconds; flow locks after 3 failed attempts.
- **US3 — Account Overview (Balance & Transactions)**: Active cardholders see current balance, available credit, statement info, and a real-time paginated transaction list that updates within 60 seconds via WebSocket; list is filterable by date range and spending category.
- **US4 — Payments**: Cardholders can make one-time payments (minimum, full statement, current balance, or custom) with a mandatory confirmation step; set up autopay rules; idempotency prevents double-charges; reminders fire 3 days before due dates.
- **US5 — Security Controls**: Cardholders can freeze/unfreeze their card in ≤ 5 seconds (with identity re-confirmation), toggle transaction restrictions (international, online-only, ATM), and permanently block a lost or stolen card with automatic replacement ordering.
- **US6 — Smart Notifications**: Transaction alerts delivered within 60 seconds; payment reminders 3 days in advance; one-tap "That wasn't me" action initiates a dispute and auto-freezes the card; 90-day in-app notification history.
- **US7 — Spending Insights**: Automatic transaction categorisation; spending breakdown by category with month-over-month comparison; user-defined monthly budgets per category with 80% threshold alerts.

## Implementation Notes

- **Stack**: Node.js 22 LTS + TypeScript 5 / Fastify 5 (backend); React 19 + Vite 6 + TanStack Query 5 (web frontend); React Native 0.76 + Expo SDK 52 (mobile); pnpm workspaces monorepo.
- **Data stores**: PostgreSQL 16 (primary ACID store with row-level security); Redis 7 (sessions, pub/sub, BullMQ job queues, rate-limit counters); S3-compatible object storage for adverse-action PDFs.
- **ORM**: Prisma 6 — all schema changes via migrations only; no raw SQL with user input; `balanceRecalc` middleware hook updates `CreditCard.currentBalance` atomically on every transaction event.
- **PCI-DSS Level 1**: No raw PANs stored; all card numbers tokenised via Basis Theory vault; only `panToken` and `lastFour` stored in CardFlow.
- **GDPR / CCPA**: Soft-delete with 30-day grace period; PII pseudonymised on erasure; financial records retained but pseudonymised; `ssnLastFour` stored AES-256-GCM encrypted and never logged or returned in API responses.
- **Reg Z / FCRA**: Adverse-action notice (PDF) generated with `pdf-lib`, uploaded to S3, and made available to declined applicants; APR and minimum payment displayed on payment confirmation screens.
- **Auth**: RS256 JWT access tokens (15 min expiry) + rotating 90-day refresh tokens (stored as bcrypt hash); theft detection revokes all sessions on replay of a revoked token; high-risk actions require a short-lived 60-second single-use confirmation token (`POST /auth/confirm`).
- **Monetary values**: All monetary fields use `Decimal` (`@db.Decimal(12,2)` or `@db.Decimal(14,2)`); no floating-point arithmetic on amounts.
- **Audit trail**: Prisma middleware hook writes an immutable `AuditLog` record on every mutation to `CreditCard`, `SecurityControl`, `Payment`, and `CreditCardApplication`.
- **API design**: REST/JSON over HTTPS; WebSocket for real-time balance and notification push; URL-path versioning (`/api/v1/`); RFC 9457 Problem Details error format; `Idempotency-Key` UUID header required on all payment creation endpoints (response cached 24 h).
- **Rate limiting**: Redis sliding window — 300 req/min per user; 10 req/min on auth/security endpoints.
- **Testing (constitution-mandated — NON-NEGOTIABLE)**: Test-first development; acceptance tests MUST be written and confirmed failing before implementation begins. Coverage gate ≥ 80% per module. Layers: Vitest (unit + integration) + Supertest + testcontainers-node (real PostgreSQL, no DB mocks) + Pact JS (consumer-driven contract) + Playwright (E2E web) + Detox (E2E mobile).
- **Performance targets**: Account overview ≤ 2 s at p95 on 4G; transaction notification ≤ 60 s at p95; card freeze/unfreeze ≤ 5 s; API reads p95 ≤ 200 ms; API writes p95 ≤ 500 ms.
- **Security headers**: Helmet.js (X-Frame-Options, CSP, HSTS, X-Content-Type-Options); TLS 1.3 required; SameSite=Strict cookies; no secrets in VCS — AWS Secrets Manager.
- **Observability**: Pino structured JSON logging with PII redaction; `prom-client` Prometheus metrics; OpenTelemetry JS SDK traces exported to AWS X-Ray; PagerDuty alerts on fraud latency > 90 s, payment failure rate > 1%, API p95 error rate > 0.5%.

## Context

### Beginning context

- Empty monorepo directory (`card-flow/`) with Docker Compose available (PostgreSQL 16, Redis 7, MinIO).
- `packages/shared/src/types/` — shared TypeScript domain interfaces (Card, Transaction, Payment, Notification) defined.
- Fastify 5 app factory scaffold (`backend/src/app.ts`) with `GET /health` endpoint.
- Prisma 6 configured with PostgreSQL datasource; initial empty schema.
- React 19 + Vite 6 web app scaffold in `frontend/` with React Router 7, Tailwind CSS 4, TanStack Query 5 provider.
- Expo SDK 52 mobile app scaffold in `mobile/` with React Navigation 7.
- GitHub Actions PR-checks pipeline (lint → typecheck → unit tests → integration tests → contract tests → coverage gate → security scan → build).
- External dependencies available in sandbox/test mode: Basis Theory card vault, Plaid (ACH bank linking), Stripe/payment gateway, APNs + FCM, SendGrid.

### Ending context

- **Backend** (`backend/`):
  - Prisma schema with all 14 entities: `User`, `RefreshToken`, `CreditCardApplication`, `CreditCard`, `Transaction`, `Payment`, `AutopayRule`, `LinkedBankAccount`, `SecurityControl`, `Notification`, `NotificationPreference`, `SpendingBudget`, `SpendingInsightSnapshot`, `AuditLog`; migrations `0001` through `0007`.
  - Auth routes: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/confirm`.
  - Domain routes: `/api/v1/applications`, `/api/v1/cards`, `/api/v1/cards/:id/transactions`, `/api/v1/cards/:id/payments`, `/api/v1/cards/:id/autopay`, `/api/v1/cards/:id/security`, `/api/v1/notifications`, `/api/v1/cards/:id/insights`.
  - WebSocket routes: `wss/cards/:cardId` (balance and transaction events), `wss/notifications` (notification feed).
  - BullMQ workers: `payment.worker.ts`, `autopay-scheduler.ts`, `notification.worker.ts`, `payment-reminder.worker.ts`, `insights.worker.ts`.
  - Services: `application.service.ts`, `card.service.ts`, `transaction.service.ts`, `payment.service.ts`, `security.service.ts`, `notification.service.ts`, `insights.service.ts`.
  - Adverse-action PDF generation (`pdf-lib`) with S3 upload.
  - OpenTelemetry + Prometheus metrics + Pino logging.
- **Frontend** (`frontend/`):
  - Screens for all 7 user stories: apply wizard, application status, activation, dashboard/account overview, transaction list + detail, payment + autopay, security settings + lost/stolen report, notification history + preferences, insights + category detail + budgets.
  - TanStack Query hooks and WebSocket hooks per domain.
  - Playwright E2E tests for US1–US7 happy paths; Pact consumer contract tests for all API routes; WCAG 2.1 AA accessibility compliance.
- **Mobile** (`mobile/`): Mirror of web screens built with React Native; biometric re-auth via `expo-local-authentication`; push notifications via `expo-notifications`; Detox E2E tests for US1–US3.
- **CI/CD**: Playwright Lighthouse performance gate (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1); blue-green ECS deploy pipeline; Pact Broker provider verification on every backend deploy.
- **Compliance**: Reg Z disclosure assertions in integration tests; adverse-action notice generation and delivery tested; all 8 success criteria (SC-001 through SC-008) validated in staging.

## Low-Level Tasks

### 1. Bootstrap Monorepo, Shared Types, and Auth Infrastructure

What prompt would you run to complete this task?
Create the pnpm workspace monorepo for CardFlow with TypeScript strict mode, ESLint 9, Prettier, and Docker Compose (PostgreSQL 16, Redis 7, MinIO). Then implement the core auth infrastructure: Jose RS256 JWT service, refresh-token rotation with theft detection, and the `POST /auth/confirm` single-use confirmation token endpoint. Add the Fastify auth and rate-limit plugins.

What file do you want to CREATE or UPDATE?
- `pnpm-workspace.yaml`, root `package.json`
- `packages/shared/src/types/` — Card, Transaction, Payment, Notification interfaces
- `docker-compose.yml`
- `backend/.env.example`, `backend/scripts/keygen.ts`
- `backend/src/lib/jwt.service.ts`
- `backend/src/routes/auth/` (register, login, refresh, logout, confirm)
- `backend/src/plugins/auth.plugin.ts`, `rate-limit.plugin.ts`, `helmet.plugin.ts`
- `backend/src/lib/logger.ts`, `backend/src/lib/redis.client.ts`
- `backend/prisma/schema.prisma` (User, RefreshToken models) + migration `0001_initial_users`
- `.github/workflows/pr-checks.yml`

What function do you want to CREATE or UPDATE?
- `signAccessToken`, `verifyAccessToken`, `signRefreshToken` (jwt.service.ts)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/confirm`
- Fastify auth plugin: validates Bearer JWT, decorates `request.user`
- Fastify rate-limit plugin: Redis sliding window, 300 req/min per user / 10 req/min on auth
- Pino logger with `requestId` propagation and PII/amount field redaction
- RFC 9457 `application/problem+json` error handler

What are details you want to add to drive the code changes?
- RS256 key pair: 2048-bit; public key served at `GET /auth/.well-known/jwks.json`
- Access token payload: `{ sub: userId, iat, exp, jti }`; 15-minute expiry; non-revocable
- Refresh token: cryptographically random 256-bit opaque token stored as bcrypt (cost ≥ 12) hash in PostgreSQL; 90-day expiry; delivered in `HttpOnly; SameSite=Strict; Secure` cookie (web) and `expo-secure-store` (mobile)
- Refresh rotation: on `/auth/refresh`, validate hash, issue new token, set `revokedAt` on old; if revoked token presented, revoke ALL user sessions immediately
- Confirmation token (`POST /auth/confirm`): single-use, 60-second TTL, stored in Redis; consumed and deleted on first use; required before any SecurityControl mutation
- `User` model: bcrypt `passwordHash` (cost ≥ 12), soft-delete via `deletedAt`, `kycStatus` enum, `totpSecret` AES-256-GCM encrypted
- CI pipeline gates: lint → typecheck → unit tests → integration tests → contract tests → coverage ≥ 80% → `npm audit --audit-level=critical` → build

---

### 2. Implement Credit Card Application Lifecycle and Card Activation (US1 + US2)

What prompt would you run to complete this task?
Implement the full credit card application lifecycle (US1) and card activation flow (US2). Write failing acceptance tests first. Then implement Prisma models, service layer with state machines, Fastify routes, adverse-action PDF generation, and all web + mobile screens.

What file do you want to CREATE or UPDATE?
- `backend/prisma/schema.prisma` — CreditCardApplication, CreditCard, SecurityControl models + migrations `0002_applications`, `0003_cards`
- `backend/src/services/application.service.ts`
- `backend/src/lib/adverse-action-pdf.ts`
- `backend/src/routes/applications/` (POST /, POST /:id/submit, GET /, GET /:id, POST /:id/withdraw)
- `backend/src/routes/internal/underwriting-decision.ts`
- `backend/src/services/card.service.ts`
- `backend/src/routes/cards/` (GET /, GET /:id, POST /:id/activate, GET /:id/account-summary)
- `backend/tests/integration/application.test.ts`, `backend/tests/integration/card-activation.test.ts`
- `backend/tests/contract/applications.provider.test.ts`, `backend/tests/contract/cards.provider.test.ts`
- `frontend/tests/contract/applications.pact.test.ts`, `frontend/tests/contract/cards.pact.test.ts`
- `frontend/tests/e2e/us1-apply.spec.ts`, `frontend/tests/e2e/us2-activate.spec.ts`
- `frontend/src/pages/apply/ApplicationForm.tsx`, `ApplicationStatus.tsx`
- `frontend/src/pages/dashboard/ActivateCard.tsx`, `Dashboard.tsx`
- `frontend/src/hooks/useApplications.ts`, `useCards.ts`
- `mobile/src/app/apply/`, `mobile/src/app/cards/ActivateCard.tsx`

What function do you want to CREATE or UPDATE?
- `createDraft`, `updateDraft`, `submit`, `withdraw`, `applyDecision` (application.service.ts)
- `generateAdverseActionPdf` — pdf-lib, S3/MinIO upload, signed URL storage (adverse-action-pdf.ts)
- `listCards`, `getCard`, `activateCard` (card.service.ts) — attempt tracking, lock after 3 failures, confirm status within 5 s
- Application state machine: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | DECLINED`; `SUBMITTED | UNDER_REVIEW → WITHDRAWN`
- Card state machine: `ISSUED_PENDING_ACTIVATION → ACTIVE ↔ FROZEN → LOST_STOLEN | CLOSED`
- Underwriting webhook handler: internal endpoint receiving approval/decline decision, setting `approvedCreditLimit`, `approvedApr`, `declineReasonCode`, creating CreditCard on approval
- ApplicationForm multi-step wizard with draft auto-save; ApplicationStatus with reference number and adverse-action notice download

What are details you want to add to drive the code changes?
- `CreditCardApplication.referenceNumber` auto-generated at SUBMITTED transition in format `CF-YYYYMMDD-NNNNN`; `ssnLastFour` stored AES-256-GCM encrypted; never logged or returned in API responses
- Adverse-action notice: MUST be generated on `DECLINED` transition; `adverseActionNoticeUrl` is a signed S3 URL with 90-day TTL; `adverseActionNoticeSentAt` recorded
- Activation: requires correct `lastFour` + valid confirmation token; `activationAttempts` incremented on each failure; `activationLocked = true` when attempts reach 3; card `ACTIVE` and `activatedAt` set within 5 seconds of success
- `SecurityControl` record created automatically when `CreditCard` transitions to `ACTIVE`; default all restrictions `false`
- `annualIncome` must be ≥ 0; guest drafts identified by `guestToken` (unique, opaque); authenticated users by JWT `sub`
- Integration tests MUST use testcontainers-node (real PostgreSQL); no DB mocks
- Pact consumer tests MUST be committed and confirmed failing before implementation tasks begin

---

### 3. Implement Transactions, Payments, Security Controls, Notifications, and Spending Insights (US3–US7)

What prompt would you run to complete this task?
Implement the remaining five user stories in dependency order: account overview and real-time transactions (US3), payments and autopay (US4), security controls (US5), smart notifications (US6), and spending insights (US7). Write failing tests before each story. Wire WebSocket events, BullMQ workers, and the nightly aggregation pipeline. Build all corresponding web and mobile screens.

What file do you want to CREATE or UPDATE?
- `backend/prisma/schema.prisma` — Transaction, Payment, AutopayRule, LinkedBankAccount, Notification, NotificationPreference, SpendingBudget, SpendingInsightSnapshot, AuditLog models + migrations `0004`–`0007`
- `backend/src/services/` — transaction.service.ts, payment.service.ts, security.service.ts, notification.service.ts, insights.service.ts
- `backend/src/routes/` — transactions/, payments/, security/, notifications/, insights/, ws/card-events.ts, ws/notification-feed.ts
- `backend/src/workers/` — payment.worker.ts, autopay-scheduler.ts, notification.worker.ts, payment-reminder.worker.ts, insights.worker.ts
- `backend/src/lib/account-cache.ts` (Redis TTL 60 s, pub/sub invalidation), `backend/src/lib/queue.factory.ts`
- `backend/src/lib/prisma.client.ts` — auditLog, softDelete, sensitiveFieldRedact, balanceRecalc middleware hooks
- `backend/prisma/mcc-categories.json`
- `backend/tests/integration/` — transactions.test.ts, websocket.test.ts, payments.test.ts, security.test.ts, notifications.test.ts, insights.test.ts
- `backend/tests/contract/` — provider tests for all domains
- `frontend/tests/contract/` — Pact consumer tests for all domains
- `frontend/tests/e2e/` — us3–us7 Playwright specs, accessibility.spec.ts
- `frontend/src/pages/` — dashboard/AccountOverview.tsx, transactions/, payments/, security/, notifications/, insights/
- `frontend/src/hooks/` — useTransactions.ts, useCardEvents.ts, usePayments.ts, useSecurity.ts, useNotifications.ts, useNotificationFeed.ts, useInsights.ts
- `mobile/src/app/` — all screens mirroring web; Detox E2E for US1–US3
- `backend/src/lib/telemetry.ts` (OpenTelemetry), `backend/src/routes/metrics.ts` (Prometheus)
- `infra/grafana/cardflow-dashboard.json`, `docs/runbook.md`, `docs/launch-readiness.md`

What function do you want to CREATE or UPDATE?
- `ingestTransaction`, `listTransactions` (keyset/cursor pagination, date + category filters), `getTransaction` (transaction.service.ts)
- WebSocket route `wss/cards/:cardId`: broadcast `balance:updated`, `transaction:new`, `transaction:updated` via Redis pub/sub; Redis account summary cache (TTL 60 s, invalidated on `transaction:ingest`)
- `createPayment` (idempotency key, 60 s duplicate detection, amount resolution), `cancelPayment`, `listPayments`, `upsertAutopayRule`, `deleteAutopayRule` (payment.service.ts)
- BullMQ payment worker: retry with exponential back-off, dead-letter queue, update `Payment.status` on completion/failure
- BullMQ autopay scheduler cron (nightly 00:00 UTC): evaluate active `AutopayRule` records, create `Payment` records, enqueue 3-day reminders
- `getSecurityControl`, `updateSecurityControl` (validates confirmation token, propagates to card-network API synchronously ≤ 5 s), `reportLostStolen` (permanent block + replacement order) (security.service.ts)
- `evaluateAndDispatch`, `markRead`, `markAllRead`, `listNotifications`, `getPreferences`, `upsertPreferences` (notification.service.ts)
- BullMQ notification worker: Expo push (APNs/FCM via `expo-server-sdk`), SendGrid email, in-app record; retry with dead-letter queue; delivery ≤ 60 s at p95
- Payment reminder cron (nightly): creates `PAYMENT_REMINDER` notifications for payments due ≤ 3 days
- `getSummary`, `getTrend`, `listBudgets`, `createBudget`, `updateBudget`, `deleteBudget` (insights.service.ts)
- Nightly BullMQ aggregation worker: group transactions by `(cardId, category, period)`, upsert `SpendingInsightSnapshot`; check `SpendingBudget` for 80% threshold; enqueue `BUDGET_THRESHOLD` notifications
- Prisma middleware hooks: `auditLog` (append-only AuditLog on all mutations to Card/Security/Payment/Application), `balanceRecalc` (atomic `currentBalance` update on transaction create/update), `softDelete` (convert User delete to `deletedAt` update), `sensitiveFieldRedact`

What are details you want to add to drive the code changes?
- **Transactions**: `amount` must not be zero; `category` derived from MCC lookup table (`mcc-categories.json`) on ingest and stored for fast filtering; international transactions checked against `SecurityControl.blockInternational` before authorisation; cursor pagination on `(cardId, authorisedAt DESC)` index; balance reflected in overview within 60 s via WebSocket
- **Payments**: `Idempotency-Key` UUID header required; server stores response 24 h and returns it on replay; duplicate rejected with HTTP 409 if same `cardId` + `amount` in SCHEDULED/PROCESSING within last 60 s; `amount` for `MINIMUM_PAYMENT` must equal current minimum payment due; confirmation screen MUST show amount, funding source, and expected posting date before processing; first-occurrence insufficient-funds grace: no late fee applied for the first NSF event in a 12-month period
- **Security controls**: all SecurityControl mutations require valid `confirmationToken` (60 s TTL, single-use, stored in Redis); mutation returns only after card-network confirmation (timeout → HTTP 504); `reportLostStolen` sets `CreditCard.status = LOST_STOLEN` (irreversible) and automatically orders a replacement card
- **Notifications**: `TRANSACTION_ALERT` records created within 60 s of `authorisedAt`; "That wasn't me" one-tap action: flag transaction as disputed, freeze card, return dispute case reference; 90-day retention enforced by nightly BullMQ cleanup job; in-app notification history paginated on `(userId, createdAt DESC)` index
- **Insights**: `SpendingInsightSnapshot` unique on `(cardId, periodType, periodStart, category)`; budget alert threshold default 80% (configurable 1–100); month-over-month comparison queries two consecutive `SpendingInsightSnapshot` periods; `SpendingBudget` unique on `(userId, cardId, category, periodType)`
- **Audit log**: AuditLog is append-only — no UPDATE or DELETE; records `entityType`, `entityId`, `action`, `before`/`after` JSON snapshots, `actorUserId`, `ipAddress`
- **Observability**: OpenTelemetry auto-instruments Fastify, Prisma, BullMQ, Redis; exports to AWS X-Ray via OTLP; Prometheus metrics: `http_request_duration_seconds`, `queue_job_duration_seconds`, `notification_delivery_latency_seconds`, `active_websocket_connections`; PagerDuty P1 on fraud alert latency > 90 s or DB connection pool exhaustion
- **Compliance gate**: integration tests assert APR, fees, and minimum payment disclosure are present on application and payment confirmation screens (Reg Z); Playwright Lighthouse gate: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1; WCAG 2.1 AA axe-core audit on all web screens
- **Success criteria validation** (all 8 must pass in staging before launch): SC-001 ≥ 90% applications submitted without support contact; SC-002 ≥ 85% activation completion; SC-003 ≥ 70% autopay enrolment within 30 days; SC-004 25% fraud chargeback reduction within 6 months; SC-005 transaction alerts ≤ 60 s at p95; SC-006 account overview ≤ 2 s at p95; SC-007 zero regulatory compliance failures in post-launch audit; SC-008 ≥ 60% monthly active cardholders within 90 days of launch
