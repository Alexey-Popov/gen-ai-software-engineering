# 🏦 Homework 1 — Implementation Plan

Step-by-step plan for building the Banking Transactions REST API.
Each stage is implemented and verified independently before moving on to the next.

**Stack:** Node.js 18+ · Express 4 (ESM) · in-memory storage
**Runs locally without Docker** — only Node.js is required.

---

## 🔧 Stage 0 — Project Initialization

- `package.json` (ESM, scripts: `start`, `dev`)
- Install dependencies: `express`, `uuid`, `express-rate-limit`
- `src/index.js` + `src/app.js` with an Express skeleton and a `GET /` health-check
- Run locally and confirm the server starts on `localhost:3000`

**Outcome:** a working "hello world" server.

### Status
- [x] Completed
- Notes: Node v22.12.0 verified. Server boots on `localhost:3000`; `GET /` returns `{ name, status: "ok", version }`. Dependencies installed (express 4.21.2, express-rate-limit 7.5.0, uuid 11.0.5).

---

## ⭐ Stage 1 — Task 1: Core API (no validation yet)

- `src/store/transactionStore.js` — in-memory `Map` with `create`, `getAll`, `getById`, `getBalance`
- `src/routes/transactions.js` — `POST /transactions`, `GET /transactions`, `GET /transactions/:id`
- `src/routes/accounts.js` — `GET /accounts/:accountId/balance`
- Minimal error handler (404, 500)
- Server-generated fields: `id` (uuid), `timestamp` (ISO 8601), `status: "completed"`

**Outcome:** all four core endpoints are reachable; a transaction can be created and read back via curl.

### Status
- [x] Completed
- Notes: Verified end-to-end via the REST Client `.http` file — POST transfer/deposit/withdrawal return 201 with auto-generated `id`, `timestamp`, `status: "completed"`. GET list, GET by id, and 404 path all behave correctly. Balance math validated (ACC-12345 = 349.50, ACC-67890 = 100.50).

---

## ✅ Stage 2 — Task 2: Validation

- `src/utils/currencies.js` — ISO 4217 whitelist
- `src/utils/errors.js` — `ValidationError` class + `details[]` shape
- `src/validators/transactionValidator.js` — checks for `amount`, `fromAccount` / `toAccount`, `currency`, `type`
- `src/middleware/errorHandler.js` — returns 400 with **all** errors collected in `details[]` (no fail-fast)
- Wire the validator into `POST /transactions`

**Outcome:** invalid requests return 400 with every validation error reported in a single response.

### Status
- [x] Completed
- Notes: Verified via REST Client. Empty body, multi-error payload, too-many-decimals, invalid type, same-account transfer, deposit without `toAccount` all return 400 with `details[]`. Valid request with lowercase `eur` returns 201 with `currency` normalized to `EUR`.

---

## 📜 Stage 3 — Task 3: Filtering

Extend `GET /transactions` with query params:

- `?accountId=ACC-12345` (matches `fromAccount` OR `toAccount`)
- `?type=transfer`
- `?from=2024-01-01&to=2024-01-31` (filters by `timestamp`)
- Filters combine with AND
- Validate query params (invalid date format → 400)

**Outcome:** filtering works individually and in any combination.

### Status
- [x] Completed
- Notes: Verified — single filters (`accountId`, `type`, `from`/`to`) and combined filters all narrow results correctly. Invalid `accountId`, invalid date format, and `to` < `from` all return 400 with `details[]`. Date-only inputs are normalized: `from` → 00:00:00 UTC, `to` → 23:59:59.999 UTC.

---

## 📈 Stage 4 — Task 4 / Option A: Account Summary

- `GET /accounts/:accountId/summary` → `totalDeposits`, `totalWithdrawals`, `transactionCount`, `lastTransactionDate`
- Logic in `transactionStore` + route in `accounts.js`

**Outcome:** summary endpoint returns aggregated stats per account.

### Status
- [x] Completed
- Notes: Verified — `totalDeposits` (money in), `totalWithdrawals` (money out), `transactionCount`, `lastTransactionDate` all correct for accounts with mixed deposit/withdrawal/transfer activity. Unknown account returns zeros + `lastTransactionDate: null`.

---

## 💰 Stage 5 — Task 4 / Option B: Simple Interest

- `GET /accounts/:accountId/interest?rate=0.05&days=30`
- Formula: `balance × rate × days / 365`
- Validation: `rate > 0`, `days > 0` → 400 on invalid input

**Outcome:** interest endpoint returns the calculated value with input validation.

### Status
- [x] Completed
- Notes: Verified — `balance=10000, rate=0.05, days=365 → interest=500`; `days=30 → 41.10`. Zero-balance account returns `interest=0`. Missing rate, negative rate, non-integer days, and "both invalid" cases all return 400 with `details[]`. Response includes `balance`, `rate`, `days`, `interest`, and the formula string.

---

## 📤 Stage 6 — Task 4 / Option C: CSV Export

- `GET /transactions/export?format=csv` (default `csv`, also supports `format=json`)
- `src/utils/csv.js` — hand-written serializer (no extra dependency)
- Supports the same filters as `GET /transactions`
- Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=transactions.csv`

**Outcome:** export endpoint returns CSV (or JSON) with optional filtering.

### Status
- [ ] Completed
- Notes:

---

## 🚦 Stage 7 — Task 4 / Option D: Rate Limiting

- `src/middleware/rateLimiter.js` using `express-rate-limit`
- 100 requests per minute per IP
- JSON response on 429: `{ error: "Too many requests" }`
- Registered globally in `app.js`

**Outcome:** the API rejects clients exceeding the limit with HTTP 429.

### Status
- [ ] Completed
- Notes:

---

## 📦 Stage 8 — Demo Files

- `demo/sample-data.json` — 5–7 ready-to-use transactions
- `demo/sample-requests.http` — curl / REST Client examples covering **every** endpoint and filter
- `demo/run.sh` — `npm install && npm start`
- (optional) seed script that POSTs `sample-data.json` into the running server

**Outcome:** anyone can clone the repo and exercise the API in minutes.

### Status
- [ ] Completed
- Notes:

---

## 📚 Stage 9 — Documentation

- `README.md` — overview, feature list, architecture decisions, AI tools used, sample prompts, screenshot references
- `HOWTORUN.md` — prerequisites (Node.js 18+), run steps, sample test commands, troubleshooting
- Markdown checklist of screenshots to capture into `docs/screenshots/`

**Outcome:** documentation is complete and review-ready.

### Status
- [ ] Completed
- Notes:

---

## ✅ Stage 10 — Final Verification

- Start the server and exercise every endpoint via curl
- Check edge cases: unknown id, invalid currency, rate-limit trigger
- Confirm `.gitignore` is correct and no `node_modules/` is committed

**Outcome:** project is ready to be opened as a Pull Request.

### Status
- [ ] Completed
- Notes:
