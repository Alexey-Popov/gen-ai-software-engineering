# Implementation Plan: CardFlow — Credit Card Lifecycle Management

**Branch**: `001-credit-card-lifecycle` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-credit-card-lifecycle/spec.md`

---

## Summary

CardFlow is a finance-oriented web and mobile application covering the full credit card
lifecycle: application, activation, balance and transaction management, payments, security
controls, notifications, and spending insights. The backend is built on **Node.js 22 LTS +
TypeScript 5** with **Fastify 5** as the HTTP framework. The web frontend uses **React 19**
and the mobile app uses **React Native 0.76 / Expo SDK 52**. Data is persisted in
**PostgreSQL 16** with a **Redis 7** layer for caching, pub/sub, and background job queues.
Delivery is phased: a production-ready MVP (P1–P3 user stories) ships first, with P4–P7
following in two subsequent iterations.

---

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (backend); TypeScript 5.x / React
19 (web); TypeScript 5.x / React Native 0.76 + Expo SDK 52 (mobile)

**Primary Dependencies**:

| Layer | Library | Version | Role |
|---|---|---|---|
| Backend | Fastify | 5.x | HTTP framework |
| Backend | Prisma | 6.x | ORM + migrations |
| Backend | BullMQ | 5.x | Redis-backed job queues |
| Backend | Zod | 3.x | Schema validation + type inference |
| Backend | Jose | 5.x | JWT signing/verification |
| Backend | @fastify/websocket | 9.x | WebSocket support |
| Backend | Pino | 9.x | Structured JSON logging |
| Web | React | 19.x | UI framework |
| Web | TanStack Query | 5.x | Server-state management |
| Web | React Router | 7.x | Client-side routing |
| Web | Tailwind CSS | 4.x | Utility-first styling |
| Web | React Hook Form + Zod | — | Form validation |
| Mobile | React Native | 0.76.x | Cross-platform mobile UI |
| Mobile | Expo SDK | 52.x | Build toolchain + native modules |
| Mobile | React Navigation | 7.x | Stack/tab navigation |
| Testing | Vitest | 3.x | Unit + integration test runner |
| Testing | Supertest | 7.x | HTTP integration tests |
| Testing | Pact JS | 13.x | Consumer-driven contract tests |
| Testing | Playwright | 1.x | E2E web tests |
| Testing | Detox | 20.x | E2E mobile tests |
| Testing | testcontainers-node | 10.x | Ephemeral DB for integration tests |

**Storage**:
- PostgreSQL 16 — primary relational store (ACID, row-level security for PCI scope)
- Redis 7 — session tokens, real-time pub/sub, BullMQ backing store, rate-limit counters
- S3-compatible object storage (AWS S3 / MinIO local) — adverse-action PDFs, document store

**Testing**: Vitest (unit + integration), Supertest, Pact JS (contract), Playwright (E2E
web), Detox (E2E mobile), testcontainers-node (real DB in CI)

**Target Platform**: Web (evergreen browsers, desktop + mobile viewports) + iOS 16+ /
Android 10+ native app

**Project Type**: Web application (REST + WebSocket API backend + SPA frontend) with a
companion React Native mobile app

**Performance Goals**:
- Account overview screen: ≤ 2 s load at p95 on 4G
- Transaction notification delivery: ≤ 60 s at p95
- Card freeze/unfreeze round-trip: ≤ 5 s
- API reads: p95 ≤ 200 ms; API writes: p95 ≤ 500 ms

**Constraints**:
- PCI-DSS Level 1 — no raw PAN storage; all card numbers tokenised via external vault
- GDPR/CCPA — data minimisation, right-to-erasure with pseudonymisation of financial records
- Reg Z / FCRA — mandatory disclosures; adverse-action notices for declined applications
- Zero-trust auth: 15-minute JWT access tokens + rotating 90-day refresh tokens
- All secrets managed via environment variables / AWS Secrets Manager; no hardcoded credentials
- Financial data responses must carry `Cache-Control: no-store`

**Scale/Scope**:
- Target 50 k–200 k cardholders at launch; scale to 1 M within 18 months
- Up to 5 cards per cardholder
- ~500 transactions per card per month
- 7 user stories across 3 platforms (backend, web, mobile)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Code Quality Standards | Single-responsibility services; no dead code at merge; zero-warning lint enforced in CI | ✅ PASS |
| II. Test-First Development | Acceptance scenarios from spec encoded as failing tests before implementation begins; TDD enforced | ✅ PASS |
| III. Testing Standards | Unit + integration + contract (Pact) + E2E (Playwright + Detox) planned; 80% coverage gate in CI | ✅ PASS |
| IV. UX Consistency | Shared component library (Tailwind + design tokens); WCAG 2.1 AA; UX review gate for P1–P3 | ✅ PASS |
| V. Performance Requirements | LCP/INP/CLS budgets enforced in CI via Playwright Lighthouse; p95 API budgets measured; perf regression gate | ✅ PASS |

**Post-Phase-1 re-check**: All principles confirmed PASS after data model and contract
design. No violations. Complexity Tracking table is empty.

---

## Technology Stack Decisions & Rationale

### Backend Framework: Fastify 5 over Express

Fastify is chosen over Express for the backend because:

1. **Performance**: Fastify handles ~2× more requests/s than Express at equivalent load,
   which matters when serving real-time balance endpoints to tens of thousands of
   concurrent cardholders.
2. **Schema-first validation**: Fastify's native JSON Schema integration rejects malformed
   inputs at the HTTP boundary before they reach business logic, reducing defensive coding
   inside services.
3. **TypeScript-native**: First-class TypeScript generics for routes, schemas, and hooks
   eliminate a category of runtime type mismatch.
4. **Plugin ecosystem**: Mature plugins for WebSocket, CORS, rate limiting, Swagger/OpenAPI
   generation, and Helmet security headers.

*Hapi.js considered* — more opinionated, smaller community. *NestJS considered* — good
structure but adds significant boilerplate; Fastify's lighter footprint is preferred for a
team that controls its own architecture.

### ORM: Prisma 6

Prisma generates TypeScript types directly from the schema, creating a single source of
truth for the data model. Its migration tooling (`prisma migrate deploy`) is auditable and
safe for production. The query builder is type-safe end-to-end, eliminating SQL-injection
risk within the ORM boundary.

*TypeORM considered* — weaker TypeScript integration, active-record pattern mixes concerns.
*Drizzle considered* — excellent type safety but younger ecosystem; Prisma's migration
history and community are preferable for a financial-grade app.

### Job Queue: BullMQ 5

BullMQ uses Redis as its backing store and provides: durable jobs (survive process restart),
retry with exponential back-off, dead-letter queues, rate limiting, and a rich UI dashboard.
These properties are non-negotiable for payment processing and notification delivery.

### Frontend: React 19 + Vite 6

React 19 with the new Compiler reduces manual memoisation burden. Vite 6 provides
sub-second HMR and smaller production bundles than webpack. TanStack Query v5 manages
server state (stale-while-revalidate, background refetch) to avoid loading spinners on
navigation.

### Mobile: React Native + Expo SDK 52

React Native shares component knowledge and type definitions with the web frontend, reducing
the effective team size needed to maintain two clients. Expo SDK 52 provides over-the-air
JS updates, simplifying security patch delivery between app-store releases. Expo Go
eliminates the need for native toolchain setup during development.

### Auth: Custom JWT with Jose

A hand-rolled JWT implementation using the `jose` library (OIDC-compliant, WebCrypto API)
is preferred over Passport.js for this project because:

- No hidden session store coupling
- Refresh token rotation (every use issues a new token, invalidates the old one) is
  implemented explicitly — critical for detecting token theft
- HttpOnly + SameSite=Strict cookies on web; Expo SecureStore (iOS Keychain / Android
  Keystore) on mobile

### Card Vault: Basis Theory

PAN tokenisation is delegated to Basis Theory (or equivalent PCI-certified vault). CardFlow
stores only vault tokens and last-four digits. This removes CardFlow from PCI-DSS SAQ D
scope, reducing the annual audit burden from ~300 controls to ~40.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│   Browser SPA (React 19)          Mobile App (RN / Expo 52)     │
└──────────────┬──────────────────────────────┬───────────────────┘
               │ HTTPS + WSS                  │ HTTPS + WSS
               ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                    │
│            (AWS ALB with WAF — rate limit, HTTPS term)           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
               ┌───────────────▼──────────────┐
               │       Fastify API Server      │
               │  (multiple instances, ECS)    │
               │                               │
               │  ┌─────────────────────────┐  │
               │  │  Auth Middleware         │  │
               │  │  Rate-Limit Plugin      │  │
               │  │  Request Validation     │  │
               │  │  Error Handler          │  │
               │  └─────────────────────────┘  │
               │                               │
               │  Route Domains:               │
               │  /applications  /cards        │
               │  /transactions  /payments     │
               │  /security      /notifications│
               │  /insights                    │
               └──────┬─────────────┬──────────┘
                      │             │
         ┌────────────▼──┐   ┌──────▼────────────┐
         │  PostgreSQL 16 │   │     Redis 7        │
         │  (Primary +    │   │  ┌──────────────┐  │
         │   Read Replica)│   │  │ Session store│  │
         └────────────────┘   │  │ Pub/Sub      │  │
                              │  │ BullMQ queues│  │
                              │  │ Rate counters│  │
                              │  └──────────────┘  │
                              └────────────────────┘
                      │
         ┌────────────▼──────────────────────┐
         │          BullMQ Workers            │
         │  payment-processor  notifier       │
         │  insight-aggregator pdf-generator  │
         └──────────────────────────────────┬─┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
           ┌────────────────┐   ┌────────────────────┐  ┌──────────────────┐
           │  Card Vault    │   │  Payment Gateway   │  │ Notification     │
           │  (Basis Theory)│   │  (ACH / Card Net.) │  │ (APNs + FCM +    │
           │  PAN tokenise  │   │  (Plaid / Stripe)  │  │  SendGrid)       │
           └────────────────┘   └────────────────────┘  └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| API Server (Fastify) | HTTP + WebSocket request handling, auth, validation, routing to services |
| Application Service | Application lifecycle: draft → submitted → approved/declined |
| Card Service | Card status, balance updates, activation flow |
| Transaction Service | Transaction ingestion from card network, categorisation, WebSocket fan-out |
| Payment Service | Payment scheduling, one-time and autopay, idempotency |
| Security Service | Freeze/unfreeze, restriction management, lost/stolen reporting |
| Notification Service | Preference evaluation, multi-channel dispatch (push, email, in-app) |
| Insights Service | Pre-aggregated spending snapshots, budget alerting |
| BullMQ Workers | Async payment processing, notification delivery, nightly insight aggregation |
| PostgreSQL | Source of truth for all financial records |
| Redis | Session tokens, WebSocket message broker, BullMQ backing store |

---

## Database Design Approach

Full schema is defined in [data-model.md](data-model.md). Highlights:

- **Migrations**: Prisma migrations only; no manual schema changes. Every migration is
  reviewed as part of the PR process.
- **Soft-delete**: All user PII uses `deletedAt` timestamps. Hard-delete occurs on a
  background job after a 30-day GDPR grace period; financial records (transactions,
  payments) are pseudonymised instead of deleted to satisfy record-keeping requirements.
- **Row-level security**: PostgreSQL RLS policies enforce that application-level queries
  cannot access another user's data even if there is a bug in the service layer.
- **Indexing strategy**: Cursor-based (keyset) pagination on transaction and notification
  lists to avoid `OFFSET` degradation at scale. Composite indexes on `(cardId, createdAt DESC)`.
- **Audit log**: All writes to security-sensitive tables (CreditCard, SecurityControl,
  Payment) are written to an immutable `AuditLog` table via a Prisma middleware hook.

---

## API Architecture

- **Protocol**: REST/JSON over HTTPS for request/response; WebSocket (Fastify WS) for
  real-time balance and notification push.
- **Versioning**: URL path versioning (`/api/v1/`). Breaking changes require a new version.
- **OpenAPI**: Fastify's JSON Schema definitions auto-generate an OpenAPI 3.1 spec at
  `/docs` (Swagger UI, disabled in production).
- **Idempotency**: All payment creation endpoints require an `Idempotency-Key` UUID header.
  The server stores the response for 24 hours and returns it on replay.
- **Error format**: RFC 9457 Problem Details (`application/problem+json`).
- **Rate limiting**: Per-user sliding window via Redis. Default: 300 req/min per user;
  stricter limits on auth endpoints (10 req/min).

Full endpoint contracts: [contracts/](contracts/)

---

## Authentication & Authorisation Strategy

### Flow

```
1. POST /auth/login → { accessToken (15 min JWT), refreshToken (HttpOnly cookie, 90 days) }
2. Every request → Bearer accessToken in Authorization header
3. POST /auth/refresh → rotate refreshToken, issue new accessToken
4. POST /auth/logout → invalidate refreshToken in Redis
```

### Access Token (JWT)

- Signed with RS256 (2048-bit RSA key pair); public key exposed at `/auth/.well-known/jwks.json`
- Payload: `{ sub: userId, iat, exp, jti }`
- 15-minute expiry; non-revocable (short window is the revocation mechanism)

### Refresh Token

- Cryptographically random 256-bit opaque token stored as bcrypt hash in PostgreSQL
- Delivered in `HttpOnly; SameSite=Strict; Secure` cookie on web
- Stored in `expo-secure-store` (iOS Keychain / Android Keystore) on mobile
- Rotation: every `/auth/refresh` call issues a new token and revokes the previous one
- Theft detection: if an already-revoked refresh token is presented, all sessions for the
  user are invalidated immediately

### Security Re-confirmation

High-risk actions (security control changes, lost/stolen report) require a short-lived
confirmation token (`POST /auth/confirm`, TTL 60 s, single-use). This prevents CSRF and
session-riding attacks on sensitive mutations.

### Authorisation

- Resource ownership enforced in service layer: every query includes `WHERE userId = ?`
- No RBAC in v1; all authenticated users are cardholders with equal access to their own resources

---

## Security Controls

| Control | Implementation |
|---|---|
| Transport | TLS 1.3 required; HSTS max-age 1 year |
| Input validation | Zod schemas at service boundary; Fastify JSON Schema at HTTP boundary |
| SQL injection | Prisma parameterised queries exclusively; no raw SQL strings with user input |
| XSS | CSP headers via Helmet; React's auto-escaping |
| CSRF | SameSite=Strict cookies + `X-Requested-With` header check on state-changing requests |
| Secrets | AWS Secrets Manager; no secrets in env files committed to VCS |
| PAN handling | Delegated to Basis Theory vault; zero raw PANs in CardFlow |
| Rate limiting | Redis sliding window; stricter limits on auth and security endpoints |
| Security headers | Helmet.js: X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Dependency scanning | Dependabot + `npm audit` in CI; block on critical vulnerabilities |
| SAST | ESLint security plugin (`eslint-plugin-security`) in CI |

---

## Observability

### Logging

- **Library**: Pino (structured JSON; zero-copy serialisation)
- **Levels**: `error`, `warn`, `info`, `debug` (debug disabled in production)
- **Correlation**: `requestId` propagated through all log lines per request
- **Sensitive field redaction**: PII and financial amounts redacted from logs by default
- **Destination**: stdout → AWS CloudWatch Logs (structured JSON queries)

### Metrics

- **Library**: `prom-client` (Prometheus format)
- **Exposed**: `GET /metrics` (internal network only)
- **Key metrics**: `http_request_duration_seconds`, `queue_job_duration_seconds`,
  `notification_delivery_latency_seconds`, `active_websocket_connections`
- **Dashboard**: Grafana connected to Prometheus

### Tracing

- **Library**: OpenTelemetry JS SDK (`@opentelemetry/sdk-node`)
- **Exporter**: AWS X-Ray (via OTLP)
- **Instrumentation**: Fastify, Prisma, BullMQ, Redis auto-instrumented

### Alerting

- Fraud alert delivery latency > 90 s → PagerDuty P1
- Payment processing failure rate > 1% → PagerDuty P2
- API p95 error rate > 0.5% → PagerDuty P2
- DB connection pool exhaustion → PagerDuty P1

---

## Testing Strategy

### Layers (constitution-mandated)

| Layer | Tool | Scope | Coverage target |
|---|---|---|---|
| Unit | Vitest | Services, utilities, validators | ≥ 80% per module |
| Integration | Vitest + Supertest + testcontainers | API routes against real DB | All happy + sad paths |
| Contract | Pact JS | Backend ↔ web and mobile consumers | All API routes |
| E2E web | Playwright | All P1–P3 user stories | Full happy path |
| E2E mobile | Detox | All P1–P3 user stories | Full happy path |

### TDD Protocol (constitution II — NON-NEGOTIABLE)

```
1. Write acceptance test from spec scenario (must FAIL)
2. Get peer review on test
3. Confirm test fails in CI
4. Implement until test passes
5. Refactor; keep tests green
```

### Test Infrastructure

- **testcontainers-node**: Spins up a fresh PostgreSQL instance for each integration test
  suite; tests run against a real DB with Prisma migrations applied.
- **No DB mocks**: Mock databases are prohibited (see constitution III rationale — prior
  incident where mock tests passed but production migration failed).
- **Pact broker**: Self-hosted Pact Broker records contract versions; provider verification
  runs on every backend deploy.

---

## CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│  PR Checks (on every push to feature branch)                         │
│                                                                       │
│  lint → typecheck → unit-tests → integration-tests → contract-tests  │
│       → coverage-gate (≥80%) → security-scan → build                │
└─────────────────────────────────────────────────────────────────────┘
                               │ (all green)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Merge to main                                                        │
│                                                                       │
│  PR checks + e2e-web (Playwright) + e2e-mobile (Detox) +             │
│  performance-audit (Playwright Lighthouse) → Docker image build →    │
│  push to ECR → deploy to staging                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │ (staging smoke tests pass)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Release to Production (manual gate on main → release tag)           │
│                                                                       │
│  Blue-green deploy via ECS → health checks → traffic cut-over →      │
│  rollback if error rate spikes → Pact provider verification          │
└─────────────────────────────────────────────────────────────────────┘
```

