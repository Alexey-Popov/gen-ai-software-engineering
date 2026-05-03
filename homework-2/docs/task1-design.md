# Task 1 Design Note — Multi-Format Ticket Import API

This document is the locked contract for Phase 1 (Task 1) of homework-2. It is the source of truth for the test-engineer (writing failing tests first) and the developer (implementing against those tests). All decisions here conform to `homework-2/docs/architecture-skeleton.md`. Anything genuinely ambiguous in `TASKS.md` is flagged with a `TODO` rather than guessed.

Out of scope: classification logic, the `POST /tickets/{id}/auto-classify` endpoint, classification log, the `auto_classify` flag on create. Those belong to Task 2.

Mount points (from `main.py`, set in Task 0):
- `tickets_router` is mounted with prefix `/tickets` and exposes `POST ""`, `GET ""`, `GET "/{ticket_id}"`, `PUT "/{ticket_id}"`, `DELETE "/{ticket_id}"`.
- `imports_router` is mounted with prefix `/tickets` and exposes `POST "/import"`.

Both routers share the same URL prefix; route order in `main.py` does not matter because paths are distinct.

---

## 1. Route Contracts

### 1.1 Summary table

| # | Method | Path | Request body | Query / path params | Success | Error codes |
|---|--------|------|--------------|---------------------|---------|-------------|
| 1 | POST   | `/tickets`               | `TicketCreate` JSON | — | `201` + `Ticket` JSON | `400` |
| 2 | GET    | `/tickets`               | — | `category?`, `priority?`, `status?` (query) | `200` + `Ticket[]` JSON | `400` (bad enum value) |
| 3 | GET    | `/tickets/{ticket_id}`   | — | `ticket_id` path (UUID) | `200` + `Ticket` JSON | `400` (bad UUID), `404` |
| 4 | PUT    | `/tickets/{ticket_id}`   | `TicketUpdate` JSON | `ticket_id` path (UUID) | `200` + updated `Ticket` JSON | `400`, `404` |
| 5 | DELETE | `/tickets/{ticket_id}`   | — | `ticket_id` path (UUID) | `204` (no body) | `400` (bad UUID), `404` |
| 6 | POST   | `/tickets/import`        | `multipart/form-data`, field `file` (`UploadFile`) | `format?` query (`csv|json|xml`) | `200` + `ImportSummary` JSON | `400` |

All `400` responses use the standard envelope:

```json
{ "error": "<short message>", "details": [{"field": "<field name>", "message": "<text>"}] }
```

`404` responses follow the same shape, e.g.:

```json
{ "error": "Ticket not found", "details": [{"field": "ticket_id", "message": "no ticket with id <uuid>"}] }
```

FastAPI's stock 422 from a malformed JSON body or unparsable path UUID is converted to `400` with the same envelope by the central `RequestValidationError` handler in `main.py`. Routers do not catch validation errors themselves.

### 1.2 POST `/tickets` — create

Request body: `TicketCreate` (Pydantic model defined in `domain/models.py`). `extra="forbid"` is set, so unknown keys cause a `400`. Required fields: `customer_id`, `customer_email`, `customer_name`, `subject`, `description`. Optional: `category`, `priority`, `status` (defaults to `new`), `assigned_to`, `tags` (defaults to `[]`), `metadata`.

Server-side population:
- `id` = freshly generated `UUID4`.
- `created_at` = current UTC datetime (ISO 8601 on the wire).
- `updated_at` = same value as `created_at` on creation.
- `resolved_at` = `null` unless the client supplied `status="resolved"`, in which case set `resolved_at` to the same value as `created_at`.

Response: `201 Created`, body is the full `Ticket` JSON.

Errors:
- `400` for any model-validation failure (missing required, bad enum, bad email, bad lengths, unknown field).

### 1.3 GET `/tickets` — list with filters

