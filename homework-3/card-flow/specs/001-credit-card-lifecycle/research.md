# Research: CardFlow Phase 0 — Technology Decisions

**Feature**: CardFlow — Credit Card Lifecycle Management
**Date**: 2026-06-03
**Status**: Complete

---

## 1. Backend Framework Selection

**Decision**: **Fastify 5** (not Express, not Hapi, not NestJS)

**Rationale**:
- Fastify benchmarks at ~2× Express throughput under equivalent load (verified via
  independent benchmarks at fastify.dev/benchmarks). For a financial app serving
  real-time balance events to tens of thousands of connected users, this headroom
  reduces horizontal scaling cost.
- JSON Schema validation is built-in and runs at the HTTP boundary before business logic
  is reached. This eliminates a category of malformed-input bugs and removes boilerplate
  defensive coding in services.
- TypeScript generics for route definitions, request/reply types, and plugin decorators
  are first-class. There is no `@types/fastify` shim needed — the main package is
  TypeScript-native.
- Plugin ecosystem: `@fastify/websocket`, `@fastify/rate-limit`, `@fastify/cors`,
  `@fastify/helmet`, `@fastify/swagger` are all maintained by the core team.

**Alternatives considered**:
- **Express 5**: Ubiquitous but no built-in schema validation; slower; TypeScript support
  requires separate `@types` package. Rejected on performance and ergonomics.
- **NestJS**: Good structure, popular in enterprise. However, it adds a substantial layer
  of decoration-based abstraction over Fastify that obscures behaviour and increases bundle
  size. The team controls its own architecture; NestJS opinionation is not needed here.
- **Hapi.js**: Solid security model but smaller community; last major release 2023;
  ecosystem is stagnant relative to Fastify.

---

## 2. ORM Selection

**Decision**: **Prisma 6**

**Rationale**:
- Single schema file (`schema.prisma`) generates TypeScript types, the Prisma Client, and
  SQL migrations. The entity types used in the application match the DB schema exactly,
  eliminating a class of runtime mismatch errors.
- `prisma migrate deploy` is idempotent and auditable; migrations are committed to version
  control and reviewed as part of PRs — satisfying the constitution's Code Quality gate.
- Prisma's query builder uses parameterised SQL exclusively. Raw SQL is possible via
  `$queryRaw` but requires template literal tagging that prevents string concatenation
  — eliminating SQL injection at the ORM boundary.
- `prisma generate` runs in CI and will fail the build if the schema is out of sync.

**Alternatives considered**:
- **Drizzle ORM**: Excellent TypeScript types; SQL-first philosophy. Rejected because the
  migration workflow is less mature and the ecosystem is younger; Prisma's proven track
  record in production financial systems is preferred.
- **TypeORM**: Active-record pattern entangles domain logic with persistence. Weaker
  TypeScript generics than Prisma. Migration tooling less reliable for complex schemas.
- **Raw SQL (postgres.js)**: Maximum control, but no code-generated types and manual
  migration management — too high maintenance cost for a 3-person team.

---

## 3. Job Queue Selection

**Decision**: **BullMQ 5** (Redis-backed)

**Rationale**:
- Jobs survive process restart and server crashes (durability via Redis persistence).
- Retry with exponential back-off and dead-letter queues are built-in — critical for
  payment processing where partial failures must not result in double charges.
- Rate-limited queues prevent overwhelming downstream services (payment gateway, APNs).
- `@bull-board/fastify` provides a UI for monitoring queue health — useful for ops.
- BullMQ is the actively maintained successor to Bull v4; Bull is in maintenance mode.

**Alternatives considered**:
- **Bull v4**: Deprecated in favour of BullMQ. Rejected — no new features; security
  patches only.
- **AWS SQS + Lambda**: Good for serverless-first architectures but adds operational
  complexity for a team already using ECS. BullMQ on Redis is simpler to run locally
  and mirrors prod.
- **pg-boss** (PostgreSQL-backed): Eliminates Redis dependency for queues. Attractive but
  Redis is already present for caching; consolidating on Redis reduces infrastructure.

---

## 4. Frontend State Management

**Decision**: **TanStack Query v5** for server state + **Zustand** for client state

**Rationale**:
- TanStack Query handles the full server-state lifecycle: fetching, caching, background
  refetch, stale-while-revalidate, and optimistic updates. This replaces a significant
  amount of custom boilerplate and ensures account data stays fresh without manual polling.