**Tooling**: GitHub Actions, Docker, AWS ECR/ECS, AWS Secrets Manager

---

## Deployment Architecture

- **Containerisation**: Docker images for backend (Node.js server) and worker (BullMQ)
- **Orchestration**: AWS ECS Fargate (serverless containers; no EC2 management)
- **Database**: AWS RDS PostgreSQL 16 (Multi-AZ, automated backups, point-in-time recovery)
- **Cache**: AWS ElastiCache Redis 7 (cluster mode, automatic failover)
- **Load balancer**: AWS Application Load Balancer with WAF (OWASP rule set)
- **CDN**: AWS CloudFront for static web assets; long cache headers
- **Object storage**: AWS S3 for adverse-action PDFs (SSE-S3, lifecycle 7-year retention)
- **Secrets**: AWS Secrets Manager with automatic rotation
- **Monitoring**: CloudWatch + Prometheus + Grafana + PagerDuty

---

## Project Structure

### Documentation (this feature)

```text
specs/001-credit-card-lifecycle/
├── plan.md              # This file
├── research.md          # Phase 0 research
├── data-model.md        # Phase 1 entity definitions
├── quickstart.md        # Developer quick-start
├── contracts/           # API contracts
│   ├── applications.md
│   ├── cards.md
│   ├── transactions.md
│   ├── payments.md
│   ├── security.md
│   ├── notifications.md
│   └── insights.md
└── tasks.md             # Generated by /speckit-tasks
```

