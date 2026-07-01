# ▶️ How to Run the application

Banking Transactions API — Node.js + Express, in-memory storage.

## 🔧 Prerequisites

- **Node.js ≥ 18** (uses `crypto.randomUUID` and `node --watch`)
- **npm** (bundled with Node)
- Optional: `jq` and `curl` for the demo seed script

Check your version:

```bash
node --version   # should print v18.x or newer
```

## 📦 Install

From the `homework-1/` directory:

```bash
npm install
```

## 🚀 Run

```bash
npm start            # starts on http://localhost:3000
# or pick a port:
PORT=4000 npm start
# or use the helper (installs deps if missing):
./demo/run.sh
```

You should see:

```
Banking Transactions API listening on http://localhost:3000
```

## 🧪 Test

```bash
npm test             # runs the Jest suite (42 tests)
npm run test:watch   # watch mode
```

## 🔌 Try it

With the server running, in another terminal:

```bash
# Create a deposit
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-12345","amount":500,"currency":"USD","type":"deposit"}'

# Create a transfer
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

# Account balance
curl http://localhost:3000/accounts/ACC-12345/balance

# Filtered list
curl "http://localhost:3000/transactions?accountId=ACC-12345&type=transfer"

# Task 4-A: Account summary (deposits, withdrawals, count, most recent date)
curl http://localhost:3000/accounts/ACC-12345/summary

# Task 4-B: Simple interest on current balance (annual rate, N days)
curl "http://localhost:3000/accounts/ACC-12345/interest?rate=0.05&days=30"

# Task 4-C: CSV export (accepts the same filters as the list endpoint)
curl "http://localhost:3000/transactions/export?format=csv"
# ...export only one account:
curl "http://localhost:3000/transactions/export?format=csv&accountId=ACC-12345"

# Task 4-D: Rate limiting — fire >100 requests/min from one IP to get HTTP 429.
# This loop prints the status code of each request; the 101st should be 429.
for i in $(seq 1 101); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:3000/health
done; echo
```

Or load everything at once (server must be running; needs `jq`):

```bash
./demo/seed.sh
```

More examples — including the VS Code REST Client file — are in
[`demo/sample-requests.http`](demo/sample-requests.http).

## 📚 Endpoint reference

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/transactions` | Create a transaction | `201` |
| `GET` | `/transactions` | List (filters: `accountId`, `type`, `from`, `to`) | `200` |
| `GET` | `/transactions/:id` | Get one transaction | `200` / `404` |
| `GET` | `/transactions/export?format=csv` | Export as CSV | `200` |
| `GET` | `/accounts/:accountId/balance` | Current balance | `200` |
| `GET` | `/accounts/:accountId/summary` | Deposits/withdrawals/count/recency | `200` |
| `GET` | `/accounts/:accountId/interest?rate=&days=` | Simple interest | `200` |
| `GET` | `/health` | Liveness check | `200` |

**Status codes:** `201` created · `200` ok · `400` validation/bad input ·
`404` not found · `429` rate limit exceeded · `500` unexpected error.

**Validation rules** (return `400` with `{ "error": "Validation failed", "details": [...] }`):
- `amount` — positive, ≤ 2 decimal places
- account numbers — `ACC-XXXXX` (exactly 5 alphanumeric chars)
- `currency` — supported ISO 4217 code (USD, EUR, GBP, JPY, …)
- `type` — `deposit` (only `toAccount`) · `withdrawal` (only `fromAccount`) ·
  `transfer` (both, distinct)

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |

> ℹ️ Storage is **in-memory** — all data is reset when the server restarts.
