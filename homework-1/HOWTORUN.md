# ▶️ How to Run the application

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (bundled with Node.js)

Verify your versions:
```bash
node --version   # v18.0.0 or higher
npm --version
```

---

## 1. Install Dependencies

```bash
cd homework-1
npm install
```

---

## 2. Start the Server

### Development mode
Runs TypeScript directly via `ts-node` — no build step required:
```bash
npm run dev
```

### Production mode
Compile first, then run the compiled JavaScript:
```bash
npm run build
npm start
```

The server starts on **http://localhost:3000** by default.

To use a different port:
```bash
# Windows PowerShell
$env:PORT=4000; npm run dev

# macOS / Linux
PORT=4000 npm run dev
```

---

## 3. Test the API

### Using PowerShell (Windows)

**Create a transaction:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/transactions" -Method POST `
  -ContentType "application/json" `
  -Body '{"fromAccount":"ACC-AA111","toAccount":"ACC-BB222","amount":100.50,"currency":"USD","type":"transfer"}'
```

**List all transactions:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/transactions"
```

**Filter transactions:**
```powershell
# By account
Invoke-RestMethod -Uri "http://localhost:3000/transactions?accountId=ACC-AA111"

# By type
Invoke-RestMethod -Uri "http://localhost:3000/transactions?type=transfer"

# By date range
Invoke-RestMethod -Uri "http://localhost:3000/transactions?from=2024-01-01&to=2024-12-31"

# Combined
Invoke-RestMethod -Uri "http://localhost:3000/transactions?accountId=ACC-AA111&type=transfer"
```

**Get a specific transaction:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/transactions/{id}"
```

**Get account balance:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/accounts/ACC-AA111/balance"
```

**Get account summary:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/accounts/ACC-AA111/summary"
```

### Using curl.exe (Windows / macOS / Linux)

**Create a transaction:**
```bash
curl.exe -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d "{\"fromAccount\":\"ACC-AA111\",\"toAccount\":\"ACC-BB222\",\"amount\":100.50,\"currency\":\"USD\",\"type\":\"transfer\"}"
```

**List all transactions:**
```bash
curl.exe http://localhost:3000/transactions
```

**Filter transactions:**
```bash
curl.exe "http://localhost:3000/transactions?accountId=ACC-AA111&type=transfer"
curl.exe "http://localhost:3000/transactions?from=2024-01-01&to=2024-12-31"
```

**Get account balance:**
```bash
curl.exe http://localhost:3000/accounts/ACC-AA111/balance
```

**Get account summary:**
```bash
curl.exe http://localhost:3000/accounts/ACC-AA111/summary
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Request successful |
| `201` | Transaction created |
| `400` | Validation error — check the `details` array in the response |
| `404` | Transaction or account not found |

---

## Notes

- Data is stored **in memory only** — it resets every time the server restarts.
- Account numbers must follow the format `ACC-XXXXX` (5 alphanumeric characters).
- Currency codes must be valid ISO 4217 (e.g. `USD`, `EUR`, `GBP`, `JPY`).