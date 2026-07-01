# Banking Transactions API

> **Student Name**: [Your Name]
> **Date Submitted**: [Date]
> **AI Tools Used**: Kiro (AI-Assisted Development)

---

## Project Overview

A REST API for banking transactions built with Next.js App Router and TypeScript. The API provides endpoints for creating, listing, filtering, and exporting financial transactions, calculating account balances, summaries, and simple interest, with rate limiting for abuse protection. All data is stored in-memory using a singleton Map.

## Features Implemented

- **Core CRUD endpoints** — POST, GET all, GET by ID for transactions
- **Transaction validation** — Amount (positive, max 2 decimals), account format (ACC-XXXXX), ISO 4217 currency, type enum
- **Transaction filtering** — Filter by account ID, transaction type, and date range (with AND logic for combined filters)
- **Account balance calculation** — Net balance from completed deposits, withdrawals, and transfers
- **Account summary** — Total deposits, withdrawals, transaction count, most recent date
- **Simple interest calculation** — Formula: balance * rate * days / 365
- **CSV export** — Export all transactions with proper Content-Type header
- **Rate limiting** — 100 requests per minute per IP using sliding window counter

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Runtime | Node.js 18+ |
| Testing | Vitest |
| Property Testing | fast-check |
| ID Generation | uuid v4 |
| Storage | In-memory Map |

## Architecture

The application uses Next.js App Router with API route handlers (`route.ts` files). Key design decisions:

- **App Router pattern** — Each endpoint is a `route.ts` file exporting named HTTP method handlers
- **In-memory storage** — Singleton `Map<string, Transaction>` for O(1) lookups by ID
- **Validation layer** — Dedicated validator module decoupled from route handlers for testability
- **Rate limiting** — Sliding window counter per IP implemented as Next.js middleware
- **Error handling** — Consistent JSON error format with optional field-level validation details

## Project Structure

```
src/
├── app/
│   └── api/
│       ├── transactions/
│       │   ├── route.ts              # POST, GET /api/transactions
│       │   ├── [id]/
│       │   │   └── route.ts          # GET /api/transactions/:id
│       │   └── export/
│       │       └── route.ts          # GET /api/transactions/export
│       └── accounts/
│           └── [accountId]/
│               ├── balance/
│               │   └── route.ts      # GET /api/accounts/:accountId/balance
│               ├── summary/
│               │   └── route.ts      # GET /api/accounts/:accountId/summary
│               └── interest/
│                   └── route.ts      # GET /api/accounts/:accountId/interest
├── lib/
│   ├── store.ts                      # Transaction Store singleton
│   ├── validator.ts                  # Input validation logic
│   ├── rate-limiter.ts               # Sliding window rate limiter
│   ├── errors.ts                     # Error response builder
│   ├── csv.ts                        # CSV export utility
│   └── types.ts                      # TypeScript interfaces and types
├── middleware.ts                      # Next.js middleware for rate limiting
└── __tests__/
    ├── unit/                         # Unit tests
    ├── properties/                   # Property-based tests (fast-check)
    └── integration/                  # API integration tests
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Create a new transaction |
| GET | `/api/transactions` | List all transactions (with optional filters) |
| GET | `/api/transactions/:id` | Get a transaction by ID |
| GET | `/api/transactions/export?format=csv` | Export transactions as CSV |
| GET | `/api/accounts/:accountId/balance` | Get account balance |
| GET | `/api/accounts/:accountId/summary` | Get account summary |
| GET | `/api/accounts/:accountId/interest?rate=0.05&days=30` | Calculate simple interest |

## Query Parameters

### GET /api/transactions

| Parameter | Description |
|-----------|-------------|
| `accountId` | Filter by account (matches fromAccount or toAccount) |
| `type` | Filter by type: deposit, withdrawal, transfer |
| `from` | Filter by start date (ISO 8601, inclusive) |
| `to` | Filter by end date (ISO 8601, inclusive) |

### GET /api/accounts/:accountId/interest

| Parameter | Description |
|-----------|-------------|
| `rate` | Interest rate as a positive number (e.g., 0.05 for 5%) |
| `days` | Number of days as a positive integer |

---

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