Query parameters (all optional, all single-valued):
- `category` — must be a valid `Category` enum value.
- `priority` — must be a valid `Priority` enum value.
- `status` — must be a valid `Status` enum value.

Filters compose with AND semantics. Empty result set returns `200` with `[]`, never `404`.

Response: `200 OK`, body is a JSON array of `Ticket` objects in insertion order.

Errors:
- `400` if a query value is not in the allowed enum set.

No pagination, no sorting. Out of scope for Task 1.

### 1.4 GET `/tickets/{ticket_id}` — fetch by ID

Path parameter: `ticket_id` typed as `UUID`.

Response: `200 OK` with the `Ticket` JSON body.

Errors:
- `400` if `ticket_id` is not a valid UUID.
- `404` if no ticket with that id exists.

### 1.5 PUT `/tickets/{ticket_id}` — partial update

Request body: `TicketUpdate`. Every field is optional. `extra="forbid"` set.

Semantics:
- Use `payload.model_dump(exclude_unset=True)` — only keys present in the body are applied.
- An explicit `null` clears the field; an absent key retains its current value.
- `updated_at` is always refreshed to `utcnow()`.
- Status transition side effects (see section 5.2).

Response: `200 OK`, full updated `Ticket` JSON.

Errors: `400` for validation failures, `404` if ticket not found.

### 1.6 DELETE `/tickets/{ticket_id}` — delete

Response: `204 No Content` on success.

Errors:
- `400` if the path UUID is malformed.
- `404` if the ticket does not exist.

A second DELETE on the same id returns `404`, not `204`.

---

## 2. Import Endpoint Contract — POST `/tickets/import`

### 2.1 Wire format

- `Content-Type: multipart/form-data`.
- Exactly one file field named `file` (`UploadFile`).
- Optional query parameter `format`: `csv`, `json`, or `xml` (case-insensitive; normalised to lowercase).

### 2.2 Format detection (priority order)

1. Explicit `format` query param (`csv|json|xml`). Anything else → `400`, `field: "format"`.
2. `UploadFile.content_type` MIME mapping:
   - `text/csv`, `application/csv` → `csv`
   - `application/json`, `text/json` → `json`
   - `application/xml`, `text/xml` → `xml`
3. Filename suffix (case-insensitive): `.csv`, `.json`, `.xml`.

All three layers fail → `400`, `field: "format"`, `message: "unable to detect file format; pass ?format=csv|json|xml or send a recognised content-type"`.

Explicit `format` param always wins over MIME/suffix.

### 2.3 Pipeline

```
UploadFile bytes
   -> parse_<format>(bytes) -> (list[TicketCreate], list[ImportError])
   -> for each TicketCreate: store.insert(Ticket(**create.model_dump()))
   -> assemble ImportSummary
```

Parsers in `src/app/services/importers/{csv,json,xml}.py` are pure functions (no FastAPI imports). The router is a thin adapter.

### 2.4 Response

Status: `200 OK`.

```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "errors": [
    {"row": 2, "field": "customer_email", "message": "value is not a valid email address"}
  ]
}
```

Row indexing: 1-based, data rows only (CSV header is row 0 and never reported).

The summary does **not** include IDs of created tickets.

### 2.5 Edge cases

| Situation | HTTP | `field` |
|-----------|------|---------|
| No `file` field | 400 | `file` |
| Empty file (0 bytes) | 400 | `file` |
| Unrecognised format | 400 | `format` |
| Container-level malformed file | 400 | `file` |
| Some rows valid, some invalid | 200 | n/a — per-row in `ImportSummary.errors` |
| All rows invalid | 200 | n/a — `successful = 0` |
| File too large | **no limit** | n/a — explicitly unbounded per spec |

TODO: TASKS.md is ambiguous on whether container-level malformation is 400 or 200-with-errors. We choose 400 for container-level, 200-with-errors for row-level.

---

## 3. XML Schema

### 3.1 Element rules

