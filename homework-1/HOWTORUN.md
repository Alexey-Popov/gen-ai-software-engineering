# How to Run

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| [Node.js](https://nodejs.org/) | 18 or higher | `node -v` |
| npm | included with Node.js | `npm -v` |
| curl | any recent version | `curl --version` |
| jq *(optional, for pretty output)* | any | `jq --version` |

---

## Step 1 — Clone or download the project

```bash
cd homework-1
```

## Step 2 — Install dependencies

```bash
npm install
```

This installs `express` and `uuid`. Nothing else is required.

## Step 3 — Start the server

**Option A — via npm:**

```bash
npm start
```

**Option B — via the demo script (checks Node version, installs deps if missing):**

```bash
bash demo/run.sh
```

**Option C — with hot-reload for development:**

```bash
npm run dev
```

The server starts on **http://localhost:3000** by default.  
To use a different port:

```bash
PORT=8080 npm start
```

You should see:

```
Transactions API running on http://localhost:3000
```

---

## Step 4 — Make API calls

### Option A — Bash demo script

In a **second terminal** (keep the server running in the first):

```bash
bash demo/sample-requests.sh
```

This runs through all implemented features — creates transactions, queries them, tests validation errors, exports CSV, and checks rate limit headers. Requires `curl` and `jq`.

### Option B — HTTP Client (VS Code / JetBrains)

Open `demo/sample-requests.http` in:
- **VS Code** with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
- **JetBrains IDEs** (built-in HTTP Client)

Click "Send Request" above any `###` block to execute it individually.

### Option C — curl manually

```bash
# Create a deposit
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":1000,"currency":"USD","type":"deposit"}'

# List all transactions
curl http://localhost:3000/transactions

# Get account balance
curl http://localhost:3000/accounts/ACC-AA001/balance
```

---

## API Reference

### Transactions

```
POST   /transactions                         Create a transaction
GET    /transactions                         List transactions
GET    /transactions/:id                     Get transaction by ID
GET    /transactions/export?format=csv       Export as CSV
```

### Accounts

```
GET    /accounts/:accountId/balance          Current balance (per currency)
GET    /accounts/:accountId/summary          Deposits / withdrawals / transfers summary
GET    /accounts/:accountId/interest         Simple interest projection
```

### Query parameters for `GET /transactions` and `GET /transactions/export`

```
?accountId=ACC-AA001        transactions involving this account
?type=transfer              deposit | withdrawal | transfer
?from=2026-01-01            start date (inclusive)
?to=2026-12-31              end date (inclusive, covers the full day until 23:59:59)
```

Parameters can be combined: `?accountId=ACC-AA001&type=deposit&from=2026-01-01`

### Query parameters for `/accounts/:id/interest`

```
?rate=0.05     annual interest rate as a decimal (required, e.g. 0.05 = 5%)
?days=30       number of days to project (required, positive integer)
```

---

## Account Number Format

Account numbers must follow the pattern **`ACC-XXXXX`** where each `X` is an uppercase letter (`A–Z`) or digit (`0–9`).

Valid examples: `ACC-AA001`, `ACC-1A2B3`, `ACC-XYZ99`  
Invalid: `acc-001`, `ACC-AB`, `ACCOUNT-1`

---

## Rate Limiting

The API allows **100 requests per minute per IP address**.

Every response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window (100) |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | ISO 8601 timestamp when the window resets |

When the limit is exceeded, the API returns:

```
HTTP 429 Too Many Requests
Retry-After: 42
```

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per minute.",
  "retryAfter": 42
}
```

---

## Troubleshooting

**Port already in use**

```
Error: listen EADDRINUSE :::3000
```

Find and stop the process using port 3000:

```bash
lsof -ti:3000 | xargs kill -9
```

**`jq: command not found`**

`jq` is optional — the API still works without it. To install:

```bash
# macOS
brew install jq

# Ubuntu / Debian
sudo apt install jq
```

**`bash: demo/run.sh: Permission denied`**

```bash
chmod +x demo/run.sh demo/sample-requests.sh
```