### Source Code Repository Structure

```text
card-flow/                          # Monorepo root (pnpm workspaces)
├── package.json                    # Root scripts: lint, test, build
├── pnpm-workspace.yaml
├── .github/
│   └── workflows/
│       ├── pr-checks.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── docker-compose.yml              # Local dev: PostgreSQL + Redis + MinIO
│
├── packages/
│   └── shared/                     # Shared TypeScript types + Zod schemas
│       ├── src/
│       │   ├── types/              # Shared domain types (Card, Transaction, etc.)
│       │   └── schemas/            # Zod schemas re-used in web + mobile + backend
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── app.ts                  # Fastify app factory
│   │   ├── server.ts               # Entry point
│   │   ├── config/                 # Environment config (Zod-validated)
│   │   ├── plugins/                # Fastify plugins (auth, cors, rate-limit, ws)
│   │   ├── middleware/             # Request lifecycle hooks
│   │   ├── routes/                 # Route registrations (thin controllers)
│   │   │   ├── applications/
│   │   │   ├── cards/
│   │   │   ├── transactions/
│   │   │   ├── payments/
│   │   │   ├── security/
│   │   │   ├── notifications/
│   │   │   └── insights/
│   │   ├── services/               # Business logic (one service per domain)
│   │   │   ├── application.service.ts
│   │   │   ├── card.service.ts
│   │   │   ├── transaction.service.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── security.service.ts
│   │   │   ├── notification.service.ts
│   │   │   └── insights.service.ts
│   │   ├── workers/                # BullMQ job processors
│   │   │   ├── payment.worker.ts
│   │   │   ├── notification.worker.ts
│   │   │   └── insights.worker.ts
│   │   ├── lib/                    # Prisma client, Redis client, vault client
│   │   └── types/                  # Internal TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── contract/               # Pact provider tests
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/             # Shared design-system components
│   │   ├── pages/
│   │   │   ├── apply/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── payments/
│   │   │   ├── security/
│   │   │   ├── notifications/
│   │   │   └── insights/
│   │   ├── hooks/                  # TanStack Query hooks (one per domain)
│   │   ├── services/               # API client (typed fetch wrappers)
│   │   └── stores/                 # Zustand: auth, active card
│   └── tests/
│       ├── unit/
│       ├── contract/               # Pact consumer tests
│       └── e2e/                    # Playwright
│
└── mobile/
    ├── src/
    │   ├── app/                    # Expo Router screens
    │   ├── components/
    │   ├── hooks/                  # Re-used from frontend where possible
    │   ├── services/               # Same API client as frontend (shared package)
    │   └── stores/
    └── tests/
        └── e2e/                    # Detox
```

