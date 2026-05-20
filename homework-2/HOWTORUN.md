# How to Run — Customer Support Ticket Management System

## Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v8+ (bundled with Node.js)
- **PowerShell** 5.1+ (Windows, for `.ps1` scripts)
- `curl` (for `.sh` scripts on Linux/macOS/Git Bash)

Verify your setup:
```bash
node --version   # should print v18.x or higher
npm --version
```

---

## Quick Start

```bash
# 1. Navigate to the project folder
cd homework-2

# 2. Install dependencies
npm install

# 3. Start the server (hot-reload mode)
npm run dev
```

The API will be available at **http://localhost:3000**.

---

## Using the Demo Scripts

All demo scripts live in `homework-2/demo/`.

### Windows — start the server

Double-click `demo/run.bat`, or from a terminal:
```cmd
demo\run.bat
```

This installs dependencies (if needed) and starts the server on port 3000.

---

### Seed initial test data (PowerShell)

With the server running, open a second terminal and run:
```powershell
.\demo\seed.ps1
```

This creates several tickets covering all categories and priorities. Each created ticket ID is printed to the console.

---

### Sample API calls

**PowerShell (Windows):**
```powershell
.\demo\sample-requests.ps1
```

**Bash / Git Bash / macOS / Linux:**
```bash
bash demo/sample-requests.sh
```

Both scripts walk through every endpoint:
- Create a ticket
- List all tickets (with filter examples)
- Get a single ticket by ID
- Update a ticket
- Delete a ticket
- Bulk import from `demo/sample-data.json`

---

### Import sample data manually

```powershell
# PowerShell
$body = Get-Content demo/sample-data.json -Raw
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/tickets/import" `
  -ContentType "application/json" -Body $body
```

```bash
# curl
curl -s -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: application/json" \
  -d @demo/sample-data.json
```

---

## Available Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/tickets` | Create a single ticket |
| GET | `/tickets` | List tickets (supports filters) |
| GET | `/tickets/:id` | Get a single ticket |
| PUT | `/tickets/:id` | Update a ticket (partial) |
| DELETE | `/tickets/:id` | Delete a ticket |
| POST | `/tickets/import` | Bulk import CSV / JSON / XML |

**Filter query parameters** for `GET /tickets`:
- `?status=new`
- `?priority=urgent`
- `?category=technical_issue`
- `?customer_id=<id>`
- `?assigned_to=<name>`

---

## npm Commands

```bash
npm run dev           # Start with hot-reload (development)
npm run build         # Compile TypeScript → dist/
npm start             # Run compiled build
npm test              # Run all tests
npm run test:coverage # Tests + coverage report
```

---

## Troubleshooting

**Port 3000 already in use**
```powershell
# Find and kill the process on Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**`node_modules` missing / install errors**
```bash
rm -rf node_modules package-lock.json
npm install
```

**TypeScript compile errors**
```bash
npm run build   # see full error output
```

**Server not reachable from seed/sample scripts**
Make sure the server is started (`npm run dev` or `run.bat`) before running `seed.ps1` or the sample-request scripts.

---

## Project Structure (quick reference)

```
homework-2/
├── src/                  # TypeScript source
│   ├── routes/           # Express route handlers
│   ├── services/         # Business logic & in-memory storage
│   ├── validators/       # Zod validation schemas
│   └── utils/            # Parsers, error handler, logger
├── tests/                # Jest unit + integration tests
├── demo/                 # Quick-start scripts & sample data
│   ├── run.bat           # Windows startup script
│   ├── seed.ps1          # Seed test data
│   ├── sample-requests.sh
│   ├── sample-requests.ps1
│   └── sample-data.json
├── API.md                # Full endpoint reference
├── DEVELOPMENT_PLAN.md   # Implementation plan
└── HOWTORUN.md           # This file
```
