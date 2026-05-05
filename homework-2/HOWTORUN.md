# ▶️ How to Run — Intelligent Customer Support Ticket System

> Step-by-step guide for reviewers. The goal is: clone → run → exercise every endpoint in under 5 minutes, no Docker required.

---

## 1. Prerequisites

| Tool | Version | How to check |
|---|---|---|
| **Node.js** | ≥ 18 (tested on 22.12.0) | `node -v` |
| **npm** | bundled with Node | `npm -v` |
| **(optional) VS Code** | any recent | for the REST Client extension |
| **(optional) `curl`** | any | for terminal-based smoke tests |
| **(optional) `python3`** | any | only used by `demo/import-all.sh` to pretty-print the final count |

If `node -v` reports anything older than 18, install via [nvm](https://github.com/nvm-sh/nvm):
```bash
nvm install 22
nvm use 22
```

---

## 2. Install

```bash
cd homework-2
npm install
```

Installs runtime deps (`express`, `multer`, `csv-parse`, `fast-xml-parser`, `uuid`) and dev deps (`vitest`, `supertest`, `@vitest/coverage-v8`). No global installs needed.

---

## 3. Start the server

```bash
npm start
```

Output:
```
> intelligent-support-tickets@1.0.0 start
> node src/index.js

Server running on http://localhost:3000
```

Health check from another terminal:
```bash
curl http://localhost:3000/
# → {"status":"ok","message":"Intelligent Customer Support Ticket System"}
```

To stop the server: `Ctrl + C` in the terminal where it runs. If you accidentally leave one running and `npm start` later fails with `EADDRINUSE`, free the port:
```bash
lsof -ti:3000 | xargs kill -9
```

### Running on a different port

```bash
PORT=4000 npm start
```

---

## 4. Seed sample data (optional but recommended)

With the server running, in a second terminal:
```bash
./demo/import-all.sh
```

Output:
```
=== importing sample_tickets.csv ===
{"total":50,"successful":50,"failed":[]}
=== importing sample_tickets.json ===
{"total":20,"successful":20,"failed":[]}
=== importing sample_tickets.xml ===
{"total":30,"successful":30,"failed":[]}

=== final ticket count ===
100
```

The script POSTs all three valid fixtures (`tests/fixtures/sample_tickets.{csv,json,xml}`) to the running server. If you want to point it at a different host:
```bash
HOST=http://staging.example.com ./demo/import-all.sh
```

---

## 5. Exercise the API — three options

### Option A — REST Client extension (recommended)

1. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension in VS Code.
2. Open `homework-2/demo/sample-requests.http`.
3. Click *Send Request* above any block.

The file is organized by Stage (CRUD → validation → import → filter → auto-classify → log) and uses chained variables — for example, sending the `createTicket` block first lets the GET-by-id, PUT, and DELETE blocks reference the new id automatically via `{{createTicket.response.body.id}}`.

### Option B — `curl` from the terminal

A few smoke commands:
```bash
# create
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "alice@example.com",
    "subject": "Cannot log in",
    "description": "Login fails after I reset the password yesterday"
  }'

# list with filter
curl 'http://localhost:3000/tickets?category=technical_issue&priority=high'

# auto-classify on creation
curl -X POST 'http://localhost:3000/tickets?autoClassify=true' \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "bob@example.com",
    "subject": "Production down",
    "description": "We cannot access the dashboard. asap fix needed"
  }'

# bulk import a single fixture
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@tests/fixtures/sample_tickets.csv"

# decision log
curl http://localhost:3000/classifier/log
```

The full set of `curl` examples for every endpoint lives in [`API_REFERENCE.md`](./API_REFERENCE.md).

### Option C — browser (read-only)

Open these directly in any browser:
- http://localhost:3000/ — health check
- http://localhost:3000/tickets — full list (after seeding)
- http://localhost:3000/tickets?category=billing_question — filtered
- http://localhost:3000/classifier/log — classifier decision log

The browser only handles `GET`. For POST/PUT/DELETE use Option A or B.

---

## 6. Run the tests

### All tests
```bash
npm test
```
Expected output:
```
 Test Files  19 passed (19)
      Tests  205 passed (205)
   Duration  ~3 s
```

### With coverage
```bash
npm run test:coverage
```
Generates `coverage/index.html`. Open it:
```bash
open coverage/index.html      # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html     # Windows
```

The threshold (`vitest.config.js`) requires **all four metrics ≥ 85%**. Current actual: **93% / 88.31% / 100% / 93%**. If you change code and one of those drops below 85, `test:coverage` exits non-zero.

### Watch mode (re-runs on file change)
```bash
npx vitest
```

### Subset by directory
```bash
npx vitest run tests/unit
npx vitest run tests/integration
npx vitest run tests/performance
```

See [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) for the full file map and a manual-testing checklist.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `EADDRINUSE: address already in use :::3000` | A previous `npm start` is still alive | `lsof -ti:3000 \| xargs kill -9` |
| `npm install` fails with peer-dep warnings | Node < 18 | upgrade Node |
| `./demo/import-all.sh: Permission denied` | Lost the executable bit | `chmod +x demo/import-all.sh` |
| `npm run test:coverage` exits non-zero | Coverage dropped below 85% | look at the breakdown table; either restore tests or, if coverage is genuinely fine, lower the threshold in `vitest.config.js` |
| REST Client says "request not sent" for a chained variable | Earlier block in the chain wasn't sent yet | click *Send Request* on the upstream block first (e.g. `createTicket`) |
| `curl` returns nothing visible from `tickets/import` | Forgot the `-F "file=@..."` flag | use `-F`, not `-d`; the endpoint is `multipart/form-data`, not JSON |
| Bulk import returns `total: 0` | Empty file or wrong column names | check the file and the docs in [`API_REFERENCE.md`](./API_REFERENCE.md#7-post-ticketsimport--bulk-import) |
| Auto-classify response has `category: "other"` | The text didn't match any category keyword | this is the documented fallback, not a bug — pick a different test ticket or edit the description |

---

## 8. Reset / clean state

The store is in-memory, so to reset everything just stop and restart the server:
```bash
# Ctrl+C in the npm start terminal
npm start
```

To remove generated artefacts:
```bash
rm -rf coverage node_modules
```

(The `coverage/` and `node_modules/` directories are gitignored at the repo root.)

---

## 9. What to look at first

If you have only 5 minutes:
1. `npm install && npm start` — server up
2. `./demo/import-all.sh` — 100 tickets seeded
3. `curl 'http://localhost:3000/tickets?category=billing_question&priority=medium'` — confirm filtering works
4. `npm run test:coverage` — see all four metrics over 85
5. Skim [`README.md`](./README.md) → "AI Usage" section for the multi-model workflow

If you have 15 minutes, also walk through `demo/sample-requests.http` end-to-end in VS Code.

---

<div align="center">

— *Drafted by Claude Opus 4.7 (claude-opus-4-7), reviewed and edited by Anastasia Kopiika.*

</div>
