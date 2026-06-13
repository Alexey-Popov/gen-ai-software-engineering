---
description: "Task list for CardFlow — Credit Card Lifecycle Management"
---

# Tasks: CardFlow — Credit Card Lifecycle Management

**Input**: Design documents from `specs/001-credit-card-lifecycle/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Included — constitution Principle II mandates test-first development (NON-NEGOTIABLE).
Tests for each user story MUST be written before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

---

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- All paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo skeleton, tooling, local dev environment, CI pipeline

- [ ] T001 Initialise pnpm workspace monorepo with `pnpm-workspace.yaml` and root `package.json` scripts (lint, test, build)
- [ ] T002 [P] Configure TypeScript 5.x `tsconfig.json` for `backend/`, `frontend/`, `mobile/`, `packages/shared/` with strict mode and `noUncheckedIndexedAccess`
- [ ] T003 [P] Configure ESLint 9 with `@typescript-eslint`, `eslint-plugin-security`, `eslint-plugin-import` in root `.eslintrc.json`
- [ ] T004 [P] Configure Prettier with root `.prettierrc` and add `lint-staged` pre-commit hook
- [ ] T005 Create `packages/shared/` workspace with shared domain TypeScript interfaces (Card, Transaction, Payment, Notification) in `packages/shared/src/types/`
- [ ] T006 [P] Create `docker-compose.yml` with PostgreSQL 16, Redis 7, and MinIO services with health checks
- [ ] T007 Create `backend/.env.example` with all required environment variables and RS256 key-generation script at `backend/scripts/keygen.ts`
- [ ] T008 Scaffold Fastify 5 app factory in `backend/src/app.ts` with plugin registration slots and `GET /health` endpoint
- [ ] T009 Configure Prisma 6 in `backend/prisma/schema.prisma` with PostgreSQL datasource and initial empty schema
- [ ] T010 Scaffold React 19 + Vite 6 web app in `frontend/` with React Router 7, Tailwind CSS 4, TanStack Query 5 provider, and Zustand store scaffold
- [ ] T011 Scaffold Expo SDK 52 mobile app in `mobile/` with React Navigation 7 stack navigator and shared API client from `packages/shared/`
- [ ] T012 [P] Create GitHub Actions workflow `.github/workflows/pr-checks.yml`: lint → typecheck → unit-tests → integration-tests → contract-tests → coverage-gate (≥80%) → security-scan → build
- [ ] T013 [P] Create GitHub Actions workflow `.github/workflows/deploy-staging.yml`: PR checks + E2E + perf audit → Docker image build → ECR push → ECS staging deploy

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T014 Add `User` and `RefreshToken` models to `backend/prisma/schema.prisma` with all fields from data-model.md; generate and apply migration `0001_initial_users`
- [ ] T015 Implement Jose RS256 JWT service in `backend/src/lib/jwt.service.ts`: `signAccessToken`, `verifyAccessToken`, `signRefreshToken`
- [ ] T016 Implement auth routes in `backend/src/routes/auth/`: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (rotation), `POST /auth/logout` with refresh token theft detection
- [ ] T017 Implement `POST /auth/confirm` re-authentication endpoint in `backend/src/routes/auth/confirm.ts` issuing 60-second single-use confirmation tokens
- [ ] T018 [P] Add Fastify auth plugin `backend/src/plugins/auth.plugin.ts` that validates Bearer JWT on every protected route and decorates `request.user`
- [ ] T019 [P] Add Fastify rate-limit plugin `backend/src/plugins/rate-limit.plugin.ts` (Redis sliding window: 300 req/min per user; 10 req/min on auth endpoints)
- [ ] T020 [P] Add Fastify Helmet plugin `backend/src/plugins/helmet.plugin.ts` for security headers (X-Frame-Options, CSP, HSTS, X-Content-Type-Options)
- [ ] T021 Add Pino structured logger `backend/src/lib/logger.ts` with requestId propagation and PII/amount redaction middleware
- [ ] T022 [P] Implement RFC 9457 `application/problem+json` error handler in `backend/src/middleware/error-handler.ts`
- [ ] T023 [P] Create Redis client singleton `backend/src/lib/redis.client.ts` with pub/sub helper and connection health check
- [ ] T024 [P] Create BullMQ queue factory `backend/src/lib/queue.factory.ts` with typed job definitions for `payment`, `notification`, and `insight-aggregation` queues
- [ ] T025 [P] Create typed API client module `packages/shared/src/api/api-client.ts` used by both `frontend/` and `mobile/` with auth header injection and error handling
- [ ] T026 [P] Implement Zustand auth store `frontend/src/stores/auth.store.ts` and login/register screens `frontend/src/pages/auth/` with form validation (React Hook Form + Zod)
- [ ] T027 [P] Implement auth screens in `mobile/src/app/auth/` (login, register) wired to shared API client; store refresh token in `expo-secure-store`

**Checkpoint**: `POST /auth/login` issues valid JWT; CI pipeline green; Docker Compose healthy.

---

## Phase 3: User Story 1 — Apply for a Card & Track Status (Priority: P1) 🎯 MVP

**Goal**: A prospective customer can apply for a credit card, track the application status,
and receive the legally required adverse-action notice if declined — without calling support.

**Independent Test**: Run `pnpm --filter backend seed:apply` to create a draft application,
submit it, and verify the reference number is returned; run `pnpm --filter backend seed:approve`
to trigger an approval and verify `ISSUED_PENDING_ACTIVATION` card is created.

### Tests for User Story 1 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T028 [P] [US1] Write Pact consumer contract test for `POST /api/v1/applications` and `POST /api/v1/applications/:id/submit` in `frontend/tests/contract/applications.pact.test.ts`
- [ ] T029 [P] [US1] Write integration tests for full application lifecycle (DRAFT→SUBMITTED→APPROVED, DRAFT→SUBMITTED→DECLINED, withdraw) in `backend/tests/integration/application.test.ts`
- [ ] T030 [P] [US1] Write Playwright E2E test for US1 happy path (apply + submit + view approval) in `frontend/tests/e2e/us1-apply.spec.ts`

### Implementation for User Story 1

- [ ] T031 [US1] Add `CreditCardApplication` model to `backend/prisma/schema.prisma` with all fields from data-model.md; generate migration `0002_applications`
- [ ] T032 [US1] Implement `application.service.ts` in `backend/src/services/application.service.ts`: `createDraft`, `updateDraft`, `submit`, `withdraw`, `applyDecision` with status state machine
- [ ] T033 [US1] Implement adverse-action PDF generator in `backend/src/lib/adverse-action-pdf.ts` using `pdf-lib`; upload to S3/MinIO and store signed URL in application record
- [ ] T034 [US1] Implement application routes in `backend/src/routes/applications/`: `POST /`, `POST /:id/submit`, `GET /`, `GET /:id`, `POST /:id/withdraw` with Zod/Fastify schemas
- [ ] T035 [US1] Implement internal underwriting webhook `POST /internal/v1/applications/:id/decision` in `backend/src/routes/internal/underwriting-decision.ts`
- [ ] T036 [US1] Implement Pact provider verification for applications in `backend/tests/contract/applications.provider.test.ts`
- [ ] T037 [P] [US1] Build application form screens (multi-step wizard) in `frontend/src/pages/apply/ApplicationForm.tsx` with field validation and draft auto-save
- [ ] T038 [P] [US1] Build application status screen `frontend/src/pages/apply/ApplicationStatus.tsx` showing real-time status with reference number and adverse-action notice download
- [ ] T039 [P] [US1] Build TanStack Query hooks for applications API in `frontend/src/hooks/useApplications.ts`
- [ ] T040 [US1] Build application form and status screens in `mobile/src/app/apply/` mirroring web screens
- [ ] T041 [US1] Add seed scripts `backend/src/scripts/seed-apply.ts`, `seed-approve.ts`, `seed-decline.ts` for quickstart verification

**Checkpoint**: User can apply, receive reference number, and see approval/decline with adverse-action notice on web and mobile.

---

## Phase 4: User Story 2 — Activate a New Card (Priority: P2)

**Goal**: A cardholder who received a new card can activate it through the app with last-four
digits and PIN/biometric; activation fails gracefully after 3 bad attempts.

**Independent Test**: Log in as `bob@cardflow.test`, open the app — verify "Activate Card"
prompt is visible; enter last four `0042` and PIN `1234` — verify card status becomes `ACTIVE`.

### Tests for User Story 2 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T042 [P] [US2] Write Pact consumer contract test for `POST /api/v1/cards/:id/activate` in `frontend/tests/contract/cards.pact.test.ts`
- [ ] T043 [P] [US2] Write integration tests for card activation (success, wrong-last-four retry, activation lock) in `backend/tests/integration/card-activation.test.ts`
- [ ] T044 [P] [US2] Write Playwright E2E test for US2 activation happy path in `frontend/tests/e2e/us2-activate.spec.ts`

### Implementation for User Story 2

- [ ] T045 [US2] Add `CreditCard` and `SecurityControl` models to `backend/prisma/schema.prisma`; generate migration `0003_cards`
- [ ] T046 [US2] Implement `card.service.ts` in `backend/src/services/card.service.ts`: `listCards`, `getCard`, `activateCard` (attempt tracking, lock after 3 failures, 5s status update)
- [ ] T047 [US2] Implement card routes in `backend/src/routes/cards/`: `GET /api/v1/cards`, `GET /api/v1/cards/:id`, `POST /api/v1/cards/:id/activate`, `GET /api/v1/cards/:id/account-summary`
- [ ] T048 [US2] Implement Pact provider verification for cards in `backend/tests/contract/cards.provider.test.ts`
- [ ] T049 [P] [US2] Build activation screen `frontend/src/pages/dashboard/ActivateCard.tsx` with last-four input, biometric/PIN challenge, error + lock states
- [ ] T050 [P] [US2] Build card list and activation prompt on dashboard `frontend/src/pages/dashboard/Dashboard.tsx`
- [ ] T051 [P] [US2] Build TanStack Query hooks `frontend/src/hooks/useCards.ts`
- [ ] T052 [US2] Build activation screens in `mobile/src/app/cards/ActivateCard.tsx` using `expo-local-authentication` for biometric

**Checkpoint**: Cardholder can activate a card on web and mobile; 3-failure lock works correctly.

---

## Phase 5: User Story 3 — Account Overview: Balance & Transactions (Priority: P3)

**Goal**: An active cardholder can see their real-time balance, available credit, and a
paginated, filterable transaction list that updates within 60 seconds of a new transaction.

**Independent Test**: Log in as `alice@cardflow.test`; open card `4321` overview — verify
balance, credit limit, statement date visible; run `pnpm --filter backend seed:transaction`
— verify new transaction appears within 60 seconds via WebSocket.

### Tests for User Story 3 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T053 [P] [US3] Write Pact consumer contract tests for `GET /api/v1/cards/:id/transactions` and WebSocket `balance:updated` event in `frontend/tests/contract/transactions.pact.test.ts`
- [ ] T054 [P] [US3] Write integration tests for transaction list (cursor pagination, date filter, category filter) in `backend/tests/integration/transactions.test.ts`
- [ ] T055 [P] [US3] Write integration tests for WebSocket balance and transaction events in `backend/tests/integration/websocket.test.ts`
- [ ] T056 [P] [US3] Write Playwright E2E test for US3: account overview load, filter, real-time update in `frontend/tests/e2e/us3-transactions.spec.ts`

### Implementation for User Story 3

- [ ] T057 [US3] Add `Transaction` model to `backend/prisma/schema.prisma` with indexes on `(cardId, authorisedAt DESC)` and `(cardId, status)`; generate migration `0004_transactions`
- [ ] T058 [US3] Seed MCC → category mapping table `backend/prisma/mcc-categories.json` and load in Prisma seed script
- [ ] T059 [US3] Implement `transaction.service.ts` in `backend/src/services/transaction.service.ts`: `ingestTransaction` (with category derivation), `listTransactions` (keyset pagination + filters), `getTransaction`
- [ ] T060 [US3] Implement transaction routes in `backend/src/routes/transactions/`: `GET /api/v1/cards/:id/transactions` (cursor + filters), `GET /api/v1/cards/:id/transactions/:txId`
- [ ] T061 [US3] Add Redis account summary cache in `backend/src/lib/account-cache.ts`: TTL 60s, invalidated via pub/sub on `transaction:ingest` events
- [ ] T062 [US3] Implement WebSocket route `wss/cards/:cardId` in `backend/src/routes/ws/card-events.ts`: broadcast `balance:updated`, `transaction:new`, `transaction:updated` via Redis pub/sub
- [ ] T063 [US3] Implement Prisma middleware hook `balanceRecalc` in `backend/src/lib/prisma.client.ts` to update `CreditCard.currentBalance` atomically on transaction create/update
- [ ] T064 [US3] Implement Pact provider verification for transactions in `backend/tests/contract/transactions.provider.test.ts`
- [ ] T065 [P] [US3] Build account overview screen `frontend/src/pages/dashboard/AccountOverview.tsx` with balance cards, statement info, WebSocket subscription
- [ ] T066 [P] [US3] Build transaction list screen `frontend/src/pages/transactions/TransactionList.tsx` with infinite scroll (cursor pagination), date + category filter UI
- [ ] T067 [P] [US3] Build transaction detail sheet `frontend/src/pages/transactions/TransactionDetail.tsx` with merchant map pin
- [ ] T068 [P] [US3] Build TanStack Query hooks `frontend/src/hooks/useTransactions.ts` and WebSocket hook `frontend/src/hooks/useCardEvents.ts`
- [ ] T069 [US3] Build account overview + transaction list screens in `mobile/src/app/cards/` mirroring web screens; wire WebSocket via `useCardEvents` hook

**Checkpoint**: Account overview loads ≤2s; real-time balance update on new transaction via WebSocket; cursor pagination works.

---

## Phase 6: User Story 4 — Make and Schedule Payments (Priority: P4)

**Goal**: A cardholder can make a one-time payment (minimum, statement, or custom amount),
set up autopay, and never accidentally submit a duplicate payment.

**Independent Test**: Log in as `alice@cardflow.test`; make a custom payment of $200 from
"Chase Checking ••3421" — verify confirmation screen shows before processing; verify
idempotency: re-submitting the same `Idempotency-Key` within 60s returns 200 (not 201).

### Tests for User Story 4 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T070 [P] [US4] Write Pact consumer contract tests for `POST /api/v1/cards/:id/payments`, `PUT /api/v1/cards/:id/autopay` in `frontend/tests/contract/payments.pact.test.ts`
- [ ] T071 [P] [US4] Write integration tests for payment lifecycle, idempotency key handling, duplicate detection (60s window), and autopay rule creation in `backend/tests/integration/payments.test.ts`
- [ ] T072 [P] [US4] Write Playwright E2E test for US4: one-time payment + confirmation + autopay setup in `frontend/tests/e2e/us4-payments.spec.ts`

### Implementation for User Story 4

- [ ] T073 [US4] Add `Payment`, `AutopayRule`, `LinkedBankAccount` models to `backend/prisma/schema.prisma` with idempotency key unique index; generate migration `0005_payments`
- [ ] T074 [US4] Implement `payment.service.ts` in `backend/src/services/payment.service.ts`: `createPayment` (idempotency, 60s duplicate detection, amount resolution), `cancelPayment`, `listPayments`
- [ ] T075 [US4] Implement autopay rule service methods in `backend/src/services/payment.service.ts`: `upsertAutopayRule`, `deleteAutopayRule`, `getAutopayRule`
- [ ] T076 [US4] Implement payment routes in `backend/src/routes/payments/`: `POST`, `GET`, `DELETE /:id` for one-time payments; `GET`, `PUT`, `DELETE` for `/autopay`
- [ ] T077 [US4] Implement BullMQ payment processor worker in `backend/src/workers/payment.worker.ts`: retry with exponential back-off, dead-letter queue, update Payment status on completion/failure
- [ ] T078 [US4] Implement BullMQ autopay scheduler cron job in `backend/src/workers/autopay-scheduler.ts`: nightly job evaluates active AutopayRules, creates Payment records, enqueues 3-day reminders
- [ ] T079 [US4] Implement Pact provider verification for payments in `backend/tests/contract/payments.provider.test.ts`
- [ ] T080 [P] [US4] Build payment screen + 2-step confirmation flow `frontend/src/pages/payments/MakePayment.tsx` (amount selection → confirmation → success)
- [ ] T081 [P] [US4] Build autopay setup screen `frontend/src/pages/payments/AutopaySetup.tsx`
- [ ] T082 [P] [US4] Build payment history list `frontend/src/pages/payments/PaymentHistory.tsx`
- [ ] T083 [P] [US4] Build TanStack Query hooks `frontend/src/hooks/usePayments.ts`
- [ ] T084 [US4] Build payment screens in `mobile/src/app/payments/` (make payment, autopay, payment history)

**Checkpoint**: Payment confirmation required before processing; idempotency key prevents double-charge; autopay rule persisted; worker processes payments asynchronously.

---

## Phase 7: User Story 5 — Manage Card Security Controls (Priority: P5)

**Goal**: A cardholder can freeze/unfreeze their card in ≤5 seconds, enable transaction
restrictions, and permanently block a lost or stolen card with automatic replacement.

**Independent Test**: Log in as `alice@cardflow.test`; freeze card `4321` — verify status
changes within 5s; run `pnpm --filter backend seed:auth --last-four 4321` — verify `DECLINED`.

### Tests for User Story 5 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T085 [P] [US5] Write Pact consumer contract tests for `PATCH /api/v1/cards/:id/security` and `POST /api/v1/auth/confirm` in `frontend/tests/contract/security.pact.test.ts`
- [ ] T086 [P] [US5] Write integration tests for freeze/unfreeze (timing ≤5s), restriction toggles, re-auth confirmation token, lost/stolen report in `backend/tests/integration/security.test.ts`
- [ ] T087 [P] [US5] Write Playwright E2E test for US5: freeze → simulate auth → unfreeze → verify in `frontend/tests/e2e/us5-security.spec.ts`

### Implementation for User Story 5

- [ ] T088 [US5] Implement `security.service.ts` in `backend/src/services/security.service.ts`: `getSecurityControl`, `updateSecurityControl` (validates confirmation token, calls card-network API synchronously ≤5s), `reportLostStolen`
- [ ] T089 [US5] Implement security routes in `backend/src/routes/security/`: `GET /api/v1/cards/:id/security`, `PATCH /api/v1/cards/:id/security`, `POST /api/v1/cards/:id/security/report-lost-stolen`
- [ ] T090 [US5] Add confirmation token issuance and validation to `backend/src/routes/auth/confirm.ts` (single-use, 60s TTL stored in Redis)
- [ ] T091 [US5] Add AuditLog Prisma middleware hook in `backend/src/lib/prisma.client.ts`: log all mutations to `CreditCard`, `SecurityControl`, `Payment`, `CreditCardApplication`
- [ ] T092 [US5] Implement Pact provider verification for security in `backend/tests/contract/security.provider.test.ts`
- [ ] T093 [P] [US5] Build security settings screen `frontend/src/pages/security/SecuritySettings.tsx` with freeze toggle, restriction toggles (international, online-only, ATM), daily/monthly spend limit inputs
- [ ] T094 [P] [US5] Build re-auth confirmation modal `frontend/src/components/ReAuthModal.tsx` (PIN or biometric; wires to `/auth/confirm`)
- [ ] T095 [P] [US5] Build lost/stolen report flow `frontend/src/pages/security/ReportLostStolen.tsx` with replacement delivery estimate
- [ ] T096 [P] [US5] Build TanStack Query hooks `frontend/src/hooks/useSecurity.ts`
- [ ] T097 [US5] Build security settings + report screens in `mobile/src/app/security/` using `expo-local-authentication` for biometric re-auth

**Checkpoint**: Card freeze round-trip ≤5s confirmed in integration test and E2E; lost/stolen blocks card and creates replacement.

---

## Phase 8: User Story 6 — Smart Notifications & Alerts (Priority: P6)

**Goal**: Cardholders receive transaction alerts within 60 seconds, payment reminders 3 days
before due date, and a one-tap dispute action from any alert.

**Independent Test**: Enable transaction alerts with threshold $0; run
`pnpm --filter backend seed:transaction` — verify in-app notification appears within 60s
in the notification bell and the WebSocket delivers the `notification:new` event.

### Tests for User Story 6 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T098 [P] [US6] Write Pact consumer contract tests for `GET /api/v1/notifications`, `PUT /api/v1/notifications/preferences`, and WebSocket `notification:new` in `frontend/tests/contract/notifications.pact.test.ts`
- [ ] T099 [P] [US6] Write integration tests for notification delivery pipeline (transaction → preference check → job enqueue → delivery within 60s) in `backend/tests/integration/notifications.test.ts`
- [ ] T100 [P] [US6] Write Playwright E2E test for US6: transaction alert delivery + "That wasn't me" dispute flow + card auto-freeze in `frontend/tests/e2e/us6-notifications.spec.ts`

### Implementation for User Story 6

- [ ] T101 [US6] Add `Notification` and `NotificationPreference` models to `backend/prisma/schema.prisma` with index on `(userId, createdAt DESC)`; generate migration `0006_notifications`
- [ ] T102 [US6] Implement `notification.service.ts` in `backend/src/services/notification.service.ts`: `evaluateAndDispatch` (reads preferences, enqueues multi-channel jobs), `markRead`, `markAllRead`, `listNotifications`
- [ ] T103 [US6] Implement notification preferences service methods in `backend/src/services/notification.service.ts`: `getPreferences`, `upsertPreferences`
- [ ] T104 [US6] Implement BullMQ notification worker in `backend/src/workers/notification.worker.ts`: Expo push (APNs/FCM via `expo-server-sdk`), SendGrid email, in-app record creation; retry with DLQ
- [ ] T105 [US6] Wire transaction ingest to notification dispatch: `transaction.service.ts` calls `notification.service.evaluateAndDispatch` after each `ingestTransaction`
- [ ] T106 [US6] Implement WebSocket notification feed route `wss/notifications` in `backend/src/routes/ws/notification-feed.ts` via Redis pub/sub channel `user:{userId}:notifications`
- [ ] T107 [US6] Implement payment reminder cron job in `backend/src/workers/payment-reminder.worker.ts`: runs nightly, creates `PAYMENT_REMINDER` notifications for payments due in ≤3 days
- [ ] T108 [US6] Implement notification routes in `backend/src/routes/notifications/`: `GET /`, `PATCH /:id/read`, `POST /mark-all-read`, `GET /preferences`, `PUT /preferences`
- [ ] T109 [US6] Implement Pact provider verification for notifications in `backend/tests/contract/notifications.provider.test.ts`
- [ ] T110 [P] [US6] Build notification bell + history screen `frontend/src/pages/notifications/NotificationHistory.tsx` with real-time WebSocket subscription and unread badge
- [ ] T111 [P] [US6] Build notification preferences screen `frontend/src/pages/notifications/NotificationPreferences.tsx` with threshold and channel toggles
- [ ] T112 [P] [US6] Build TanStack Query hooks `frontend/src/hooks/useNotifications.ts` and WebSocket hook `frontend/src/hooks/useNotificationFeed.ts`
- [ ] T113 [US6] Build notification screens in `mobile/src/app/notifications/` with push registration via `expo-notifications`

**Checkpoint**: Transaction alert delivered ≤60s confirmed in integration test; "That wasn't me" freezes card and opens dispute; payment reminder fires 3 days before due date.

---

## Phase 9: User Story 7 — Spending Insights & Reports (Priority: P7)

**Goal**: A cardholder can view their spending by category for any period, compare
month-over-month, and set category budgets with 80% threshold alerts.

**Independent Test**: Run `pnpm --filter backend seed:aggregate` to trigger the nightly
aggregation; navigate to Insights for card `4321` — verify category breakdown for current
month with amounts and percentages.

### Tests for User Story 7 ⚠️ WRITE FIRST — MUST FAIL BEFORE IMPLEMENTATION

- [ ] T114 [P] [US7] Write Pact consumer contract tests for `GET /api/v1/cards/:id/insights/summary`, `/trend`, `/budgets` in `frontend/tests/contract/insights.pact.test.ts`
- [ ] T115 [P] [US7] Write integration tests for nightly aggregation worker (creates correct snapshots), budget CRUD, and 80% threshold alert in `backend/tests/integration/insights.test.ts`
- [ ] T116 [P] [US7] Write Playwright E2E test for US7: category breakdown view, trend drill-down, budget creation + 80% alert in `frontend/tests/e2e/us7-insights.spec.ts`

### Implementation for User Story 7

- [ ] T117 [US7] Add `SpendingInsightSnapshot` and `SpendingBudget` models to `backend/prisma/schema.prisma` with unique constraint on `(cardId, periodType, periodStart, category)` and index on `(cardId, periodType, periodStart DESC)`; generate migration `0007_insights`
- [ ] T118 [US7] Implement nightly BullMQ aggregation worker in `backend/src/workers/insights.worker.ts`: group transactions by `(cardId, category, period)`, upsert `SpendingInsightSnapshot` records; check active `SpendingBudget` records for 80% threshold; enqueue `BUDGET_THRESHOLD` notifications
- [ ] T119 [US7] Implement `insights.service.ts` in `backend/src/services/insights.service.ts`: `getSummary` (reads snapshots), `getTrend` (multi-period comparison), `listBudgets` (with utilisation calculation), `createBudget`, `updateBudget`, `deleteBudget`
- [ ] T120 [US7] Implement insights routes in `backend/src/routes/insights/`: `GET /summary`, `GET /trend`, `GET /budgets`, `POST /budgets`, `PUT /budgets/:id`, `DELETE /budgets/:id`
- [ ] T121 [US7] Implement Pact provider verification for insights in `backend/tests/contract/insights.provider.test.ts`
- [ ] T122 [P] [US7] Build insights overview screen `frontend/src/pages/insights/InsightsOverview.tsx`: period selector, category breakdown with pie/bar chart (recharts), total spend summary
- [ ] T123 [P] [US7] Build category detail + trend screen `frontend/src/pages/insights/CategoryDetail.tsx`: merchant list, month-over-month comparison chart
- [ ] T124 [P] [US7] Build budget management screen `frontend/src/pages/insights/Budgets.tsx`: CRUD for budgets, utilisation progress bars, 80% alert badge
- [ ] T125 [P] [US7] Build TanStack Query hooks `frontend/src/hooks/useInsights.ts`
- [ ] T126 [US7] Build insights screens in `mobile/src/app/insights/` mirroring web screens with React Native SVG charts
- [ ] T127 [US7] Add `pnpm --filter backend seed:aggregate` script to `backend/src/scripts/seed-aggregate.ts` for quickstart verification

**Checkpoint**: Category breakdown visible for all periods; 80% budget alert fires; month-over-month comparison accurate.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Observability, performance, accessibility, security hardening, compliance, deployment

- [ ] T128 [P] Instrument backend with OpenTelemetry JS SDK (`@opentelemetry/sdk-node`) in `backend/src/lib/telemetry.ts`: auto-instrument Fastify, Prisma, BullMQ, Redis; export to AWS X-Ray via OTLP
- [ ] T129 [P] Expose `prom-client` metrics at `GET /metrics` (internal network only) in `backend/src/routes/metrics.ts`: `http_request_duration_seconds`, `queue_job_duration_seconds`, `active_websocket_connections`, `notification_delivery_latency_seconds`
- [ ] T130 [P] Create Grafana dashboard JSON at `infra/grafana/cardflow-dashboard.json` for key metrics and configure PagerDuty alert rules
- [ ] T131 [P] Add Playwright Lighthouse performance audit to `.github/workflows/deploy-staging.yml`: fail if LCP > 2.5s, INP > 200ms, or CLS > 0.1
- [ ] T132 [P] Run axe-core WCAG 2.1 AA audit on all web screens via Playwright; fix all critical and serious violations; update `frontend/tests/e2e/accessibility.spec.ts`
- [ ] T133 [P] Security hardening: run `npm audit --audit-level=critical` in CI; enable Dependabot for all workspaces; add `eslint-plugin-security` scan gate to `pr-checks.yml`
- [ ] T134 [P] Reg Z compliance review: verify APR, fees, minimum payment calculation shown on application and payment confirmation screens; add integration tests asserting disclosure presence
- [ ] T135 Create Dockerfile for backend API server at `backend/Dockerfile` and BullMQ worker at `backend/Dockerfile.worker`; create `.github/workflows/deploy-production.yml` with blue-green ECS deploy
- [ ] T136 [P] Write runbook `docs/runbook.md` covering: local dev setup, common failures (DB down, Redis down, payment worker stuck), alert response procedures, PagerDuty escalation contacts
- [ ] T137 Validate all 8 success criteria from `spec.md` are measurable in staging: SC-001 through SC-008; document evidence in `docs/launch-readiness.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — **BLOCKS all user stories**
- **US1 (Phase 3)**: Requires Foundational — no dependency on other stories
- **US2 (Phase 4)**: Requires Foundational — no dependency on other stories
- **US3 (Phase 5)**: Requires Foundational + US2 (CreditCard model)
- **US4 (Phase 6)**: Requires Foundational + US2 (CreditCard model)
- **US5 (Phase 7)**: Requires Foundational + US2 (SecurityControl model seeded in Phase 4)
- **US6 (Phase 8)**: Requires Foundational + US3 (transaction ingest hook)
- **US7 (Phase 9)**: Requires Foundational + US3 (transaction data for aggregation)
- **Polish (Phase 10)**: Requires all desired user stories complete

