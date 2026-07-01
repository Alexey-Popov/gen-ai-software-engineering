# ▶️ How to Run the application

Banking Transactions API — Homework 1. Built test-first; see `PLAN-BACKEND-TDD.md`.

## ⚡ Quick start

From `homework-1/`, run the interactive launcher:

```bash
./run.sh
```

It prompts you to choose a backend (Java / Go / FastAPI / .NET) and a frontend
(Angular / Electron / Flutter / none), then starts the backend on :3000, seeds sample data,
launches the frontend, and stops everything on **Ctrl+C** (requires the chosen stack's tools).

The manual steps below are the alternative if you prefer to run each part yourself.

## Prerequisites

- **JDK 17+** (`java -version` should report 17 or higher)
- **Maven 3.9+** — or just open the project in IntelliJ IDEA, which bundles Maven

> The backend lives in `homework-1/backend/`. Run all Maven commands from there.

## Run the tests

```bash
cd homework-1/backend
mvn test
```

> First run downloads dependencies from Maven Central, so it needs internet access.
> In IntelliJ you can also run the test classes directly (right-click → Run).

## Run the application

```bash
cd homework-1/backend
mvn spring-boot:run
```

The API starts on **http://localhost:3000**.

Quick check — create a transaction, then list it:

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

curl http://localhost:3000/transactions
```

---

## Health & API reference

- **Health** (Spring Boot Actuator): http://localhost:3000/actuator/health → `{"status":"UP", ...}`
- **API reference** (Scalar — a modern alternative to Swagger UI): http://localhost:3000/docs
- **OpenAPI spec** (raw JSON): http://localhost:3000/v3/api-docs

> First `mvn` run after this change downloads the new dependencies (Actuator, springdoc-openapi)
> from Maven Central, so it needs internet access.

---

## Frontend (Angular 22 + Microsoft Fluent) — visual verification

A single-page UI for every endpoint lives in [`frontend/`](frontend). Run it alongside the
backend:

```bash
# Terminal 1 — backend (http://localhost:3000)
cd homework-1/backend
mvn spring-boot:run

# Terminal 2 — frontend (http://localhost:4200)
cd homework-1/frontend
npm install
npm start
```

Open http://localhost:4200. The dev server proxies `/api/*` to the backend, so no CORS
setup is needed. See `frontend/README.md` for details.

> The committed repo does not include `frontend/node_modules` (it is git-ignored). If a
> `node_modules` folder is present from another machine, delete it and run `npm install`
> locally so the platform-specific binaries are correct.

---

## Progress (TDD cycles)

- ✅ **Cycle 0 — Walking skeleton:** app boots on port 3000; `GET /transactions` returns
  `[]`. Tests: `contextLoads`, `getTransactions_whenEmpty_returns200AndEmptyArray`.
- ✅ **Cycle 1 — Create & retrieve:** `POST /transactions` (201, server-set
  id/timestamp/status), `GET /transactions`, `GET /transactions/{id}` (200 / 404). Model +
  in-memory repository + service + 404 handler. Tests in `TransactionControllerTest` and
  `TransactionServiceTest`.
- ✅ **Cycle 2 — Validation & structured errors:** Bean Validation on the request (amount
  positive & ≤2 decimals, account format `ACC-XXXXX`, ISO 4217 currency, valid type). 400
  responses use `{error:"Validation failed", details:[{field,message}]}`. Tests in
  `TransactionValidationTest` + `TransactionRequestValidationTest`.
- ✅ **Cycle 3 — Account balance:** `BalanceService` computes balances from completed
  transactions (deposit/withdrawal/transfer rules); `GET /accounts/{id}/balance` returns
  `{accountId, balance}`. Tests in `BalanceServiceTest` + `AccountControllerTest`.
- ✅ **Cycle 4 — History / filtering:** `GET /transactions` supports `accountId` (from OR
  to), `type`, and an inclusive `from`/`to` date range, combinable as AND. Tests in
  `TransactionFilterTest`.
- ✅ **Cycle 5 — Account summary:** `GET /accounts/{id}/summary` returns `totalDeposits`,
  `totalWithdrawals`, `transactionCount`, `mostRecentTransactionDate`. Tests in
  `SummaryServiceTest` + `AccountControllerTest`.
- ✅ **Cycle 6 — Simple interest:** `GET /accounts/{id}/interest?rate=&days=` returns the
  inputs and `interest = balance * rate * days / 365` (2dp, HALF_UP); 400 on missing/invalid
  params. Tests in `InterestServiceTest` + `AccountControllerTest`.
- ✅ **Cycle 7 — CSV export:** `GET /transactions/export?format=csv` returns `text/csv` with
  a header row, one line per transaction, and `Content-Disposition: attachment` (RFC 4180
  quoting). Tests in `TransactionExportTest`.
- ✅ **Cycle 8 — Rate limiting:** per-IP fixed-window limiter (100 req/min by default);
  exceeding it returns 429 with a JSON body. Configurable via `ratelimit.*`; disabled in
  default tests, exercised with a low limit in `RateLimitTest`.
- ✅ **Cycle 9 — Hardening & integration:** end-to-end test (`BankingIntegrationTest`)
  verifies create → balance → summary → filters stay consistent. All 50 tests green.

All nine TDD cycles are complete.
