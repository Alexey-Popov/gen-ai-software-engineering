# 📘 API Reference — Intelligent Customer Support Ticket System

**Base URL:** `http://localhost:3000` (default; override `PORT` env var)
**Content-Type:** `application/json` (except `/tickets/import`, which is `multipart/form-data`)

---

## Endpoint summary

| # | Method | Path | Purpose |
|---|---|---|---|
| 1 | `GET` | `/` | Health check |
| 2 | `POST` | `/tickets` | Create a ticket (`?autoClassify=true` runs classifier) |
| 3 | `GET` | `/tickets` | List, with optional filters |
| 4 | `GET` | `/tickets/:id` | Get a ticket by id |
| 5 | `PUT` | `/tickets/:id` | Partial update |
| 6 | `DELETE` | `/tickets/:id` | Delete |
| 7 | `POST` | `/tickets/import` | Bulk import (CSV / JSON / XML) |
| 8 | `POST` | `/tickets/:id/auto-classify` | Run classifier on an existing ticket |
| 9 | `GET` | `/classifier/log` | View classifier decision log |

---

## 📦 Data Model

```jsonc
{
  "id": "uuid v4",                           // server-generated, immutable
  "customer_id": "string",                   // optional
  "customer_email": "email",                 // required
  "customer_name": "string (1–100)",         // optional
  "subject": "string (1–200)",               // required
  "description": "string (10–2000)",         // required
  "category": "account_access | technical_issue | billing_question | feature_request | bug_report | other",
  "priority": "urgent | high | medium | low",
  "status": "new | in_progress | waiting_customer | resolved | closed",
  "created_at": "ISO 8601",                  // server-generated, immutable
  "updated_at": "ISO 8601",                  // bumped on every update
  "resolved_at": "ISO 8601 | absent",        // set when status flips to "resolved"
  "assigned_to": "string",                   // optional
  "tags": ["string", ...],                   // optional
  "metadata": {
    "source": "web_form | email | api | chat | phone",
    "browser": "string",
    "device_type": "desktop | mobile | tablet"
  },
  "classification": {                        // present only after auto-classify
    "confidence": 0.0,                       // 0..1
    "reasoning": "string",
    "keywords": ["string", ...],
    "classified_at": "ISO 8601"
  }
}
```

### Error response (uniform across all endpoints)

```json
{
  "error": "Validation failed",
  "details": [
    "customer_email must be a valid email address",
    "description must be 10-2000 characters"
  ]
}
```

| Status | When |
|---|---|
| `400` | validation failed; `details[]` lists every error (no fail-fast) |
| `404` | resource not found |
| `500` | unhandled server error |

---

## 1. `GET /` — Health Check

**Response 200**
```json
{ "status": "ok", "message": "Intelligent Customer Support Ticket System" }
```

**cURL**
```bash
curl http://localhost:3000/
```

---

## 2. `POST /tickets` — Create

**Query params**
| Name | Type | Notes |
|---|---|---|
| `autoClassify` | `"true"` literal | If exactly `"true"`, runs the classifier and persists `category` + `priority` + `classification` block. Anything else is a no-op. |

**Request body** — all fields except `customer_email`, `subject`, `description` are optional.

**Response 201** — full ticket with server-generated `id`, `created_at`, `updated_at`, `status: "new"` (unless overridden).

**Response 400** — validation failed (invalid email / wrong enum / oversized field).

**cURL — minimal**
```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "alice@example.com",
    "subject": "Cannot log in",
    "description": "Login fails after I reset the password yesterday"
  }'
```

**cURL — with auto-classify**
```bash
curl -X POST 'http://localhost:3000/tickets?autoClassify=true' \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "bob@example.com",
    "subject": "Production down",
    "description": "We cannot access the dashboard. asap fix needed"
  }'
```

