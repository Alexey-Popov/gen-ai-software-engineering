# CardFlow — Developer Quick-Start Guide

**Spec version**: 1.0.0
**Date**: 2026-06-03
**Estimated setup time**: 20 minutes

---

## Prerequisites

| Tool | Version | How to install |
|---|---|---|
| Node.js | 22 LTS | `nvm install 22` or https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm@9` |
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |
| Expo CLI | 0.18.x | `pnpm add -g expo-cli` |
| iOS Simulator | Xcode 16 | Mac App Store (macOS only) |
| Android Emulator | Android Studio 2024 | https://developer.android.com/studio |

Verify your setup:

```bash
node --version   # v22.x.x
pnpm --version   # 9.x.x
docker --version # 4.x.x
```

---

## 1. Clone and Install

```bash
git clone <repo-url> card-flow
cd card-flow
pnpm install        # installs all workspaces: backend, frontend, mobile, shared
```

---

## 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **MinIO** (S3-compatible, for adverse-action PDFs) on `localhost:9000`

Verify:

```bash
docker compose ps   # all three services should show "healthy"
```

---

## 3. Configure Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Minimum required values in `backend/.env`:

| Variable | Example value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://cardflow:cardflow@localhost:5432/cardflow` | Local Docker DB |
| `REDIS_URL` | `redis://localhost:6379` | Local Docker Redis |
| `JWT_PRIVATE_KEY` | *(auto-generated; see below)* | RS256 private key |
| `JWT_PUBLIC_KEY` | *(auto-generated; see below)* | RS256 public key |
| `VAULT_API_KEY` | `dev-mock-key` | Basis Theory dev key or mock |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO local endpoint |
| `S3_BUCKET` | `cardflow-docs` | |
| `PUSH_ENABLED` | `false` | Disable real push in local dev |

Generate a local RS256 key pair:

```bash
cd backend
pnpm keygen     # writes keys to .env automatically
```

---

## 4. Database Setup

```bash
pnpm --filter backend db:migrate   # applies all Prisma migrations
pnpm --filter backend db:seed      # loads test users, cards, transactions
```

**Seeded test accounts**:

| Email | Password | State |
|---|---|---|
| `alice@cardflow.test` | `TestPass123!` | Active — 2 cards, 3 months of transactions |
| `bob@cardflow.test` | `TestPass123!` | New — 1 card, pending activation |
| `carol@cardflow.test` | `TestPass123!` | Applicant — no cards, no account yet |

---

## 5. Start the Services

