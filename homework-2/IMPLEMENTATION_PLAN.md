# 🎧 Homework 2 — Implementation Plan

Step-by-step plan for building the **Intelligent Customer Support Ticket System**.
Each stage is implemented and verified independently before moving on to the next.

**Stack:** Node.js 18+ · Express 4 (ESM) · in-memory storage · Vitest (or Jest) + Supertest for tests
**Runs locally without Docker** — only Node.js is required.

**Reference:** [`TASKS.md`](./TASKS.md)

---

## 🔧 Stage 0 — Project Initialization

- `package.json` (ESM, scripts: `start`, `dev`, `test`, `test:coverage`)
- Install runtime deps: `express`, `uuid`, `multer` (file uploads), `csv-parse`, `fast-xml-parser`
- Install dev deps: `vitest`, `supertest`, `@vitest/coverage-v8`
- Project skeleton:
  ```
  src/{routes,services,parsers,validators,classifier,store,middleware,utils}
  tests/{unit,integration,performance,fixtures}
  demo/  docs/screenshots/
  ```
- `src/index.js` + `src/app.js` with Express skeleton and `GET /` health-check
- Run locally and confirm the server starts on `localhost:3000`

**Outcome:** working "hello world" server + green `npm test` (smoke test).

### Status
- [x] Completed
- Notes: Server starts on localhost:3000, smoke test passes (1/1 green).

---

## ⭐ Stage 1 — Ticket Model + In-Memory Store

- `src/store/ticketStore.js` — `Map<id, ticket>` with `create`, `getAll`, `getById`, `update`, `delete`
- Server-generated fields: `id` (uuid v4), `created_at`, `updated_at`, `status: "new"` default
- Helpers for filtering (used later by `GET /tickets?...`)

**Outcome:** in-memory CRUD primitives covered by unit tests.

### Status
- [x] Completed
- Notes: TicketStore with Map-based CRUD (create, getAll, getById, update, delete), filter helpers, resolved_at tracking. All 21 unit tests passing.

---

## 🌐 Stage 2 — Task 1: CRUD Endpoints

- `src/routes/tickets.js` mounting:
  - `POST /tickets` → 201
  - `GET /tickets` → 200 (list, no filters yet)
  - `GET /tickets/:id` → 200 / 404
  - `PUT /tickets/:id` → 200 / 404 (also bumps `updated_at`, sets `resolved_at` when status flips to `resolved`)
  - `DELETE /tickets/:id` → 204 / 404
- Minimal error handler (404, 500)
- **Bootstrap `demo/sample-requests.http`** (REST Client): CRUD happy-path + 404 scenarios; chained requests via `# @name createTicket` + `{{createTicket.response.body.id}}`. Extend the file in every later stage.

**Outcome:** all five CRUD endpoints reachable; round-trip (create → read → update → delete) works via REST Client.

### Status
- [x] Completed
- Notes: All 5 endpoints (POST, GET list, GET by ID, PUT, DELETE) working. 13 integration tests passing. Round-trip cycle verified. `demo/sample-requests.http` bootstrapped with Stage 2 happy-path + 404 + placeholders for Stages 3–9.

---

## ✅ Stage 3 — Task 1: Validation

- `src/utils/errors.js` — `ValidationError` with `details[]`, `NotFoundError`
- `src/validators/ticketValidator.js`:
  - `customer_email` — RFC 5321-ish regex
  - `subject` (1–200), `description` (10–2000)
  - `category` enum (6 values), `priority` enum (4), `status` enum (5)
  - `metadata.source` enum, `metadata.device_type` enum
- `src/middleware/errorHandler.js` — collects **all** errors in `details[]` (no fail-fast); maps `NotFoundError` → 404
- Wire into `POST /tickets` and `PUT /tickets/:id`
- **Extend `demo/sample-requests.http`** with negative cases: empty body, multi-error 400, bad email, oversized subject/description, invalid enums

**Outcome:** invalid requests return 400 with every error in a single `details[]` array.

### Status
- [x] Completed
- Notes: ValidationError and NotFoundError custom exceptions. Full ticket validation with all enum checks (categories, priorities, statuses, metadata). Partial update validation for PUT requests allowing no-op updates. 25 unit + integration validation tests passing.

