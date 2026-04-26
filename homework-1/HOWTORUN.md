# ▶️ How to Run the Banking Transactions API

A minimal Node.js + Express REST API. Runs locally — **no Docker, no database**.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | **18+** (tested on 22.12.0) | `node -v` |
| npm | bundled with Node | `npm -v` |

That's it.

---

## 2. Install

From the `homework-1/` directory:

```bash
npm install
```

This installs three runtime dependencies: `express`, `express-rate-limit`, `uuid` (and their transitive deps).

---

## 3. Start the Server

```bash
npm start
```

You should see:

```
Banking API listening on http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/
# {"name":"Banking Transactions API","status":"ok","version":"1.0.0"}
```

### Alternative: one-command bootstrap

```bash
./demo/run.sh
```

The script runs `npm install` (if `node_modules` is missing) and then `npm start`.

---

## 4. (Optional) Seed Sample Data

In a **second** terminal, while the server is running:

```bash
node demo/seed.js
# or:
./demo/seed.sh
```

This POSTs the 7 transactions from `demo/sample-data.json` into the running API. Useful for trying the filter/summary/export endpoints with realistic data.

After seeding, account balances will be:
- `ACC-12345` → `4649.25`
- `ACC-67890` → `1675.25`
- `ACC-ABC12` → `2025.25`

---

## 5. Test the API

### Option A — VS Code REST Client (recommended)

1. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension.
2. Open `demo/sample-requests.http`.
3. Click **Send Request** above any block. The response opens in a side panel.

The file contains 40+ examples organised by stage (Core / Validation / Filtering / Summary / Interest / Export / Rate Limit).

### Option B — curl

```bash
# Create a transaction
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

# List everything
curl http://localhost:3000/transactions

# Filter
curl "http://localhost:3000/transactions?accountId=ACC-12345&type=transfer"

# Balance
curl http://localhost:3000/accounts/ACC-12345/balance

# Summary
curl http://localhost:3000/accounts/ACC-12345/summary

# Interest
curl "http://localhost:3000/accounts/ACC-12345/interest?rate=0.05&days=30"

# CSV export (download)
curl -OJ http://localhost:3000/transactions/export
```

### Option C — Browser

`GET` endpoints work straight from a browser:

- <http://localhost:3000/>
- <http://localhost:3000/transactions>
- <http://localhost:3000/accounts/ACC-12345/balance>
- <http://localhost:3000/transactions/export> ← will trigger a CSV download

---

## 6. Demonstrate Rate Limiting (Task 4 / Option D)

The default limit is **100 requests per minute per IP** — too high to trigger by hand. To demo a 429 response:

```bash
# Stop the running server (Ctrl+C), then:
RATE_LIMIT_MAX=3 RATE_LIMIT_WINDOW_MS=60000 npm start
```

Send any endpoint **4 times in a row** within a minute. The 4th call returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"error":"Too many requests","message":"Rate limit exceeded. Maximum 3 requests per 60s per IP."}
```

Successful responses always include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers so you can watch the quota count down.

---

## 7. Configuration

All knobs are environment variables — no config file:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window length in milliseconds |

Example:

```bash
PORT=4000 RATE_LIMIT_MAX=50 npm start
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: listen EADDRINUSE: address already in use :::3000` | Another process holds the port. Kill it: `lsof -ti:3000 \| xargs kill` |
| `seed.js` prints "Is the server running?" | Start the API in a second terminal first (`npm start`) |
| REST Client says "Request 'createTransfer' has not been sent" | That's a lint warning, not an error. Send the named request once and the substitution `{{createTransfer.response.body.id}}` will work. |
| 429 immediately on every request | You started the server with a low `RATE_LIMIT_MAX` and exceeded it. Either wait a minute or restart with the default. |
| `GET /transactions/export` returns a `Transaction not found` 404 | Should not happen — `/export` is registered before `/:id`. If you forked and changed route order, restore it. |

---

## 9. Stop the Server

`Ctrl+C` in the terminal that's running `npm start`. Or, from any terminal:

```bash
lsof -ti:3000 | xargs kill
```