**Structure Decision**: Monorepo (pnpm workspaces) with three packages: `backend`,
`frontend`, `mobile`, and one shared `packages/shared` library for domain types and Zod
schemas. Monorepo reduces type drift between layers and simplifies CI caching.

---

## Coding Standards

- **Formatter**: Prettier (enforced in CI; no config debates)
- **Linter**: ESLint 9 with: `@typescript-eslint`, `eslint-plugin-security`,
  `eslint-plugin-import`, `eslint-plugin-react-hooks`
- **Naming**:
  - Files: `kebab-case.ts`
  - Classes/Types/Interfaces: `PascalCase`
  - Functions/variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Database columns: `camelCase` (Prisma handles snake_case mapping)
- **No `any`**: TypeScript strict mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Error handling**: All errors are typed `Result<T, E>` at service boundaries using a
  lightweight discriminated union; no untyped `throw` in service code
- **Comments**: Only when the *why* is non-obvious; no inline comments explaining what
  the code does

---

## Environment Setup

See [quickstart.md](quickstart.md) for the full step-by-step guide. Summary:

| Tool | Version | Install |
|---|---|---|
| Node.js | 22 LTS | nvm / fnm |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker Desktop | 4.x | docker.com |
| Expo CLI | 0.18.x | `pnpm add -g expo-cli` |

