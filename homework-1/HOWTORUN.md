# ▶️ How to Run the Application

Banking Transactions API — NestJS (Node.js + TypeScript). In-memory storage, no database.

## 📋 Prerequisites

- **Node.js** ≥ 18 (developed on Node 26)
- **npm** ≥ 9
- `curl` and `python3` if you want to run `demo/sample-requests.sh` (both ship with macOS)

## 🔧 Setup & Run

From the `homework-1/` directory:

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Start (production)
npm run start:prod
```

The API starts on **http://localhost:3000**. To use a different port:

```bash
PORT=4000 npm run start:prod
```

### Development mode (auto-reload)
```bash
npm run start:dev
```

### One-shot script
```bash
./demo/run.sh          # installs, builds, and starts the API
```

## 🔐 Environment

No environment variables are required. The only optional one is:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port the API listens on |

Storage is **in-memory** — all data is cleared when the process restarts.

## 🧪 Testing the API

### Option 1 — automated curl script (server must be running)
```bash
./demo/sample-requests.sh
# or against a custom URL:
./demo/sample-requests.sh http://localhost:4000
```

### Option 2 — REST Client / Postman
Open `demo/sample-requests.http` in VS Code (with the **REST Client** extension) and click
*Send Request* on each block, or import it into Postman.

### Option 3 — manual curl
```bash
# Create a deposit
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-12345","amount":1000,"currency":"USD","type":"deposit"}'

# Create a transfer
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

# List all transactions
curl http://localhost:3000/transactions

# Filter (account + type + date range are combinable)
curl "http://localhost:3000/transactions?accountId=ACC-12345&type=transfer"

# Account balance
curl http://localhost:3000/accounts/ACC-12345/balance

# Summary (Task 4A)
curl http://localhost:3000/accounts/ACC-12345/summary

# Interest (Task 4B)
curl "http://localhost:3000/accounts/ACC-12345/interest?rate=0.05&days=30"

# CSV export (Task 4C)
curl "http://localhost:3000/transactions/export?format=csv"
```

## 📡 Endpoint Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Create a transaction (`201`) |
| `GET`  | `/transactions` | List/filter (`?accountId`, `?type`, `?from`, `?to`) |
| `GET`  | `/transactions/:id` | Get by id (`404` if not found) |
| `GET`  | `/transactions/export?format=csv` | Export as CSV (Task 4C) |
| `GET`  | `/accounts/:accountId/balance` | Current balance |
| `GET`  | `/accounts/:accountId/summary` | Account summary (Task 4A) |
| `GET`  | `/accounts/:accountId/interest?rate=&days=` | Simple interest (Task 4B) |

**Rate limiting (Task 4D):** every endpoint allows max **100 requests / minute / IP**;
exceeding it returns **`429 Too Many Requests`**.

## 🧯 Troubleshooting

- **`EADDRINUSE` (port busy):** another process uses 3000 → run with `PORT=4000 npm run start:prod`.
- **`429` during testing:** you hit the rate limit; wait ~60s or restart the server.