- Root element: `<tickets>`.
- Child element per ticket: `<ticket>`.
- Each scalar field is a child element with tag name matching the JSON key (snake_case).
- `tags`: `<tags>` wrapper containing zero or more `<tag>` elements.
- `metadata`: `<metadata>` wrapper containing optional `<source>`, `<browser>`, `<device_type>`.
- All values are element text content (no XML attributes).
- Optional fields may be omitted entirely; empty text = omission.
- Whitespace surrounding element text is stripped.
- Parsed with `defusedxml.ElementTree` — never `xml.etree.ElementTree`.

### 3.2 Example fixture

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
    <category>account_access</category>
    <priority>high</priority>
    <status>new</status>
    <assigned_to></assigned_to>
    <tags>
      <tag>login</tag>
      <tag>urgent</tag>
    </tags>
    <metadata>
      <source>web_form</source>
      <browser>Chrome</browser>
      <device_type>desktop</device_type>
    </metadata>
  </ticket>
  <ticket>
    <customer_id>cust-002</customer_id>
    <customer_email>bob@example.com</customer_email>
    <customer_name>Bob Example</customer_name>
    <subject>Invoice question</subject>
    <description>I have a question about invoice number 12345.</description>
  </ticket>
</tickets>
```

Row 1 = first `<ticket>`, row 2 = second `<ticket>`, etc.

---

## 4. CSV Format

### 4.1 Conventions

- UTF-8 encoded, RFC 4180 quoting.
- Header row is **required**; column names must exactly match JSON model keys (snake_case).
- Required headers: `customer_id`, `customer_email`, `customer_name`, `subject`, `description`.
- Optional headers (any subset): `category`, `priority`, `status`, `assigned_to`, `tags`, `metadata_source`, `metadata_browser`, `metadata_device_type`.
- Unknown headers → `400`, `field: "file"`, `message: "unknown column: <name>"`.
- Blank cell = field omitted.
- `tags`: semicolon-separated in one column (`tag1;tag2;tag3`). Empty string → `[]`. Empty segments stripped.
- `metadata` flattened to `metadata_source`, `metadata_browser`, `metadata_device_type`. If at least one is non-blank → `TicketMetadata` object; otherwise `metadata = None`.
- Row 1 = first data row (the row after the header).

### 4.2 Example fixture

```
customer_id,customer_email,customer_name,subject,description,category,priority,status,assigned_to,tags,metadata_source,metadata_browser,metadata_device_type
cust-001,alice@example.com,Alice Example,Cannot log in,I cannot log into my account since this morning.,account_access,high,new,,login;urgent,web_form,Chrome,desktop
cust-002,bob@example.com,Bob Example,Invoice question,I have a question about invoice number 12345.,billing_question,medium,new,agent-7,billing,email,,
```

---

## 5. PUT Semantics

### 5.1 Field application rule

- Use `payload.model_dump(exclude_unset=True)` — only keys present in the request JSON are applied.
- Explicit `null` → field set to `None` (clears `assigned_to`, `category`, `priority`, etc.).
- Absent key → field retains its current value.

### 5.2 Status transition side effects

| Previous `status` | New `status` (in body) | Side effect |
|-------------------|-----------------------|-------------|
| not `resolved` | `resolved` | `resolved_at = utcnow()` |
| `resolved` | not `resolved` | `resolved_at = None` |
| `resolved` | `resolved` (unchanged) | `resolved_at` unchanged |
| any | absent from body | `resolved_at` unchanged |

`updated_at` always refreshes to `utcnow()` on any successful PUT, even an empty `{}` body.

### 5.3 Immutable fields

`id`, `customer_id`, `customer_email`, `customer_name`, `created_at` are absent from `TicketUpdate` and rejected via `extra="forbid"`.

---

## 6. JSON Import Format

Top-level value MUST be a JSON array. Each element is a `TicketCreate` object.

Anything other than a top-level array → `400`, `field: "file"`, `message: "malformed json file"`.

Non-object array elements → per-row `ImportError`, `field: "row"`.

Row 1 = first array element.

### 6.1 Example fixture

```json
[
  {
    "customer_id": "cust-001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since this morning.",
    "category": "account_access",
    "priority": "high",
    "tags": ["login", "urgent"],
    "metadata": {
      "source": "web_form",
      "browser": "Chrome",
      "device_type": "desktop"
    }
  },
  {
    "customer_id": "cust-002",
    "customer_email": "bob@example.com",
    "customer_name": "Bob Example",
    "subject": "Invoice question",
    "description": "I have a question about invoice number 12345."
  }
]
```

---

## 7. Validation Error Catalogue

| # | Situation | Endpoint(s) | `details[].field` | HTTP |
|---|-----------|-------------|-------------------|------|
| 1 | Missing required field on POST | POST `/tickets` | field name | 400 |
| 2 | Invalid `category` value | POST, PUT, GET (query) | `category` | 400 |
| 3 | Invalid `priority` value | POST, PUT, GET (query) | `priority` | 400 |
| 4 | Invalid `status` value | POST, PUT, GET (query) | `status` | 400 |
| 5 | Invalid `metadata.source` | POST, PUT | `metadata.source` | 400 |
| 6 | Invalid `metadata.device_type` | POST, PUT | `metadata.device_type` | 400 |
| 7 | `customer_email` not a valid email | POST | `customer_email` | 400 |
| 8 | `subject` < 1 or > 200 chars | POST, PUT | `subject` | 400 |
| 9 | `description` < 10 or > 2000 chars | POST, PUT | `description` | 400 |
| 10 | Unknown extra field in body | POST, PUT | the unknown field name | 400 |
| 11 | `tags` not a list | POST, PUT | `tags` | 400 |
| 12 | `metadata` not an object | POST, PUT | `metadata` | 400 |
| 13 | `ticket_id` path not a UUID | GET, PUT, DELETE | `ticket_id` | 400 |
| 14 | `ticket_id` valid UUID but not found | GET, PUT, DELETE | `ticket_id` | 404 |
| 15 | Import: missing `file` field | POST `/tickets/import` | `file` | 400 |
| 16 | Import: empty file | POST `/tickets/import` | `file` | 400 |
| 17 | Import: cannot detect format | POST `/tickets/import` | `format` | 400 |
| 18 | Import: container-level malformed file | POST `/tickets/import` | `file` | 400 |

---

## 8. Five-Bullet Summary

- All five CRUD routes plus `POST /tickets/import` are fully specified with exact request shapes, success codes (201 create, 200 list/get/put/import, 204 delete), and the shared error envelope.
- `POST /tickets/import` accepts `multipart/form-data` with a `file` field; format detected via priority order (explicit `?format=` → MIME → suffix); response is `ImportSummary` with counts and per-row errors only — no created IDs echoed back.
- XML, CSV, and JSON wire schemas are pinned: XML uses `<tickets><ticket>` with snake_case child elements and `<tags><tag>` / `<metadata>` wrappers; CSV uses a required header row with flat `metadata_*` columns and semicolon-separated `tags`; JSON is a top-level array of `TicketCreate` objects.
- PUT uses partial-merge with `exclude_unset=True`: omitted keys retain previous values, explicit `null` clears the field, `updated_at` always refreshes, transitioning into `resolved` sets `resolved_at`, transitioning out clears it.
- The validation error catalogue (section 7) lists 18 conditions the test-engineer must cover; container-level malformed imports are 400, row-level failures are 200 with `ImportError` entries in `ImportSummary`.

---

## TODOs flagged for later phases

1. (§2.5) Confirm container-level malformation = 400 vs 200-with-errors during Task 1 review.
2. (§5.1) Confirm merge-vs-replace PUT semantics in review — spec only says "Update ticket".
3. `auto_classify` flag on POST, manual-override flow, classification confidence storage — all Task 2 scope, not designed here.