```bash
git clone <repo> card-flow && cd card-flow
pnpm install
docker compose up -d       # PostgreSQL + Redis + MinIO
cd backend && pnpm db:migrate && pnpm db:seed
pnpm --filter backend dev  # :4000
pnpm --filter frontend dev # :5173
pnpm --filter mobile start # Expo Metro
```

---

## Implementation Phases & Milestones

### Phase 0 — Foundation (Weeks 1–2, 2 engineers)

**Goal**: Working skeleton with auth, CI, and deployed infrastructure.

| # | Task | Owner |
|---|---|---|
| T001 | Monorepo setup: pnpm workspaces, TypeScript configs, ESLint, Prettier | BE |
| T002 | Fastify app factory, plugin registration, health endpoint | BE |
| T003 | Prisma schema (User, CreditCard, initial models) + first migration | BE |
| T004 | Auth endpoints: register, login, refresh, logout (JWT + rotating refresh tokens) | BE |
| T005 | Docker Compose (PostgreSQL, Redis, MinIO) + `.env.example` | BE |
| T006 | GitHub Actions: PR checks pipeline (lint, typecheck, unit test) | BE |
| T007 | React app scaffold: Vite, React Router, Tailwind, TanStack Query | FE |
| T008 | Login and registration screens with form validation | FE |
| T009 | Expo app scaffold: navigation, auth screens, API client | MOB |
| T010 | Shared types package with domain interfaces | BE |