The `?autoClassify=true` response is the full ticket (201) with `category`, `priority`, and `classification` embedded. Partial excerpt:
```jsonc
{
  // ... all standard ticket fields (id, customer_email, subject, etc.) ...
  "category": "account_access",
  "priority": "urgent",
  "classification": {
    // stored on the ticket — does NOT include category/priority (they live at the ticket root)
    "confidence": 0.188,
    "reasoning": "category=account_access (matched: cannot access); priority=urgent (matched: cannot access, production down, asap)",
    "keywords": ["cannot access", "production down", "asap"],
    "classified_at": "2026-05-05T07:37:33.265Z"
  }
}
```

---

## 3. `GET /tickets` — List with Filters

**Query params** (all optional, AND-combined; unknown params are silently ignored)

| Param | Type | Example |
|---|---|---|
| `category` | enum | `account_access` |
| `priority` | enum | `urgent` |
| `status` | enum | `in_progress` |
| `customer_id` | string | `CUST-001` |
| `assigned_to` | string | `agent-42` |
| `from` | date-only or ISO 8601 | `2026-01-01` or `2026-01-01T10:00:00Z` |
| `to` | date-only or ISO 8601 | `2026-12-31` |

**Date semantics:** date-only values normalize to UTC bounds — `from` → start of day, `to` → end of day.

**Response 200** — array of tickets (possibly empty).

**Response 400** — invalid enum, malformed date, `from > to` (`"from must be earlier than or equal to to"`), or empty string for `customer_id`/`assigned_to`.

**cURL examples**
```bash
# all tickets
curl 'http://localhost:3000/tickets'

# combined filter
curl 'http://localhost:3000/tickets?category=technical_issue&priority=high'

# date range
curl 'http://localhost:3000/tickets?from=2026-01-01&to=2026-12-31'

# bad filter → 400
curl 'http://localhost:3000/tickets?category=not_a_real_category'
```

---

## 4. `GET /tickets/:id` — Get by ID

**Response 200** — the ticket.
**Response 404** — `{ "error": "Ticket not found" }`.

```bash
curl http://localhost:3000/tickets/3bb273fe-34dd-4fcc-9efa-cbca85f024e6
```

---

## 5. `PUT /tickets/:id` — Partial Update

**Request body** — any subset of writable fields. Unspecified fields are left untouched. Empty body (`{}`) is valid — only `updated_at` is bumped, all other fields remain unchanged.

**Side effects:**
- `updated_at` is bumped on every successful update
- `resolved_at` is stamped when `status` flips to `"resolved"` — transitioning to `"closed"` does **not** set `resolved_at`
- `id` and `created_at` are immutable — caller-supplied values are ignored

**Response 200** — full updated ticket.
**Response 400** — partial validation failed (e.g. unknown enum).
**Response 404** — id not found.

```bash
# resolve a ticket
curl -X PUT http://localhost:3000/tickets/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'

# manual override of category — preserved (no implicit re-classify)
curl -X PUT http://localhost:3000/tickets/<id> \
  -H "Content-Type: application/json" \
  -d '{"category": "feature_request", "priority": "low"}'
```

---

## 6. `DELETE /tickets/:id`

**Response 204** — empty body.
**Response 404** — id not found.

```bash
curl -X DELETE http://localhost:3000/tickets/<id>
```

---

## 7. `POST /tickets/import` — Bulk Import

**Content-Type:** `multipart/form-data`
**Form field:** `file` (single)
**Max file size:** 5 MB

Format is detected by extension or MIME (`csv` / `json` / `xml`).

### Supported file shapes

| Format | Shape |
|---|---|
| **CSV** | First row = headers. Top-level columns plus `tags` (split on `;`) and `metadata.source` / `metadata.browser` / `metadata.device_type` (nested into `metadata`). |
| **JSON** | Either a top-level array `[{...}]` or a wrapper `{ "tickets": [...] }`. |
| **XML** | `<tickets><ticket>…</ticket>…</tickets>`; `<tags><tag/></tags>` → array; `<metadata>…</metadata>` → object. |

### Response shape (200)

