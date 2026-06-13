# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Roman Popyk
> **Date Submitted**: 11.05.2026
> **AI Tools Used**: Claude Code

## Used promts

Task 1

```
Create a Node.js app
--
Use TS for writing code
--
Short description of the app:
A minimal REST API for banking transactions
--
REST API:
Method	Endpoint	Description
POST	/transactions	Create a new transaction
GET	/transactions	List all transactions
GET	/transactions/:id	Get a specific transaction by ID
GET	/accounts/:accountId/balance	Get account balance
Transaction Model:
{
  "id": "string (auto-generated)",
  "fromAccount": "string",
  "toAccount": "string",
  "amount": "number",
  "currency": "string (ISO 4217: USD, EUR, GBP, etc.)",
  "type": "string (deposit | withdrawal | transfer)",
  "timestamp": "ISO 8601 datetime",
  "status": "string (pending | completed | failed)"
}
--
Requirements:
Use in-memory storage (array or object) — no database required
Validate that amounts are positive numbers
Return appropriate HTTP status codes (200, 201, 400, 404)
Include basic error handling
--
Put all code source to folder homework-1/src
Use as tamplate the next file ctructure:
- routes/
- models/
- validators/
- utils/
--
If you need some more details ask me before creacting
```

Task 2

```
Add validation logic for transactions:

Amount validation: Must be positive, maximum 2 decimal places
Account validation: Account numbers should follow format ACC-XXXXX (where X is alphanumeric)
Currency validation: Only accept valid ISO 4217 currency codes (USD, EUR, GBP, JPY, etc.)
Return meaningful error messages for invalid requests

Example validation error response:
{
  "error": "Validation failed",
  "details": [
    {"field": "amount", "message": "Amount must be a positive number"},
    {"field": "currency", "message": "Invalid currency code"}
  ]
}
```

Task 3

```
Implement transaction filtering on the GET /transactions endpoint:

Filter by account: ?accountId=ACC-12345
Filter by type: ?type=transfer
Filter by date range: ?from=2024-01-01&to=2024-01-31
Combine multiple filters
```

Task 4

```
Implement the next endpoint:
GET /accounts/:accountId/summary
Returns:
Total deposits
Total withdrawals
Number of transactions
Most recent transaction date
```

---

## 📋 Project Overview

A minimal REST API for banking transactions built with **Node.js**, **Express**, and **TypeScript**. The API manages financial transactions between accounts using in-memory storage, with full input validation, account balance calculation, and flexible transaction filtering.

---

## Features Implemented

### Endpoints

| Method | Endpoint                       | Description                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| `POST` | `/transactions`                | Create a new transaction                      |
| `GET`  | `/transactions`                | List all transactions (with optional filters) |
| `GET`  | `/transactions/:id`            | Get a specific transaction by ID              |
| `GET`  | `/accounts/:accountId/balance` | Get account balance grouped by currency       |
| `GET`  | `/accounts/:accountId/summary` | Get account activity summary                  |

### Transaction Filtering (`GET /transactions`)

Query parameters can be combined freely:

| Parameter   | Example                | Description                                       |
| ----------- | ---------------------- | ------------------------------------------------- |
| `accountId` | `?accountId=ACC-AB123` | Transactions involving this account (either side) |
| `type`      | `?type=transfer`       | Filter by transaction type                        |
| `from`      | `?from=2024-01-01`     | Transactions on or after this date                |
| `to`        | `?to=2024-01-31`       | Transactions on or before this date               |

### Account Summary (`GET /accounts/:accountId/summary`)

Returns a full activity breakdown for an account:

- **Total deposits** — summed by currency
- **Total withdrawals** — summed by currency
- **Transaction count** — all transactions involving the account
- **Last transaction date** — ISO 8601 timestamp of the most recent activity

### Input Validation

All inputs are validated before processing. Invalid requests return `400` with a structured error body:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must have at most 2 decimal places"
    },
    {
      "field": "currency",
      "message": "Invalid currency code. Must be a valid ISO 4217 code (e.g. USD, EUR, GBP)"
    }
  ]
}
```

Rules enforced:

- **Account numbers** — must match `ACC-XXXXX` (5 alphanumeric characters)
- **Amount** — must be a positive number with at most 2 decimal places
- **Currency** — must be a valid ISO 4217 code (80+ currencies supported)
- **Type** — must be one of `deposit`, `withdrawal`, `transfer`

---

## Architecture Decisions

### Folder Structure

```
src/
├── index.ts               # Express app entry point and server bootstrap
├── models/
│   ├── transaction.ts     # TypeScript interfaces and types
│   └── store.ts           # In-memory storage (array + accessor functions)
├── routes/
│   ├── transactions.ts    # POST /transactions, GET /transactions, GET /transactions/:id
│   └── accounts.ts        # GET /accounts/:id/balance, GET /accounts/:id/summary
├── validators/
│   └── transaction.validator.ts  # Input validation for transaction creation
└── utils/
    ├── filter.ts          # Query param parsing and transaction filtering logic
    └── id.ts              # UUID generation wrapper (crypto.randomUUID)
```

### Key Decisions

**Separation of concerns** — validation, filtering, storage, and routing each live in their own layer. Routes stay thin: parse input, delegate, respond.

**Typed errors** — both body validation (`ValidationError`) and query param validation (`FilterParseError`) return structured arrays rather than a single string, so clients can map errors back to individual fields.

**Multi-currency balances** — balance and summary totals are grouped by currency code instead of summed into one number, which would be meaningless across currencies.

**Transfers excluded from deposit/withdrawal totals** — the `/summary` endpoint counts only `deposit` and `withdrawal` types in their respective totals. Transfers affect balance but represent internal movement, not income or spending.

**Date filter semantics** — `?from=YYYY-MM-DD` is treated as the start of that day (00:00:00 UTC) and `?to=YYYY-MM-DD` as the end of the day (23:59:59.999 UTC), making date-only inputs behave intuitively as inclusive ranges.

**No database** — storage is a plain in-memory array. All data resets on server restart. This keeps the setup dependency-free and the code focused on API design rather than persistence.

<div align="center">

_This project was completed as part of the AI-Assisted Development course._

</div>