### User Story Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
       ├── Phase 3 (US1 - Application)     ← independent
       ├── Phase 4 (US2 - Activation)      ← independent
       │    └── Phase 5 (US3 - Overview)   ← needs CreditCard model
       │    └── Phase 6 (US4 - Payments)   ← needs CreditCard model
       │    └── Phase 7 (US5 - Security)   ← needs SecurityControl model
       └── Phase 5 (US3 - Transactions)
            ├── Phase 8 (US6 - Notifications) ← needs transaction ingest
            └── Phase 9 (US7 - Insights)      ← needs transaction data
```

### Within Each User Story

1. Write and confirm tests FAIL (RED)
2. Prisma model + migration
3. Service layer
4. Routes + Fastify schemas
5. Pact provider verification
6. Frontend (web) screens + hooks
7. Mobile screens
8. Confirm tests PASS (GREEN)
9. Refactor; keep green

### Parallel Opportunities

- All Phase 1 tasks marked `[P]` can run in parallel
- All Phase 2 tasks marked `[P]` can run in parallel within the phase
- Once Foundational phase completes, US1 and US2 can run fully in parallel
- Once US2 (CreditCard model) is done, US3/US4/US5 can start in parallel (different service files)
- Within each story: all `[P]` tasks can run in parallel with each other
- Contract tests `[P]` can run in parallel with each other within a story
- Frontend and mobile tasks within a story can run in parallel with backend tasks

---

## Parallel Example: User Story 3

```bash
# After T057 (Transaction model) is merged:
# These can all run in parallel:
T058 - Seed MCC category mapping
T059 - transaction.service.ts
T065 - AccountOverview.tsx (web)
T066 - TransactionList.tsx (web)
T069 - mobile screens

