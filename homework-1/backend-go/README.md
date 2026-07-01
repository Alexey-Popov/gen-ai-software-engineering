# 🐹 Banking API — Go + Chi (alternative backend)

A second implementation of the Banking Transactions API, in **Go** with the **Chi** router,
built **test-first** with the same 9‑cycle plan as the Java version (see
[`../PLAN-BACKEND-TDD.md`](../PLAN-BACKEND-TDD.md)). It exposes the same HTTP contract on
**port 3000**, so the existing **Angular frontend works against it unchanged**.

> The Java/Spring Boot version lives in [`../backend/`](../backend). This folder is independent.

## Prerequisites

- **Go 1.22+** (`go version`) — e.g. `brew install go`

## Run

From `homework-1/` you can use the interactive launcher (`./run.sh` → choose Go), or run it
directly:

```bash
cd homework-1/backend-go
go mod tidy         # first time: downloads chi + decimal, writes go.sum
go run ./cmd/server # API on http://localhost:3000
```

## Test (TDD)

```bash
go test ./...       # run after every cycle
go test ./... -v    # verbose
```

## Health & API reference

- **Health:** http://localhost:3000/actuator/health → `{"status":"UP"}`
- **API reference (Scalar):** http://localhost:3000/docs
- **OpenAPI spec:** http://localhost:3000/openapi.json

## Design notes

- **Router:** `github.com/go-chi/chi/v5` over the standard `net/http`; middleware for recovery,
  CORS, and rate limiting.
- **Storage:** in-memory `map` guarded by `sync.RWMutex` (no database).
- **Money:** `github.com/shopspring/decimal` (Go has no built-in `BigDecimal`) — never `float`.
- **Validation:** hand-written in `internal/validation` (accounts, amount, ISO 4217 currency,
  type), mapped to a structured `400 {error, details[]}` body — no external validation library.
- **Tests:** standard `testing` + `net/http/httptest` (table-driven), added cycle by cycle.

## Progress (TDD cycles)

- ✅ **Cycle 0 — Walking skeleton:** `GET /transactions` → `[]` on port 3000.
- ✅ **Cycle 1 — Create & retrieve:** `Transaction` model (decimal money), in-memory store
  (`sync.RWMutex`), service, `POST /transactions` (201), `GET /transactions`,
  `GET /transactions/{id}` (200/404). Tests in `internal/httpapi` + `internal/service`.
- ✅ **Cycle 2 — Validation & structured errors:** `internal/validation` checks accounts
  (`ACC-XXXXX`), amount (positive, ≤2 decimals), ISO 4217 currency (built-in set), and
  type; invalid requests return `400 {error:"Validation failed", details:[{field,message}]}`.
- ✅ **Cycle 3 — Account balance:** `AccountService.BalanceOf` (completed transactions only);
  `GET /accounts/{accountId}/balance` returns `{accountId, balance}`.
- ✅ **Cycle 4 — History / filtering:** `GET /transactions` supports `accountId` (from OR to),
  `type`, and an inclusive `from`/`to` date range, combinable (AND).
- ✅ **Cycle 5 — Account summary:** `AccountService.SummaryOf` + `GET /accounts/{id}/summary`
  → `{totalDeposits, totalWithdrawals, transactionCount, mostRecentTransactionDate}` (null date when empty).
- ✅ **Cycle 6 — Simple interest:** `AccountService.Interest` (`balance*rate*days/365`, 2dp);
  `GET /accounts/{id}/interest?rate=&days=` returns inputs + result; `400` on missing/invalid params.
- ✅ **Cycle 7 — CSV export:** `GET /transactions/export?format=csv` → `text/csv` with a header
  row, one line per transaction, and `Content-Disposition: attachment`; 400 on unsupported format.
- ✅ **Cycle 8 — Rate limiting:** per-IP fixed-window middleware (100 req/min by default);
  exceeding it returns `429` with a JSON body. Limit is configurable (`newAPI(limit, window)`).
- ✅ **Cycle 9 — Integration:** end-to-end test (`integration_test.go`) verifies
  create → balance → summary → filters stay consistent. **All nine cycles complete.**
- ✅ **Ops — health & API reference:** `GET /actuator/health` → `{"status":"UP"}`; OpenAPI spec
  at `/openapi.json` rendered by **Scalar** (modern Swagger-UI alternative) at `/docs`.
