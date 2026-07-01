# Transactions API

A REST API for managing financial transactions — deposits, withdrawals, and transfers — with validation, filtering, account analytics, and rate limiting.

Built with **Node.js** and **Express** as a homework assignment.

---

## Implemented Features

### Task 1 — Core API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a new transaction |
| `GET` | `/transactions` | List all transactions |
| `GET` | `/transactions/:id` | Get a transaction by ID |
| `GET` | `/accounts/:accountId/balance` | Get account balance (grouped by currency) |

### Task 2 — Validation
- **Amount** — must be a positive number with at most 2 decimal places
- **Account number** — must match `ACC-XXXXX` (5 uppercase alphanumeric characters)
- **Currency** — must be a valid [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) code (150+ codes supported)
- **Type** — one of `deposit`, `withdrawal`, `transfer`
- All errors returned as structured `{ field, message }` objects

### Task 3 — Transaction Filtering
`GET /transactions` supports query parameters:

| Parameter | Example | Description |
|-----------|---------|-------------|
| `accountId` | `ACC-AA001` | Transactions where account appears as sender or receiver |
| `type` | `transfer` | Filter by transaction type |
| `from` | `2026-01-01` | Start date (inclusive) |
| `to` | `2026-12-31` | End date (inclusive, covers the full day) |

Filters can be combined freely. Invalid filter values return `400` with field-level errors.

### Task 4 — Additional Features

**A · Account Summary** — `GET /accounts/:accountId/summary`  
Returns transaction count, last transaction date, and per-currency totals split by deposits, withdrawals, sent transfers, and received transfers.

**B · Simple Interest** — `GET /accounts/:accountId/interest?rate=0.05&days=30`  
Calculates interest using the formula `I = P × r × (days / 365)` applied to the current balance per currency.

**C · CSV Export** — `GET /transactions/export?format=csv`  
Exports transactions as a downloadable CSV file. Supports the same filters as `GET /transactions`.

**D · Rate Limiting**  
Maximum 100 requests per minute per IP address. Returns `429 Too Many Requests` on violation.  
Standard headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

---

## Architectural Decisions

### In-memory storage
Transactions are stored in a plain JavaScript array (`src/store.js`). This satisfies the assignment requirement and avoids database setup overhead. The tradeoff is that all data is lost on server restart — acceptable for a demo, not for production.

### Balance computed from history, not stored
Account balance is not a field on any object. It is recalculated on every request by iterating completed transactions. This ensures consistency: there is a single source of truth (the transaction log), and balances cannot drift out of sync with history.

### Separation of concerns across `src/`
The code is split into four layers with clear responsibilities:

| Layer | Path | Responsibility |
|-------|------|----------------|
| Route handlers | `src/routes/` | HTTP concerns — parse request, call logic, return response |
| Validators | `src/validators/` | Input validation rules; return `{ field, message }` arrays |
| Model | `src/models/` | Transaction factory — generates `id` and `timestamp` |
| Utilities | `src/utils/` | Pure functions shared across routes (`computeBalance`, `applyFilters`, `escapeCSV`, …) |

Route files contain no business logic; utility files contain no HTTP knowledge.

### Consistent error format
All `400` errors — whether from body validation or query filter validation — use the same `{ error, details: [{ field, message }] }` shape. This lets API consumers handle errors generically.

### Route ordering for `/transactions/export`
Express matches routes in definition order. The `/export` path is registered **before** `/:id` to prevent Express from treating the literal string `"export"` as a transaction ID.

### Fixed-window rate limiter
Rate limiting uses a fixed one-minute window stored in a `Map` keyed by IP address. A `setInterval` with `.unref()` periodically removes expired entries to prevent memory growth without blocking the Node.js process from exiting.

---

## Transaction Model

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fromAccount": "ACC-AA001",
  "toAccount": "ACC-BB002",
  "amount": 250.50,
  "currency": "USD",
  "type": "transfer",
  "timestamp": "2026-01-15T14:30:00.000Z",
  "status": "completed"
}
```

`fromAccount` is `null` for deposits; `toAccount` is `null` for withdrawals.

## Error Response Format

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount",   "message": "Amount must be a positive number" },
    { "field": "currency", "message": "Invalid currency code. Must be a valid ISO 4217 code (e.g. USD, EUR, GBP)" }
  ]
}
```

---

## Project Structure

```
homework-1/
├── README.md
├── HOWTORUN.md
├── package.json
├── .gitignore
├── demo/
│   ├── run.sh                      # Starts the server
│   ├── sample-requests.sh          # Curl-based API demo
│   ├── sample-requests.http        # VS Code / JetBrains HTTP Client
│   └── sample-data.json            # Sample transaction dataset
├── docs/
│   └── screenshots/
└── src/
    ├── index.js                    # Express app, middleware wiring
    ├── store.js                    # In-memory transaction store
    ├── models/
    │   └── transaction.js          # createTransaction() factory
    ├── validators/
    │   └── transactionValidator.js # validateTransaction(), parseFilterErrors()
    ├── utils/
    │   └── helpers.js              # computeBalance, applyFilters, escapeCSV, …
    ├── middleware/
    │   └── rateLimiter.js          # Fixed-window rate limiter
    └── routes/
        ├── transactions.js         # POST/GET /transactions, GET /export
        └── accounts.js             # GET /balance, /summary, /interest
```

---

## Getting Started

See **[HOWTORUN.md](./HOWTORUN.md)** for installation and run instructions.