```json
{
  "total": 50,
  "successful": 47,
  "failed": [
    { "row": 12, "errors": ["customer_email must be a valid email address"] },
    { "row": 31, "errors": ["description must be 10-2000 characters"] }
  ]
}
```

`row` is **1-based** and refers to the data-row index (so row 1 is the first record after the CSV header / the first JSON array element / the first `<ticket>` child).

### 400 cases

| Trigger | `details[0]` |
|---|---|
| no file attached | `"file is required (multipart/form-data field \"file\")"` |
| unsupported extension/MIME | `"Unsupported file format; expected .csv, .json, or .xml"` |
| malformed CSV | `"Malformed CSV: ..."` |
| malformed JSON | `"Malformed JSON: ..."` |
| unsupported JSON shape | `"Unsupported JSON shape: expected an array of tickets or { \"tickets\": [...] }"` |
| malformed XML | `"Malformed XML: ..."` |
| unsupported XML root | `"Unsupported XML shape: expected <tickets><ticket>...</ticket></tickets>"` |

### cURL

```bash
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@tests/fixtures/sample_tickets.csv"

curl -X POST http://localhost:3000/tickets/import \
  -F "file=@tests/fixtures/sample_tickets.json"

curl -X POST http://localhost:3000/tickets/import \
  -F "file=@tests/fixtures/sample_tickets.xml"
```

Or run all three at once: `./demo/import-all.sh`.

---

## 8. `POST /tickets/:id/auto-classify`

**Request body:** none.

Runs `classify(ticket)` on `subject + description`, persists `category` + `priority` + `classification` block on the ticket, and appends an entry to the decision log with `trigger: "manual"`.

### Response 200

```jsonc
{
  "ticket": { /* full updated ticket, including category/priority/classification at the ticket root */ },
  // raw classifier result — note: no classified_at here; that lives inside ticket.classification
  "classification": {
    "category": "account_access",
    "priority": "urgent",
    "confidence": 0.188,
    "reasoning": "category=account_access (matched: cannot access); priority=urgent (matched: cannot access, critical, production down)",
    "keywords": ["cannot access", "critical", "production down"]
  }
}
```

> **Note on shapes:** the `classification` key in this response is the raw classifier output (`category`, `priority`, `confidence`, `reasoning`, `keywords`). The `classification` sub-object stored on the ticket itself (`ticket.classification`) contains `confidence`, `reasoning`, `keywords`, and `classified_at` — `category` and `priority` are promoted to the ticket's top level.

### 404 — id not found

```bash
curl -X POST http://localhost:3000/tickets/<id>/auto-classify
```

---

## 9. `GET /classifier/log`

Returns up to the last 1000 classifier decisions (oldest first).

**Response 200**

```json
[
  {
    "at": "2026-05-05T07:37:33.265Z",
    "ticket_id": "3bb273fe-34dd-4fcc-9efa-cbca85f024e6",
    "subject": "Production down — critical",
    "trigger": "auto-on-create",
    "result": {
      "category": "account_access",
      "priority": "urgent",
      "confidence": 0.188,
      "reasoning": "...",
      "keywords": ["cannot access", "production down", "asap"]
    }
  }
]
```

| `trigger` value | Set by |
|---|---|
| `auto-on-create` | `POST /tickets?autoClassify=true` |
| `manual` | `POST /tickets/:id/auto-classify` |

```bash
curl http://localhost:3000/classifier/log
```

---

## Status code cheat sheet

| Code | Meaning |
|---|---|
| `200` | OK (GET, PUT, POST classify, POST import) |
| `201` | Created (POST /tickets) |
| `204` | No Content (DELETE) |
| `400` | Validation failed — `details[]` lists every error |
| `404` | Resource not found |
| `500` | Unhandled server error |

---

<div align="center">

— *Drafted by Claude Opus 4.7 (claude-opus-4-7), reviewed for factual accuracy and clarity by GitHub Copilot (Claude Sonnet 4.6), edited by Anastasia Kopiika.*

</div>
