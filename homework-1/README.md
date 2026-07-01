# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Mykhailo Gorishnyi
> **Date Submitted**: 2026-07-01
> **AI Tools Used**: Claude Code (Opus 4.8)

---

## 📋 Project Overview

A minimal REST API for banking transactions, built with **NestJS (Node.js + TypeScript)**
and **in-memory storage** (no database). It supports creating and querying transactions,
computing account balances, request validation with structured error messages, filtering,
and four extra features (summary, interest, CSV export, rate limiting).

All required tasks (1–3) plus **all four** optional Task 4 features (A + B + C + D) are implemented.

---

## ✨ Features Implemented

### Task 1 — Core API ⭐
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a new transaction (`201`) |
| `GET`  | `/transactions` | List / filter transactions |
| `GET`  | `/transactions/:id` | Get a transaction by id (`404` if missing) |
| `GET`  | `/accounts/:accountId/balance` | Current account balance |

### Task 2 — Validation ✅
- **Amount**: positive number, at most 2 decimal places.
- **Accounts**: must match `ACC-XXXXX` (alphanumeric). `fromAccount` is required for
  withdrawals/transfers, `toAccount` for deposits/transfers.
- **Currency**: valid ISO 4217 code (USD, EUR, GBP, JPY, …).
- **Type**: one of `deposit | withdrawal | transfer`.
- Unknown fields are rejected. Errors return the required shape:
  ```json
  {
    "error": "Validation failed",
    "details": [
      { "field": "amount", "message": "amount must be a positive number" },
      { "field": "currency", "message": "currency must be a valid ISO 4217 code (e.g. USD, EUR, GBP)" }
    ]
  }
  ```

### Task 3 — Transaction History (filtering) 📜
`GET /transactions` supports combinable query params:
- `?accountId=ACC-12345` — matches `fromAccount` **or** `toAccount`
- `?type=transfer`
- `?from=2024-01-01&to=2024-01-31` — inclusive date range (date-only `to` covers end of day)

### Task 4 — Additional Features (all four) 🌟
| Feature | Endpoint |
|---------|----------|
| **A. Summary** | `GET /accounts/:accountId/summary` — total deposits, total withdrawals, transaction count, most recent date, current balance |
| **B. Interest** | `GET /accounts/:accountId/interest?rate=0.05&days=30` — simple interest `principal × rate × days / 365` |
| **C. CSV Export** | `GET /transactions/export?format=csv` — CSV of transactions (honours the same filters) |
| **D. Rate Limiting** | 100 requests / minute / IP via `@nestjs/throttler`; returns `429` when exceeded |

---

## 🏗️ Architecture Decisions

- **NestJS** — chosen for its clean modular structure (modules / controllers / services),
  first-class DTO validation via decorators, and a built-in throttler for rate limiting.
- **In-memory storage** — a simple array inside `TransactionsService`, per the spec (no DB).
  Data resets on restart.
- **Validation** — `class-validator` DTOs + a global `ValidationPipe`. A custom
  `exceptionFactory` (in `src/main.ts`) reshapes errors into the required
  `{ error, details[] }` format.
- **Balance model** — derived from **completed** transactions: incoming
  deposits/transfers add, outgoing withdrawals/transfers subtract. Monetary values are
  rounded to 2 decimals to avoid floating-point drift.
- **Route ordering** — `GET /transactions/export` is declared before `GET /transactions/:id`
  so `export` is not captured as an id.
- **Accounts reuse Transactions** — `AccountsModule` imports `TransactionsModule` and derives
  balance/summary/interest from the single source of truth.

### Project structure
```
homework-1/
├── src/
│   ├── main.ts                     # bootstrap + global ValidationPipe (custom error format)
│   ├── app.module.ts               # ThrottlerModule (rate limiting) + feature modules
│   ├── common/csv.util.ts          # RFC 4180 CSV serialisation
│   ├── transactions/
│   │   ├── transactions.controller.ts
│   │   ├── transactions.service.ts # in-memory store + business logic
│   │   ├── transactions.module.ts
│   │   ├── dto/create-transaction.dto.ts
│   │   ├── dto/query-transactions.dto.ts
│   │   └── entities/transaction.entity.ts
│   └── accounts/
│       ├── accounts.controller.ts
│       ├── accounts.module.ts
│       └── dto/interest-query.dto.ts
├── demo/
│   ├── run.sh                      # install + build + start
│   ├── sample-requests.http        # REST Client / Postman requests
│   ├── sample-requests.sh          # curl smoke test of every endpoint
│   └── sample-data.json            # seed transactions
├── docs/screenshots/               # AI interaction + running app screenshots
├── README.md
└── HOWTORUN.md
```

---

## 🤖 How AI Was Used

This project was built end-to-end with **Claude Code**. Workflow:

1. **Requirements analysis** — Claude read `TASKS.md` and clarified two decisions with me:
   the tech stack (I chose NestJS) and which Task 4 features to build (I chose all four).
2. **Scaffolding & implementation** — Claude generated the NestJS module/controller/service
   structure, DTOs with `class-validator` rules, the in-memory service, and the custom
   validation-error formatter.
3. **Verification** — Claude installed dependencies, built the project, started the server,
   and ran a 13+ case `curl` suite (happy paths, validation errors, filters, `404`, and a
   105-request burst to confirm the `429` rate limit). All assertions passed
   (e.g. balance `500 − 100.5 − 50 = 349.5`, interest `349.5 × 0.05 × 30/365 = 1.44`).
4. **Documentation** — README, HOWTORUN, and demo scripts were generated and reviewed.

I reviewed the generated code rather than copy-pasting blindly — e.g. confirming the
conditional account validation and the route-ordering fix for `/export`.

See `docs/screenshots/` for captured AI interactions and running-app evidence.

---

## 🧪 Testing

Run the API, then exercise every endpoint:
```bash
npm run start:prod          # terminal 1
./demo/sample-requests.sh   # terminal 2
```
Or use `demo/sample-requests.http` with the VS Code REST Client extension / Postman.
Full run instructions are in [HOWTORUN.md](HOWTORUN.md).

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