---

## 📥 Stage 4 — Task 1: CSV Bulk Import

- `POST /tickets/import` accepts `multipart/form-data` (`multer` memory storage)
- `src/parsers/csvParser.js` using `csv-parse/sync`
- Per-row validation reuses Stage-3 validators
- Response shape:
  ```json
  { "total": 50, "successful": 47, "failed": [{ "row": 12, "errors": [...] }] }
  ```
- Malformed file → 400 with meaningful message (not 500)
- **Extend `demo/sample-requests.http`** with CSV `multipart/form-data` POST referencing `< ../tests/fixtures/sample_tickets.csv` + a malformed-file negative case

**Outcome:** CSV upload works; partial-success summary returned.

### Status
- [x] Completed
- Notes: `csvParser.js` (RFC 4180-ish, splits `tags` on `;`, nests `metadata.*`), `importService.js` (per-row validate + create, 1-based row numbers in `failed[]`), `POST /tickets/import` with multer memory storage and 5 MB cap. Format dispatch by extension/MIME ready for Stages 5–6 (JSON/XML return 400 "not implemented yet"). Malformed CSV → 400 (not 500), missing file → 400, unsupported extension → 400. 12 new tests (6 parser unit + 6 import integration); 94 total green. `demo/import-sample.csv` (5 rows, mixed valid+invalid) added so the `.http` block runs immediately.

---

## 📥 Stage 5 — Task 1: JSON Bulk Import

- Same endpoint detects format by `Content-Type` or filename extension
- `src/parsers/jsonParser.js` — accepts both `[{...}]` and `{ "tickets": [...] }`
- Reuses validation + summary shape from Stage 4
- **Extend `demo/sample-requests.http`** with JSON import block + mixed-valid/invalid file scenario

**Outcome:** JSON upload works; mixed valid/invalid file returns correct summary.

### Status
- [x] Completed
- Notes: `jsonParser.js` accepts both `[{...}]` and `{ "tickets": [...] }` shapes, throws on malformed JSON or unsupported shape (caller maps to 400). Endpoint reuses Stage-4 `importService` + summary shape. 11 new tests (5 parser unit + 6 import integration); 104 total green. `demo/import-sample.json` (4 tickets, 1 invalid) added so the `.http` block runs immediately. XML branch still returns 400 "XML import is not implemented yet" — wired for Stage 6.

---

## 📥 Stage 6 — Task 1: XML Bulk Import

- `src/parsers/xmlParser.js` using `fast-xml-parser`
- Expected root: `<tickets><ticket>...</ticket></tickets>`
- Field mapping (snake_case in XML → ticket model)
- **Extend `demo/sample-requests.http`** with XML import block + malformed-XML negative case

**Outcome:** XML upload works; malformed XML → 400 (not 500).

### Status
- [x] Completed
- Notes: `xmlParser.js` using `fast-xml-parser` v5 with `XMLValidator` for strict pre-parse validation. Forces `<ticket>` and `<tag>` into arrays via `isArray` callback (so single-ticket files still come back as a list). Maps `<tags><tag/></tags>` → string array, `<metadata>...</metadata>` → object. Endpoint reuses Stage-4 `importService` and the same partial-success summary. Empty `<tickets/>` returns 200 with total: 0. 12 new tests (7 parser unit + 5 import integration); 116 total green. `demo/import-sample.xml` (4 tickets, 1 invalid) added so the `.http` block runs immediately.

---

## 🔍 Stage 7 — Task 1: Filtering on `GET /tickets`

Query params (all optional, AND-combined):
- `?category=technical_issue`
- `?priority=high`
- `?status=new`
- `?customer_id=...`
- `?from=2026-01-01&to=2026-12-31` (filters by `created_at`, ISO 8601 or date-only)
- `?assigned_to=...`

Validate query params (invalid enum/date → 400).

- **Extend `demo/sample-requests.http`** with single-filter, combined-filter, and date-range scenarios + a 400 case for an invalid enum value

**Outcome:** filtering works individually and in any combination.