- Zustand is a minimal, hook-based store for the small amount of true client state
  (authenticated user session, currently selected card). Its API is simpler than Redux
  Toolkit for this use case.

**Alternatives considered**:
- **Redux Toolkit**: Full-featured but heavyweight for the volume of client state in
  CardFlow. TanStack Query handles 90% of what RTK Query would provide.
- **Jotai / Recoil**: Atomic state libraries — more granular than needed; Zustand's
  simplicity is preferred.
- **Context API only**: Does not handle async data fetching, caching, or background
  refresh natively. Requires significant custom code.

---

## 5. WebSocket Strategy

**Decision**: **@fastify/websocket** for the backend; native `WebSocket` API on the client

**Rationale**:
- `@fastify/websocket` wraps `ws` (the de-facto Node.js WebSocket library) with Fastify's
  request lifecycle and plugin system. Route-level authentication and validation hooks
  apply to WebSocket upgrade requests, maintaining a consistent security model.
- A Redis pub/sub channel (`SUBSCRIBE card:${cardId}:events`) decouples transaction
  ingestion workers from the WebSocket layer. Multiple API server instances can publish
  events; any connected instance delivers them to the right client.
- The native `WebSocket` API (supported in all modern browsers and React Native via
  `react-native-websocket`) avoids adding Socket.io's client-side bundle (~45 KB gzipped).

**Alternatives considered**:
- **Socket.io**: Provides auto-reconnection, namespacing, and long-polling fallback.
  Rejected because: the client bundle is large; long-polling fallback adds server
  complexity; the reconnection logic in the native `WebSocket` API is simple to implement
  and well-understood.
- **Server-Sent Events (SSE)**: Simpler for one-way push. Rejected because CardFlow needs
  bidirectional messaging (fraud acknowledgement, real-time confirmation messages).

---

## 6. Auth Implementation

**Decision**: **Custom JWT with `jose`** library (RS256, 2048-bit RSA)

**Rationale**:
- `jose` is the IANA-registered JavaScript JOSE implementation; uses WebCrypto API;
  passes the JOSE security test suite. No memory of prior vulnerabilities in the library.
- RS256 (asymmetric) allows the public key to be shared at a JWKS endpoint for future
  third-party verification without exposing the signing key.
- Refresh token rotation (issue new on every `/auth/refresh`, invalidate old immediately)
  is implemented explicitly — critical for a financial application.
- HttpOnly + SameSite=Strict cookie for web; Expo SecureStore for mobile. Neither
  JavaScript nor React Native's AsyncStorage ever holds the refresh token.

**Alternatives considered**:
- **Passport.js**: Strategy-based, flexible. But adds abstraction over a flow that should
  be explicit and auditable in a financial context. `jose` + hand-rolled middleware is
  ~150 lines and completely transparent.
- **Auth0 / Clerk**: Managed auth. Attractive for speed but: PCI-DSS requires knowing
  exactly where credentials are stored; outsourcing auth to a third party requires their
  own PCI attestation to be included in ours. Rejected for this phase.
- **HMAC HS256**: Symmetric signing means the verification key is also the signing key.
  Any service that can verify tokens can also forge them. RS256 eliminates this concern.

---

## 7. PCI-DSS Compliance & PAN Handling

**Decision**: **Basis Theory** vault for PAN tokenisation; CardFlow stores tokens + last-four only

**Rationale**:
- Storing raw PANs in CardFlow's PostgreSQL database would require CardFlow to be assessed
  as a PCI-DSS Level 1 Service Provider (~300 controls, annual on-site QSA audit).
- Delegating PAN storage to Basis Theory (a PCI-DSS Level 1 certified vault) reduces
  CardFlow's in-scope environment to the token exchange endpoints. CardFlow's PCI scope
  reduces to SAQ A-EP or SAQ D (depending on tokenisation method), cutting audit scope
  by ~75%.