**Milestone**: `POST /auth/login` issues valid JWT; CI pipeline green on all checks.

---

### Phase 1 — MVP: Application & Activation (Weeks 3–5, 3 engineers)

**Goal**: Complete US1 (card application) and US2 (card activation) end-to-end.

| # | Task | Owner |
|---|---|---|
| T011 | [P] Application schema + Prisma migration | BE |
| T012 | [P] Application service: create draft, update, submit, withdraw | BE |
| T013 | Application routes + Fastify schemas | BE |
| T014 | Underwriting webhook handler (internal endpoint) | BE |
| T015 | Adverse-action PDF generation (pdf-lib) + S3 upload | BE |
| T016 | Card schema + activation service | BE |
| T017 | [P] Pact consumer tests for application + card endpoints | FE |
| T018 | [P] Application form screens (web) | FE |
| T019 | [P] Application status screen (web) | FE |
| T020 | [P] Activation screen (web) | FE |
| T021 | Application form screens (mobile) | MOB |
| T022 | Activation screen (mobile) | MOB |
| T023 | Integration tests: application lifecycle | BE |
| T024 | E2E web: US1 + US2 happy paths (Playwright) | FE |

**Milestone**: User can apply, track status, and activate a card on both web and mobile.

---

### Phase 2 — MVP: Account Overview & Transactions (Weeks 6–7, 3 engineers)

**Goal**: Complete US3 (balance, transactions) — most-visited screen in the app.

| # | Task | Owner |
|---|---|---|
| T025 | [P] Transaction schema + Prisma migration | BE |
| T026 | Transaction service: ingest, categorise (MCC table), list with cursor pagination | BE |
| T027 | WebSocket plugin: balance:updated, transaction:new events | BE |
| T028 | Account overview route + Fastify schema | BE |
| T029 | Transaction list route (cursor pagination, filters) | BE |
| T030 | Redis cache: account summary (TTL 60 s, invalidated on new transaction) | BE |
| T031 | [P] Account overview screen (web) | FE |
| T032 | [P] Transaction list + filter screen (web) | FE |
| T033 | Transaction detail sheet (web) | FE |
| T034 | Account overview screen (mobile) | MOB |
| T035 | Transaction list screen (mobile) | MOB |
| T036 | Integration tests: transaction flow | BE |
| T037 | E2E web: US3 (Playwright) | FE |

**Milestone**: Account overview screen loads in ≤ 2 s; real-time transaction push works.

---

### Phase 3 — Payments (Weeks 8–9, 2 engineers)

**Goal**: Complete US4 (one-time payments + autopay).

| # | Task | Owner |
|---|---|---|
| T038 | [P] Payment schema + Prisma migration | BE |
| T039 | Payment service: one-time, idempotency, duplicate detection (60 s window) | BE |
| T040 | AutopayRule service + BullMQ scheduled payment worker | BE |
| T041 | Payment routes + Fastify schemas | BE |
| T042 | BullMQ payment processor worker | BE |
| T043 | [P] Payment screen (web) + confirmation flow | FE |
| T044 | [P] Autopay setup screen (web) | FE |
| T045 | Payment screens (mobile) | MOB |
| T046 | Integration tests: payment lifecycle + idempotency | BE |
| T047 | E2E web: US4 (Playwright) | FE |

**Milestone**: Cardholder can pay bill; autopay rule schedules and fires correctly.

---

### Phase 4 — Security Controls (Week 10, 2 engineers)

**Goal**: Complete US5 (freeze, restrictions, lost/stolen).

| # | Task | Owner |
|---|---|---|
| T048 | SecurityControl schema + Prisma migration | BE |
| T049 | Security service: freeze/unfreeze (≤ 5 s), restriction toggles, lost/stolen | BE |
| T050 | Re-auth confirmation token endpoint | BE |
| T051 | Security routes + Fastify schemas | BE |
| T052 | Security settings screen (web) | FE |
| T053 | Security settings screen (mobile) | MOB |
| T054 | Integration tests: security controls + auth confirmation | BE |
| T055 | E2E web: US5 (Playwright) | FE |

**Milestone**: Card freeze round-trip ≤ 5 s; lost/stolen report blocks card + orders replacement.

---

### Phase 5 — Notifications (Week 11, 2 engineers)

**Goal**: Complete US6 (transaction alerts, payment reminders, in-app history).

| # | Task | Owner |
|---|---|---|
| T056 | [P] Notification + NotificationPreference schema | BE |
| T057 | Notification service: preference evaluation, multi-channel dispatch | BE |
| T058 | BullMQ notification worker: APNs (expo-server-sdk), FCM, SendGrid | BE |
| T059 | WebSocket notification feed | BE |
| T060 | Payment reminder scheduler (BullMQ cron, 3-day-before trigger) | BE |
| T061 | [P] Notification history screen (web) | FE |
| T062 | [P] Notification preferences screen (web) | FE |
| T063 | Notification screens (mobile) | MOB |
| T064 | Integration tests: notification delivery pipeline | BE |
| T065 | E2E web: US6 — transaction alert, "That wasn't me" dispute flow (Playwright) | FE |

**Milestone**: Transaction alert delivered ≤ 60 s at p95; payment reminder fires 3 days prior.

---

### Phase 6 — Spending Insights (Weeks 12–13, 2 engineers)