# After T059 (service) is merged:
T060 - transaction routes
T061 - Redis cache
T062 - WebSocket routes
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (Apply + Track)
4. Complete Phase 4: US2 (Activate)
5. Complete Phase 5: US3 (Overview + Transactions)
6. **STOP and VALIDATE**: All 3 stories independently testable; run quickstart.md steps
7. Deploy to staging; run Playwright E2E suite; verify SC-006 (2s load time)

### Incremental Delivery

- **Sprint 1** (Weeks 1–2): Phases 1–2 (Foundation)
- **Sprint 2** (Weeks 3–5): Phases 3–4 (US1 + US2 — new cardholder onboarding)
- **Sprint 3** (Weeks 6–7): Phase 5 (US3 — account overview) → **MVP demo**
- **Sprint 4** (Weeks 8–9): Phase 6 (US4 — payments)
- **Sprint 5** (Week 10): Phase 7 (US5 — security)
- **Sprint 6** (Week 11): Phase 8 (US6 — notifications)
- **Sprint 7** (Weeks 12–13): Phase 9 (US7 — insights)
- **Sprint 8** (Week 14): Phase 10 (Polish + production hardening)

### Parallel Team Strategy

With 2 backend + 1 frontend/mobile engineer:
1. Team completes Phases 1–2 together (shared foundation)
2. Once Foundational complete:
   - BE: US1 services + routes; FE: US1 screens (Phases 3–4 sequential on each track)
   - US2 and US3 can overlap once CreditCard model is in place (US2 BE can run while US1 FE builds)
3. Each story lands independently on staging for product review before proceeding

---

## Notes

- `[P]` tasks have different output files and no dependency on incomplete tasks — safe to run simultaneously
- `[USN]` label maps each task to its user story for traceability
- Constitution Principle II (Test-First) MUST be enforced: test files MUST be committed and confirmed FAILING before any implementation task in the same story begins
- Each user story phase ends with a **Checkpoint** — confirm independently before moving to the next story
- Commit after each task or logical group (one commit per Prisma migration is strongly recommended)
- Do not share output files between parallel tasks — the `[P]` marker guarantees this