**Backend API server** (http://localhost:4000):

```bash
pnpm --filter backend dev
```

Health check:

```bash
curl http://localhost:4000/health
# { "status": "ok", "version": "1.0.0" }
```

**Web frontend** (http://localhost:5173):

```bash
pnpm --filter frontend dev
```

**Mobile app** (Expo Metro):

```bash
pnpm --filter mobile start
# Press 'i' for iOS Simulator, 'a' for Android Emulator, scan QR for device
```

---

## 6. Verify Each User Story

### US1 — Apply for a Card & Track Status

1. Open http://localhost:5173 — you are not logged in.
2. Click **Apply for a Card** → complete the form (use `carol@cardflow.test` email) → Submit.
3. Verify: reference number `CF-YYYYMMDD-NNNNN` shown; status "Application Submitted".
4. Simulate underwriting approval:
   ```bash
   pnpm --filter backend seed:approve --email carol@cardflow.test
   ```
5. Refresh the status page — status shows "Approved"; new card appears in "Pending Activation".

To simulate a decline instead:
```bash
pnpm --filter backend seed:decline --email carol@cardflow.test
```
Verify: decline reason shown; adverse-action notice download link present.

---

### US2 — Activate a Card

1. Log in as `bob@cardflow.test`.
2. Dashboard shows one card with an **Activate Card** banner.
3. Tap/click **Activate Card** → enter last four digits: `0042` (seeded) → PIN: `1234`.
4. Verify: card status changes to Active; success screen shown.

Test failure path: enter wrong last four (`0000`) — verify error with attempts remaining.

---

### US3 — View Transactions & Balance

1. Log in as `alice@cardflow.test`.
2. Navigate to the card ending `4321` dashboard.
3. Verify: balance, available credit, credit limit, statement date, minimum payment all visible.
4. Verify: transaction list loads in reverse chronological order with merchant and category.
5. Apply a filter: **Category = Dining** — verify only dining transactions shown.
6. Simulate a real-time transaction:
   ```bash
   pnpm --filter backend seed:transaction --last-four 4321 --amount 28.50 --merchant "Peet's Coffee"
   ```
7. Verify: transaction appears in the list within 60 seconds without page refresh (WebSocket).

---

### US4 — Make a Payment

1. Log in as `alice@cardflow.test` → card `4321`.
2. Click **Pay Now** → choose **Custom Amount** → enter `200.00` → select "Chase Checking ••3421".
3. Verify: confirmation screen shows amount, bank account, and estimated posting date.
4. Confirm payment → verify: success notification; payment appears in payment history as Scheduled.
5. Test autopay: Settings → Autopay → set to **Statement Balance** on day 10 → save.
6. Verify: autopay rule shown with next scheduled date.

---

### US5 — Security Controls

1. Log in as `alice@cardflow.test` → card `4321` → **Security**.
2. Toggle **Freeze Card** → authenticate with PIN `1234`.
3. Verify: card shows as **Frozen** within 5 seconds.
4. Simulate an authorisation attempt on the frozen card:
   ```bash
   pnpm --filter backend seed:auth --last-four 4321
   ```
   Expected output: `DECLINED — card frozen`.
5. Unfreeze → re-run the same command → expected: `APPROVED`.
6. Test **Block International**: toggle on → simulate international auth:
   ```bash
   pnpm --filter backend seed:auth --last-four 4321 --international
   ```
   Expected: `DECLINED — international transactions blocked`.

---

### US6 — Notifications & Alerts

1. Log in as `alice@cardflow.test` → **Notification Settings**.
2. Set transaction alert threshold to **$0.00** (every transaction).
3. Simulate a transaction:
   ```bash
   pnpm --filter backend seed:transaction --last-four 4321 --amount 14.00 --merchant "Starbucks"
   ```
4. Verify: in-app notification appears in the notification bell within 60 seconds.
5. Click **That wasn't me** on the notification → verify: transaction marked Disputed; card
   frozen automatically; dispute case reference shown.

---

### US7 — Spending Insights

1. Log in as `alice@cardflow.test` (pre-seeded with 3 months of transactions).
2. Navigate to **Insights** → verify: category breakdown for current month with amounts and
   percentages.
3. Click **Dining** → verify: merchant list and prior-month comparison.
4. Create a budget: **Dining → $400/month → 80% alert** → Save.
5. Verify: Dining budget card shows current utilisation (≥ 80% if seed data is sufficient
   to trigger the alert threshold).

Manually trigger the nightly aggregation job to refresh snapshots:

```bash
pnpm --filter backend seed:aggregate
```

---

## 7. Run the Full Test Suite

```bash
# Unit tests (all workspaces)
pnpm test:unit

# Integration tests (requires Docker infrastructure running)
pnpm test:integration

# Contract tests (Pact — runs provider verification)
pnpm test:contract

# E2E web (Playwright — requires backend + frontend running)
pnpm test:e2e:web

# E2E mobile (Detox — requires Android emulator or iOS simulator)
pnpm test:e2e:mobile

# Coverage report (must show ≥ 80% to pass)
pnpm test:coverage
```

---

## 8. Common Issues

| Symptom | Fix |
|---|---|
| `ECONNREFUSED localhost:5432` | Run `docker compose up -d`; wait for health check |
| `JWT_PRIVATE_KEY missing` | Run `pnpm --filter backend keygen` |
| Expo QR code won't scan | Ensure phone and laptop are on the same Wi-Fi network |
| Playwright tests fail with `ERR_CONNECTION_REFUSED` | Ensure both `backend dev` and `frontend dev` are running |
| `prisma migrate` fails | Run `pnpm --filter backend db:reset` then re-migrate |
| BullMQ jobs not processing | Verify Redis is running: `docker compose ps redis` |

---

## 9. Pre-Launch Validation Checklist

Before declaring a phase complete, verify:

- [ ] All user stories for the phase can be exercised end-to-end using the steps above.
- [ ] `pnpm test:coverage` reports ≥ 80% for all modules in the phase.
- [ ] `pnpm test:contract` passes — no provider mismatches.
- [ ] Card freeze round-trip is ≤ 5 s (check browser Network tab for the PATCH response time).
- [ ] Account overview loads in ≤ 2 s on a 4G throttle preset in Chrome DevTools.
- [ ] No `console.error` output in the browser or Expo Metro logs during happy-path flows.
- [ ] Adverse-action notice PDF is generated and the signed URL is returned for a declined
  application (US1).
- [ ] WebSocket delivers balance and transaction updates without a page refresh (US3).
