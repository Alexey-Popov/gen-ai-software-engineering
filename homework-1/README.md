# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Andrii Shukailo
> **Date Submitted**: 2026-07-01
> **AI Tools Used**: Claude Code (Opus 4.8)

---

## 📋 Project Overview

A minimal REST API for banking transactions, built with **Node.js + Express** and
**in-memory storage** (no database). It implements all required endpoints plus
**all four** optional Task 4 features (summary, simple interest, CSV export, rate
limiting).

The codebase is organized in clean layers — `route → validator → service → store`
— so the HTTP layer only deals with status codes while business rules live in
testable, framework-free modules.

### ✅ Features implemented

| Area | Endpoint(s) |
|------|-------------|
| Create / read | `POST /transactions`, `GET /transactions`, `GET /transactions/:id` |
| Balance | `GET /accounts/:accountId/balance` |
| Filtering | `GET /transactions?accountId=&type=&from=&to=` (combinable) |
| Validation | amount, account format, currency, type, per-type account rules |
| Task 4-A Summary | `GET /accounts/:accountId/summary` |
| Task 4-B Interest | `GET /accounts/:accountId/interest?rate=&days=` |
| Task 4-C CSV export | `GET /transactions/export?format=csv` |
| Task 4-D Rate limiting | 100 req/min/IP → `429` |

---

## 🧭 Architecture decisions (resolving gaps in the spec)

The original `TASKS.md` left several rules ambiguous or self-contradictory.
Before coding, those were analysed and a **binding contract** was fixed
(see also `CLAUDE.md`):

1. **Accounts per type** — `deposit` carries only `toAccount`; `withdrawal` only
   `fromAccount`; `transfer` both, and they must differ. (The original model
   forced both fields on every type, which is meaningless for deposit/withdrawal.)
2. **Status lifecycle** — new transactions default to `completed` (synchronous
   in-memory settlement). `status` may be supplied; only `completed` affects
   money math. `pending`/`failed` are stored but ignored for balances.
3. **Balance** — `Σ credits (toAccount) − Σ debits (fromAccount)`, completed only.
4. **`?accountId=` filter** — matches `fromAccount` **OR** `toAccount`.
5. **Summary uses credits/debits, not type names** — so the identity
   `balance == totalDeposits − totalWithdrawals` always holds (the spec's
   summary definition otherwise contradicted the balance, since transfers are
   neither "deposit" nor "withdrawal").
6. **Account format** — `^ACC-[A-Za-z0-9]{5}$` (exactly 5 alphanumerics).
7. **Date filters** — `from`/`to` accept `YYYY-MM-DD` or ISO 8601; both bounds
   inclusive; a date-only `to` covers through end of day.
8. **Currency** — validated against a curated ISO 4217 allowlist
   (`src/config/currencies.js`), documented as an extensible subset.
9. **Interest** — simple interest `balance × rate × (days / 365)`, annual rate.
10. **Single currency assumption** — `TASKS.md` defines `currency` only as a
    per-transaction field with ISO 4217 validation; it says nothing about
    multi-currency balances or per-account currency. For the scope of this
    homework we therefore assume **one currency context**: balances, summaries,
    and interest sum amounts as plain numbers and do **not** perform any FX
    conversion. Posting transactions in different currencies to the same account
    is out of scope (no conversion is applied).

### 📁 Source layout

```
src/
├── index.js                 # bootstrap → listen(PORT||3000)
├── app.js                   # express app factory (testable, no port binding)
├── config/currencies.js     # ISO 4217 allowlist
├── store/transactionStore.js# in-memory array + CRUD
├── models/transaction.js    # id/timestamp/status, type & status enums
├── validators/transactionValidator.js  # the full domain contract
├── services/
│   ├── transactionService.js# create / getById / list + filters
│   └── accountService.js    # balance / summary / interest
├── routes/{transactions,accounts}.js
├── middleware/{errorHandler,rateLimiter}.js
└── utils/csv.js
```

---

## 🤖 How AI was used

- **Requirements analysis** — Claude Code analysed `TASKS.md` and surfaced the
  logical contradictions above (account model vs. types, undefined balance,
  summary-vs-balance mismatch) before any code was written.
- **Architecture & implementation** — the layered design, validation rules, and
  edge cases (route ordering for `/export` vs `/:id`, float rounding to cents,
  inclusive date bounds) were generated and refined iteratively.
- **Tests** — 42 unit + integration tests (Jest + supertest) were authored
  alongside the code; all pass. Behaviour was additionally verified against a
  live server with `curl`.

> 📸 See `docs/screenshots/` for AI-interaction screenshots, the running API, and
> sample request/response captures.

---

## 🧪 Tests

```bash
npm test
```

42 tests covering: every validation rule, per-type account constraints, balance
math, transfer crediting/debiting, status exclusion, all filter combinations,
date-range inclusivity, the summary identity, the interest formula, CSV export,
and the 429 rate-limit response.

See **`HOWTORUN.md`** for full run/test instructions.

---

## ⚠️ Known limitations / assumptions

- **In-memory storage** — data does not survive a restart (per the spec).
- **Single currency** — money math assumes one currency context and performs no
  FX conversion (see architecture decision #10). Mixing currencies on one
  account would sum them naively.
- **In-process rate limiter** — the 100 req/min/IP limit is tracked per process;
  a multi-instance deployment would need a shared store (e.g. Redis).

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