### Status
- [x] Completed
- Notes: `queryValidator.js` validates enums (category/priority/status) + dates (date-only YYYY-MM-DD or full ISO 8601) and returns sanitized criteria; collects all errors before throwing. `ticketStore.filter` extended with `from`/`to` range against `created_at`. Date-only inputs normalize to bound: `from` → start of day UTC, `to` → end of day UTC. `from > to` → 400. Unknown query params silently ignored. 21 new tests (9 query-validator unit + 12 filter integration); 137 total green.

---

## 🤖 Stage 8 — Task 2: Auto-Classification Engine

- `src/classifier/keywords.js` — keyword maps for 6 categories + 4 priorities (per spec)
- `src/classifier/classify.js`:
  - Tokenize subject + description
  - Match against category/priority keyword maps
  - `confidence = matchedKeywords / totalUniqueTokens` (capped 0–1)
  - Returns `{ category, priority, confidence, reasoning, keywords }`
- Decision log (in-memory ring buffer, last 1000 entries) — exposed via `GET /classifier/log` for grading visibility

**Outcome:** classifier produces deterministic, explainable output.

### Status
- [x] Completed
- Notes: `keywords.js` with category + priority maps (priority words verbatim from spec). `classify.js` is a pure function: tokenizes (lowercase, alnum, ≥2 chars), matches phrases as substrings and single words against the token set, picks the highest-scoring label with stable tie-breaking, falls back to `other`/`medium`. `confidence = matchedKeywords / uniqueTokens` (capped at 1, rounded to 3 decimals). `reasoning` is human-readable and lists matched keywords. `decisionLog.js` is a 1000-entry ring buffer; `GET /classifier/log` exposes it for graders. 20 new tests (13 classify unit + 5 decisionLog unit + 2 classifier integration); 157 total green.

---

## 🤖 Stage 9 — Task 2: Classification Endpoint + Auto-Run Hook

- `POST /tickets/:id/auto-classify` → updates ticket + returns classification result
- `POST /tickets?autoClassify=true` triggers classification on creation
- Manual override via `PUT /tickets/:id` is preserved (does not re-classify unless asked)
- **Extend `demo/sample-requests.http`** with: auto-classify-on-create, explicit `POST /:id/auto-classify`, manual-override flow, and `GET /classifier/log`

**Outcome:** auto-classify endpoint works; opt-in flag on create works; manual override respected.

### Status
- [ ] Completed
- Notes:

---

## 📦 Stage 10 — Task 5 (data) / Sample Fixtures

- `tests/fixtures/sample_tickets.csv` — 50 rows
- `tests/fixtures/sample_tickets.json` — 20 tickets
- `tests/fixtures/sample_tickets.xml` — 30 tickets
- `tests/fixtures/invalid_*.{csv,json,xml}` — malformed payloads for negative tests
- `demo/import-all.sh` — script that POSTs all three valid files in sequence

**Outcome:** reviewers can reproduce import scenarios in one command.

### Status
- [ ] Completed
- Notes:

---

## 🧪 Stage 11 — Task 3: Unit Tests

| File | Count | Scope |
|---|---|---|
| `tests/unit/test_ticket_model.spec.js` | 9 | model defaults, timestamps, immutability of `id` |
| `tests/unit/test_import_csv.spec.js` | 6 | CSV happy path + malformed |
| `tests/unit/test_import_json.spec.js` | 5 | JSON shapes + invalid |
| `tests/unit/test_import_xml.spec.js` | 5 | XML happy path + malformed |
| `tests/unit/test_categorization.spec.js` | 10 | classifier per category + priority |

**Outcome:** unit suite green; ~35 tests passing.

### Status
- [ ] Completed
- Notes:

---

## 🧪 Stage 12 — Task 3: API Tests

- `tests/integration/test_ticket_api.spec.js` (Supertest) — 11 tests
  - 201 create (valid), 400 create (invalid)
  - 200 list, 200 list with filter, 400 list with bad filter
  - 200 by id, 404 by id
  - 200 update, 404 update
  - 204 delete, 404 delete

**Outcome:** API contract is locked in by tests.

### Status
- [ ] Completed
- Notes:

---

## 🧪 Stage 13 — Task 5: Integration + Performance