- Basis Theory provides: REST API for tokenise/detokenise, React Elements for PCI-safe
  card form inputs (no PAN touches CardFlow's JS), and audit logs.

**Alternatives considered**:
- **AES-256 encryption at rest**: CardFlow stores encrypted PANs. Still in full PCI-DSS
  scope; key management is complex; rejected.
- **Stripe Issuing**: Full card-issuing platform but opinionated; limited flexibility for
  custom card products. Basis Theory is vault-only and framework-agnostic.
- **Tokenisation within PostgreSQL**: `pgcrypto` extension. Still in PCI scope; encryption
  key lives in the same infrastructure. Rejected.

---

## 8. Mobile: Expo vs Bare React Native

**Decision**: **Expo SDK 52** (managed workflow)

**Rationale**:
- Expo Go eliminates iOS/Android toolchain setup during development — significant
  productivity gain for a team where the mobile engineer is shared with web.
- EAS Build (Expo Application Services) provides cloud-based native builds without
  requiring macOS for Android builds or a CI macOS runner for iOS.
- Expo SDK 52 includes `expo-secure-store` (Keychain/Keystore), `expo-notifications`
  (APNs/FCM), `expo-local-authentication` (biometric), and `expo-camera` — all needed
  for CardFlow with no ejecting required.
- OTA (over-the-air) JS updates via EAS Update enable pushing security patches to
  users without an app store review cycle.

**Alternatives considered**:
- **Bare React Native**: Maximum flexibility. Rejected because the required native modules
  (`expo-secure-store`, notifications, biometrics) are all available in managed Expo;
  bare RN would add native build complexity without adding capability.
- **Flutter**: Dart ecosystem; no code reuse with TypeScript web frontend. Rejected.
- **Capacitor (Ionic)**: Wraps a web view. Performance not suitable for a financial app
  that needs smooth animations and biometric prompts.

---

## 9. Testing: Real DB vs Mocks

**Decision**: **Real PostgreSQL via testcontainers-node** for all integration tests; no DB mocks

**Rationale**: The project constitution (Principle III) explicitly prohibits mock databases
for integration tests following a prior incident where mock tests passed but a production
migration failed. `testcontainers-node` spins up a fresh ephemeral PostgreSQL container per
test suite, applies Prisma migrations, and tears it down after the suite. This guarantees
tests exercise the actual query engine and migration state.

**Cost**: ~5–10 s additional startup per integration suite. Acceptable given the reliability
benefit.

**Alternatives considered**:
- **jest-mock-extended + prisma-mock**: Rejected per constitution mandate.
- **SQLite in-memory**: Fails to replicate PostgreSQL-specific behaviour (RLS, JSONB,
  `gen_random_uuid()`, `pg_notify`). Rejected.

---

## 10. Deployment: AWS ECS Fargate vs Kubernetes

**Decision**: **AWS ECS Fargate** (serverless containers)

**Rationale**:
- ECS Fargate eliminates EC2 instance management (patching, scaling, capacity planning).
  For a 3-person team, this is a significant operational burden reduction.
- RDS PostgreSQL, ElastiCache Redis, and ALB integrate natively with ECS via AWS-managed
  connectors, reducing custom networking configuration.
- Auto-scaling based on ALB request count is simpler to configure in ECS than Kubernetes
  HPA + ingress controllers.
- Cost: Fargate is ~20% more expensive per CPU/GB than equivalent EC2, but the ops
  savings far outweigh the cost at CardFlow's scale (< 1 M users).

**Alternatives considered**:
- **Kubernetes (EKS)**: Superior for very large teams and multi-cluster deployments.
  Overkill for a 3-person team at launch. Can be migrated to later.
- **AWS Lambda**: Serverless functions. WebSocket connections require AWS API Gateway
  WebSocket API (complex, stateful connection management). BullMQ workers need persistent
  process — Lambda's execution model is a poor fit. Rejected.
- **Render / Railway / Fly.io**: Simpler PaaS options. Rejected because PCI-DSS Level 1
  compliance requires known, auditable infrastructure; AWS has a PCI-DSS Level 1 Service
  Provider attestation.

---

## Resolution Summary

| Decision | Choice | Key Reason |
|---|---|---|
| HTTP framework | Fastify 5 | 2× throughput vs Express; schema-first validation |
| ORM | Prisma 6 | Code-gen types; safe migrations; parameterised queries |
| Job queue | BullMQ 5 | Durable; retry/DLQ; Redis-native |
| Frontend state | TanStack Query + Zustand | Server/client state separation |
| WebSocket | @fastify/websocket + Redis pub/sub | No Socket.io bundle; multi-instance fan-out |
| Auth | Custom JWT (jose, RS256) | Explicit, auditable; refresh token rotation |
| PAN handling | Basis Theory vault | PCI-DSS scope reduction |
| Mobile platform | Expo SDK 52 | OTA updates; managed native modules |
| Integration tests | testcontainers + real DB | Constitution mandate; no migration blind spots |
| Cloud deployment | AWS ECS Fargate | PCI-compliant; ops simplicity for small team |