**Goal**: Complete US7 (category breakdown, trends, budgets).

| # | Task | Owner |
|---|---|---|
| T066 | SpendingInsightSnapshot + SpendingBudget schema | BE |
| T067 | Nightly BullMQ aggregation worker (category totals by period) | BE |
| T068 | Insights service: summary, trend, budget CRUD | BE |
| T069 | Insights routes + Fastify schemas | BE |
| T070 | Budget alert: 80% threshold check in aggregation worker | BE |
| T071 | [P] Insights overview screen (web) | FE |
| T072 | [P] Category detail + trend screen (web) | FE |
| T073 | Budget management screens (web) | FE |
| T074 | Insights screens (mobile) | MOB |
| T075 | Integration tests: aggregation worker + budget alerts | BE |
| T076 | E2E web: US7 (Playwright) | FE |

**Milestone**: Category breakdown available; budget alerts fire at 80% threshold.

---

### Phase 7 — Production Hardening (Week 14, all engineers)

**Goal**: Performance, observability, security hardening, compliance audit readiness.

| # | Task | Owner |
|---|---|---|
| T077 | OpenTelemetry instrumentation (traces: Fastify, Prisma, BullMQ) | BE |
| T078 | Prometheus metrics endpoint + Grafana dashboard | BE |
| T079 | Playwright Lighthouse performance gate in CI | FE |
| T080 | WCAG 2.1 AA accessibility audit + fixes | FE |
| T081 | Penetration test findings remediation | BE |
| T082 | Reg Z disclosure review on application + payment screens | FE/MOB |
| T083 | Blue-green ECS deploy pipeline | BE |
| T084 | Runbook documentation + on-call rotation setup | ALL |

**Milestone**: All 8 success criteria validated; production-ready for launch.

---

## Effort Estimates

| Phase | Duration | Engineers | Story Points (est.) |
|---|---|---|---|
| 0 — Foundation | 2 weeks | 2 | 40 |
| 1 — Application & Activation | 3 weeks | 3 | 65 |
| 2 — Account Overview | 2 weeks | 3 | 55 |
| 3 — Payments | 2 weeks | 2 | 45 |
| 4 — Security Controls | 1 week | 2 | 30 |
| 5 — Notifications | 1 week | 2 | 35 |
| 6 — Spending Insights | 2 weeks | 2 | 50 |
| 7 — Hardening | 1 week | 3 | 30 |
| **Total** | **14 weeks** | **3 (peak)** | **350** |

*Assumes a team of 2 backend + 1 frontend/mobile engineer. Phases 1–4 can be parallelised
across BE (services + routes) and FE (screens + integration) tracks.*

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Card vault integration delays (Basis Theory onboarding) | Medium | High | Start vault onboarding in Phase 0; use test mode tokens throughout development |
| Payment gateway certification (PCI compliance review) | Medium | High | Use Stripe Issuing or Plaid's sandbox from day 1; plan 4-week certification runway before Phase 3 launch |
| Mobile app store review delay | Low | Medium | Submit test flight / play store review in Phase 2 parallel |
| Regulatory scope creep (additional Reg Z requirements) | Medium | Medium | Engage compliance counsel by end of Phase 1 |
| Redis data loss during ElastiCache failover | Low | Medium | BullMQ jobs use `removeOnComplete: false`; payment jobs replayed from DB reconciliation |
| Team velocity underestimate | Medium | Low | Phases 6 (Insights) and 7 (Hardening) are the lowest-risk candidates for scope reduction in v1 |

---

## Assumptions

- The card issuing and processing platform exposes stable internal APIs for card status,
  transaction feed, and authorisation control. A dedicated integration environment is
  available from week 1.
- Bank account linking (ACH/Plaid) is a dependency of Phase 3 (Payments); Plaid's sandbox
  is available without a production agreement.
- A PCI-certified card vault (Basis Theory or equivalent) can be onboarded within the first
  two weeks of Phase 0.
- The engineering team has AWS access and the ability to provision RDS, ElastiCache, ECS,
  and ALB resources.
- APNs and FCM credentials are available before Phase 5 begins.
- A transactional email provider (SendGrid or Postmark) is available and configured by
  Phase 5.
- Legal/compliance review of Reg Z disclosures and FCRA adverse-action notice templates
  is completed before Phase 1 ends.

---

## Complexity Tracking

> No constitution gate violations — no entries required.