- `tests/integration/test_integration.spec.js` — 5 tests
  - Full ticket lifecycle (create → classify → update → resolve → delete)
  - Bulk import (CSV) + autoclassify verification
  - Combined filtering by category AND priority
  - Manual override after auto-classify
  - Mixed-format batch (CSV + JSON + XML in sequence)
- `tests/performance/test_performance.spec.js` — 5 tests
  - 20+ concurrent `POST /tickets` (Promise.all)
  - Bulk import 50 rows < 1s
  - Single-ticket classify < 50ms
  - Filtered list over 1000 tickets < 100ms
  - Mixed read/write load (10 readers + 5 writers)

**Outcome:** non-functional behaviour is exercised; benchmarks recorded for `TESTING_GUIDE.md`.

### Status
- [ ] Completed
- Notes:

---

## 📊 Stage 14 — Coverage > 85%

- `npm run test:coverage` (Vitest + `@vitest/coverage-v8`)
- Threshold enforced in `vitest.config.js`: `lines/functions/branches/statements >= 85`
- Save HTML report; capture screenshot to `docs/screenshots/test_coverage.png`

**Outcome:** coverage report ≥ 85% with screenshot embedded in PR.

### Status
- [ ] Completed
- Notes:

---

## 📚 Stage 15 — Task 4: Multi-Level Documentation

Use **different AI models** for different doc types (record which model in each doc footer):

| Doc | Audience | Model used | Key contents |
|---|---|---|---|
| `README.md` | Developers | Claude Opus 4.7 | overview, features, architecture diagram (Mermaid), install/run/test, project structure |
| `API_REFERENCE.md` | API consumers | GPT-5 / GPT-4o | every endpoint, request/response examples, error formats, cURL examples |
| `ARCHITECTURE.md` | Tech leads | Gemini 2.5 Pro | high-level diagram (Mermaid), components, sequence diagrams, design tradeoffs, security/perf notes |
| `TESTING_GUIDE.md` | QA | Claude Sonnet 4.6 / GPT-4o | test pyramid (Mermaid), how to run, fixtures map, manual checklist, perf benchmarks table |

- ≥ 3 Mermaid diagrams across docs (architecture, sequence, test pyramid)
- Each doc ends with a footer line: *Generated with assistance from: <model> — reviewed/edited by Anastasia Kopiika.*

**Outcome:** all 4 docs review-ready; model attribution visible.

### Status
- [ ] Completed
- Notes:

---

## 📸 Stage 16 — Demo polish + HOWTORUN.md + Screenshots

- **Polish `demo/sample-requests.http`**: every endpoint covered, sections labelled by stage, chained variables work end-to-end on a clean server
- `HOWTORUN.md` — prerequisites, install, start, seed (`demo/import-all.sh`), running tests + coverage, troubleshooting; explicitly mention REST Client extension + the `.http` file as the primary verification path
- Screenshots in `docs/screenshots/`:
  1. AI prompt: asking model to draft this plan
  2. AI response: structured plan
  3. Server running + health check
  4. `POST /tickets` 201
  5. `POST /tickets/import` (CSV) — bulk summary
  6. `POST /tickets/:id/auto-classify` — classification result
  7. Validation 400 with `details[]`
  8. Test run output (all green)
  9. **`test_coverage.png`** — coverage ≥ 85%
- Embed the most important 3–4 directly into PR body (per instructor feedback on HW1)

**Outcome:** PR carries visual evidence inline.

### Status
- [ ] Completed
- Notes:

---

## ✅ Stage 17 — Final Verification + PR

- Branch: `homework-2-submission`
- Sanity sweep on a clean server: import CSV → list with filters → auto-classify → update → delete → 404 → bulk-import invalid file → 400
- Confirm `.gitignore` excludes `node_modules/` and `coverage/`
- Open PR into **own fork's `main`** (not upstream)
- PR body:
  - `## Summary` (what was built)
  - `## How to verify` (commands + sample requests)
  - `## AI tools used` (which model for which doc/code, sample prompts)
  - `## Challenges` (what was non-obvious)
  - **Embedded screenshots** (3–4 inline images)
  - `### Status` checklist of all 17 stages
- Reviewer: **Alexey-Popov**; labels: `homework-2`, `ready-for-review`

**Outcome:** PR submitted, ready for grading.

### Status
- [ ] Completed
- Notes:
