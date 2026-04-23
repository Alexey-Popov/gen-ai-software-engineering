# ▶️ How to Run

Quick guide to run the Banking Transactions API.

---

## Prerequisites

**Required:**
- Node.js v14+ ([download](https://nodejs.org/))
- npm (comes with Node.js)

**Optional:**
- VS Code with REST Client extension (for testing)
- curl (for command-line testing)

---

## Quick Start

### Option 1: Use the Start Script (Recommended)

```bash
cd homework-1
./demo/run.sh
```

The script checks Node.js installation, installs dependencies if needed, and starts the server.

### Option 2: Manual Start

```bash
cd homework-1
npm install
npm start
```

**Server will start at:** `http://localhost:3000`

---

## Verify Installation

Open your browser: `http://localhost:3000/`

You should see API documentation with all available endpoints.

---

## Testing the API

### Method 1: VS Code REST Client (Recommended)

1. Install "REST Client" extension in VS Code
2. Open `demo/sample-requests.http`
3. Click "Send Request" above any request

### Method 2: curl Commands

**Create a transaction:**
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'
```

**Get all transactions:**
```bash
curl http://localhost:3000/transactions
```

**Get account balance:**
```bash
curl http://localhost:3000/accounts/ACC-12345/balance
```

**Filter by account:**
```bash
curl "http://localhost:3000/transactions?accountId=ACC-12345"
```

**Calculate interest:**
```bash
curl "http://localhost:3000/accounts/ACC-12345/interest?rate=0.05&days=30"
```

**Export as CSV:**
```bash
curl "http://localhost:3000/transactions/export?format=csv"
```

### Method 3: Postman

Import requests from `demo/sample-requests.http` and set base URL to `http://localhost:3000`.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API documentation |
| POST | `/transactions` | Create transaction |
| GET | `/transactions` | List all (supports filtering) |
| GET | `/transactions/:id` | Get by ID |
| GET | `/transactions/export?format=csv` | Export CSV |
| GET | `/accounts/:id/balance` | Get balance |
| GET | `/accounts/:id/summary` | Get summary |
| GET | `/accounts/:id/interest?rate=X&days=Y` | Calculate interest |

**Query Parameters for filtering:**
- `accountId` - Filter by account (e.g., `?accountId=ACC-12345`)
- `type` - Filter by type (e.g., `?type=transfer`)
- `from` - Start date (e.g., `?from=2024-01-01`)
- `to` - End date (e.g., `?to=2024-01-31`)

---

## Response Examples

### Success (201 Created)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fromAccount": "ACC-12345",
  "toAccount": "ACC-67890",
  "amount": 100.5,
  "currency": "USD",
  "type": "transfer",
  "timestamp": "2024-04-23T10:30:00.000Z",
  "status": "completed"
}
```

### Validation Error (400)
```json
{
  "error": "Validation failed",
  "details": [
    {"field": "amount", "message": "amount must be a positive number with maximum 2 decimal places"}
  ]
}
```

### Not Found (404)
```json
{
  "error": "Transaction not found",
  "id": "non-existent-id"
}
```

---

## Troubleshooting

### Port 3000 already in use
```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
```

### Node.js not found
Install Node.js from https://nodejs.org/ and restart your terminal.

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Permission denied (run.sh)
```bash
chmod +x demo/run.sh
./demo/run.sh
```

### Validation Requirements

**Account Format:**
- Pattern: `ACC-XXXXX` (5 alphanumeric characters)
- Valid: `ACC-12345`, `ACC-AB123`

**Amount:**
- Must be positive
- Maximum 2 decimal places
- Valid: `100`, `100.5`, `100.50`

**Currency:**
- Valid ISO 4217 codes: `USD`, `EUR`, `GBP`, `JPY`, etc.

**Type:**
- Must be: `deposit`, `withdrawal`, or `transfer`

---

## Stopping the Server

Press `Ctrl + C` in the terminal.

---

## Development Mode

Auto-restart on file changes:
```bash
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

Example:
```bash
PORT=4000 npm start
```

---

## Testing Checklist

- [ ] Server starts on port 3000
- [ ] GET / returns documentation
- [ ] POST /transactions creates transaction
- [ ] GET /transactions lists all
- [ ] Filtering works (accountId, type, date)
- [ ] GET /accounts/:id/balance works
- [ ] GET /accounts/:id/summary works
- [ ] Interest calculation works
- [ ] CSV export works
- [ ] Validation errors return 400
- [ ] Invalid IDs return 404

---

## Additional Resources

- **Sample Requests**: `demo/sample-requests.http`
- **Sample Data**: `demo/sample-data.json`
- **Full Documentation**: `README.md`

---

## Quick Tips

**Pretty-print JSON with jq:**
```bash
curl http://localhost:3000/transactions | jq '.'
```

**Reset data:**
Restart the server (data is in-memory only)

**Monitor requests:**
Watch the terminal where the server is running

---

<div align="center">

**Need help?** Check the troubleshooting section above

**All working?** You're ready to start using the API! 🚀

</div>
