# API Reference — Support Tickets API

**Base URL:** `http://localhost:3000`

---

## Error Response Format

All error responses (4xx) follow this standardized envelope:

```json
{
  "error": "<short human-readable message>",
  "details": [
    {"field": "<field name>", "message": "<validation or error text>"}
  ]
}
```

Multiple field errors are each reported as a separate object in `details`. FastAPI's built-in 422 responses are intercepted and converted to 400 using this same shape.

**404 example:**
```json
{
  "error": "Ticket not found",
  "details": [{"field": "ticket_id", "message": "no ticket with id 550e8400-e29b-41d4-a716-446655440000"}]
}
```

---

## Ticket Schema

Full `Ticket` object returned by all endpoints that succeed with a ticket body.

| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `id` | UUID | Auto | No | Unique ticket identifier, auto-generated on creation |
| `customer_id` | string | Yes | No | Customer identifier (e.g. `CUST-1001`) |
| `customer_email` | string | Yes | No | Customer email address (validated email format) |
| `customer_name` | string | Yes | No | Customer display name |
| `subject` | string | Yes | No | Issue title (1–200 characters) |
| `description` | string | Yes | No | Detailed issue description (10–2000 characters) |
| `category` | string | No | Yes | Issue category; one of: `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, `other` (defaults to `null`) |
| `priority` | string | No | Yes | Severity level; one of: `urgent`, `high`, `medium`, `low` (defaults to `null`) |
| `status` | string | No | No | Current state; one of: `new`, `in_progress`, `waiting_customer`, `resolved`, `closed` (defaults to `new`) |
| `assigned_to` | string | No | Yes | Assigned agent or team identifier (defaults to `null`) |
| `tags` | array of strings | No | No | Search and filter labels (defaults to `[]`) |
| `metadata` | object | No | Yes | Contact context; see TicketMetadata below (defaults to `null`) |
| `created_at` | ISO 8601 timestamp | Auto | No | UTC timestamp when the ticket was created |
| `updated_at` | ISO 8601 timestamp | Auto | No | UTC timestamp of the most recent modification |
| `resolved_at` | ISO 8601 timestamp | Auto | Yes | UTC timestamp set when status transitions to `resolved`; cleared when status transitions away from `resolved` |

**TicketMetadata sub-object:**

| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `source` | string | No | Yes | How the customer contacted support; one of: `web_form`, `email`, `api`, `chat`, `phone` |
| `browser` | string | No | Yes | Browser name and version (free text, e.g. `Chrome 120`) |
| `device_type` | string | No | Yes | Device category; one of: `desktop`, `mobile`, `tablet` |

---

## Endpoints

### POST /tickets

Create a new support ticket, optionally with auto-classification.

**Request body — TicketCreate**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `customer_id` | string | Yes | — | Customer identifier |
| `customer_email` | string | Yes | Valid email format | Customer email address |
| `customer_name` | string | Yes | — | Display name |
| `subject` | string | Yes | 1–200 characters | Ticket title |
| `description` | string | Yes | 10–2000 characters | Detailed issue description |
| `category` | string | No | `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, `other` | Issue category (defaults to `null`) |
| `priority` | string | No | `urgent`, `high`, `medium`, `low` | Severity level (defaults to `null`) |
| `status` | string | No | `new`, `in_progress`, `waiting_customer`, `resolved`, `closed` | Initial status (defaults to `new`) |
| `assigned_to` | string | No | — | Assigned agent or team (defaults to `null`) |
| `tags` | array of strings | No | — | Search/filter labels (defaults to `[]`) |
| `metadata` | object | No | See TicketMetadata in Ticket Schema | Contact context (defaults to `null`) |

Unknown fields in the body are rejected with 400 (`extra="forbid"`).

**Query parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `auto_classify` | bool | No | `false` | If `true`, run the auto-classifier after creating the ticket and overwrite `category` and `priority` with the classification result |

When `auto_classify=true`, any `category` or `priority` values in the request body are **overwritten** by the classifier result. The classifier is invoked after the ticket is inserted, not before.

**Success — 201 Created**

Returns the full `Ticket` object:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST-1001",
  "customer_email": "alice@example.com",
  "customer_name": "Alice Example",
  "subject": "Cannot log in",
  "description": "I cannot log into my account since yesterday morning.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "assigned_to": null,
  "tags": ["login", "urgent"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 120",
    "device_type": "desktop"
  },
  "created_at": "2026-05-03T10:15:30.123456Z",
  "updated_at": "2026-05-03T10:15:30.123456Z",
  "resolved_at": null
}
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Missing required field (`customer_id`, `customer_email`, `customer_name`, `subject`, `description`) |
| 400 | `customer_email` is not a valid email address |
| 400 | `subject` length outside 1–200 characters |
| 400 | `description` length outside 10–2000 characters |
| 400 | `category`, `priority`, or `status` value not in the allowed enum |
| 400 | `metadata.source` or `metadata.device_type` value not in the allowed enum |
| 400 | Unknown extra field present in body |

**cURL example**

```bash
curl -s -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_id": "CUST-1001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since yesterday morning.",
    "category": "account_access",
    "priority": "high",
    "tags": ["login", "urgent"],
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 120",
      "device_type": "desktop"
    }
  }' | python3 -m json.tool
```

---

### GET /tickets

List all tickets, optionally filtered by category, priority, and/or status. Filters compose with AND semantics.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by category; one of: `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, `other` |
| `priority` | string | No | Filter by priority; one of: `urgent`, `high`, `medium`, `low` |
| `status` | string | No | Filter by status; one of: `new`, `in_progress`, `waiting_customer`, `resolved`, `closed` |

**Success — 200 OK**

Array of `Ticket` objects in insertion order. Returns `[]` when no tickets match (never 404).

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "CUST-1001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since yesterday morning.",
    "category": "account_access",
    "priority": "high",
    "status": "new",
    "assigned_to": null,
    "tags": ["login", "urgent"],
    "metadata": {"source": "web_form", "browser": "Chrome 120", "device_type": "desktop"},
    "created_at": "2026-05-03T10:15:30.123456Z",
    "updated_at": "2026-05-03T10:15:30.123456Z",
    "resolved_at": null
  }
]
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `category` query value is not a valid enum value |
| 400 | `priority` query value is not a valid enum value |
| 400 | `status` query value is not a valid enum value |

**cURL example**

```bash
# List all tickets
curl -s http://localhost:3000/tickets | python3 -m json.tool

# Filter by status
curl -s 'http://localhost:3000/tickets?status=new' | python3 -m json.tool

# Filter by category and priority (AND semantics)
curl -s 'http://localhost:3000/tickets?category=account_access&priority=high' | python3 -m json.tool
```

---

### GET /tickets/{ticket_id}

Fetch a single ticket by its UUID.

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Ticket identifier (e.g. `550e8400-e29b-41d4-a716-446655440000`) |

**Success — 200 OK**

Returns the full `Ticket` object (same shape as POST 201 response).

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `ticket_id` is not a valid UUID string |
| 404 | No ticket exists with the given ID |

**cURL example**

```bash
curl -s http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  | python3 -m json.tool
```

---

### PUT /tickets/{ticket_id}

Partially update a ticket. Only fields present in the request body are changed; absent fields retain their current values. An explicit `null` clears the field.

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Ticket identifier |

**Request body — TicketUpdate (all fields optional)**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `subject` | string | 1–200 characters | Updated ticket title |
| `description` | string | 10–2000 characters | Updated issue description |
| `category` | string or null | `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, `other` | Updated category; `null` clears it |
| `priority` | string or null | `urgent`, `high`, `medium`, `low` | Updated severity; `null` clears it |
| `status` | string | `new`, `in_progress`, `waiting_customer`, `resolved`, `closed` | Updated status (triggers `resolved_at` side effects) |
| `assigned_to` | string or null | — | Assigned agent; `null` clears the assignment |
| `tags` | array of strings or null | — | Updated tag list; `null` clears it |
| `metadata` | object or null | See TicketMetadata in Ticket Schema | Updated metadata; `null` clears it |

`id`, `customer_id`, `customer_email`, `customer_name`, and `created_at` are immutable and rejected with 400 if supplied.

**Status side effects on `resolved_at`:**
- Transitioning to `resolved` from any other status: `resolved_at` is set to current UTC time.
- Transitioning away from `resolved` to any other status: `resolved_at` is cleared to `null`.
- Status unchanged or absent from body: `resolved_at` is not modified.

`updated_at` is always refreshed to current UTC time on every successful PUT.

**Success — 200 OK**

Returns the full updated `Ticket` object.

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `ticket_id` is not a valid UUID |
| 400 | `status`, `category`, or `priority` value not in the allowed enum |
| 400 | `subject` length outside 1–200 characters |
| 400 | `description` length outside 10–2000 characters |
| 400 | Immutable field (`id`, `customer_id`, etc.) supplied in body |
| 400 | Unknown extra field in body |
| 404 | Ticket not found |

**cURL example**

```bash
# Resolve a ticket (resolved_at is set automatically)
curl -s -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Content-Type: application/json' \
  -d '{"status": "resolved"}' | python3 -m json.tool

# Update priority and assigned agent
curl -s -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Content-Type: application/json' \
  -d '{"priority": "urgent", "assigned_to": "agent-5"}' | python3 -m json.tool

# Clear an optional field
curl -s -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Content-Type: application/json' \
  -d '{"assigned_to": null}' | python3 -m json.tool
```

---

### DELETE /tickets/{ticket_id}

Permanently delete a ticket by ID.

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Ticket identifier |

**Success — 204 No Content**

Empty response body. A second DELETE on the same ID returns 404.

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `ticket_id` is not a valid UUID |
| 404 | Ticket not found |

**cURL example**

```bash
curl -s -X DELETE http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
# Returns 204 with no body
```

---

### POST /tickets/import

Upload a file (CSV, JSON, or XML) to bulk-create tickets. Returns an `ImportSummary` with counts and per-row errors; partial success (some rows valid, some invalid) returns 200.

**Request**

- `Content-Type: multipart/form-data`
- Form field `file` (binary, required): file content.
- Query parameter `format` (optional): explicit format override.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Explicit format: `csv`, `json`, or `xml` (case-insensitive). Takes precedence over MIME type and filename suffix. |

**Form fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | File to import. No size limit. |

**Format detection (priority order)**

1. Explicit `?format=csv|json|xml` query parameter.
2. File MIME type: `text/csv` or `application/csv` → CSV; `application/json` or `text/json` → JSON; `application/xml` or `text/xml` → XML.
3. Filename suffix (case-insensitive): `.csv`, `.json`, `.xml`.

If none of the three layers identifies a format, the request is rejected with 400.

**Success — 200 OK**

`ImportSummary` object:

```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "errors": [
    {
      "row": 2,
      "field": "customer_email",
      "message": "value is not a valid email address"
    }
  ]
}
```

Row numbers are 1-based (data rows only; the CSV header row is excluded from numbering).
The summary does not include IDs of successfully created tickets.

**Errors**

| Code | Condition |
|------|-----------|
| 400 | No `file` field in the multipart body |
| 400 | File is empty (0 bytes) |
| 400 | Format cannot be detected (no `?format=`, no recognised MIME type, no recognised filename suffix) |
| 400 | Container-level malformation (e.g. non-array JSON root, invalid XML structure) |

Row-level validation failures are not 400 — they are reported as entries in `errors` within the 200 `ImportSummary`.

**cURL example**

```bash
# Import CSV (format detected from filename suffix)
curl -s -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.csv" | python3 -m json.tool

# Import JSON with explicit format override
curl -s -X POST 'http://localhost:3000/tickets/import?format=json' \
  -F "file=@demo/sample_tickets.json" | python3 -m json.tool

# Import XML (format detected from filename suffix)
curl -s -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.xml" | python3 -m json.tool
```

---

## File Formats

### CSV Format

Tickets can be imported from a UTF-8 encoded, RFC 4180-compliant CSV file with a required header row. Column names must exactly match JSON model keys (snake_case). Tags are semicolon-separated in a single column; metadata is flattened to three `metadata_*` columns.

**Required columns:** `customer_id`, `customer_email`, `customer_name`, `subject`, `description`

**Optional columns (any subset):** `category`, `priority`, `status`, `assigned_to`, `tags`, `metadata_source`, `metadata_browser`, `metadata_device_type`

**Rules:**
- Unknown column names cause a 400 error at the container level.
- Blank cells are treated as the field being omitted (model defaults apply).
- `tags` column: semicolon-separated values, e.g. `login;urgent`. Empty or whitespace-only → `[]`.
- `metadata_*` columns: if any of the three is non-blank, a `TicketMetadata` object is constructed; otherwise `metadata = null`.
- Row 1 = first data row (the row immediately after the header).

**Example:**

```
customer_id,customer_email,customer_name,subject,description,category,priority,status,assigned_to,tags,metadata_source,metadata_browser,metadata_device_type
CUST-001,alice@example.com,Alice Example,Cannot log in,I cannot log into my account since yesterday.,account_access,high,new,,login;urgent,web_form,Chrome,desktop
CUST-002,bob@example.com,Bob Example,Invoice question,I have a question about invoice number 12345.,billing_question,medium,new,agent-7,billing,email,,
```

---

### JSON Format

Tickets can be imported from a JSON file whose top-level value is an array. Each array element is a `TicketCreate` object using the same field names and constraints as the POST `/tickets` request body.

**Rules:**
- A non-array top-level value causes a 400 error.
- Non-object array elements (e.g. a string or number) are reported as per-row errors in `ImportSummary`.
- Row 1 = first array element.

**Example:**

```json
[
  {
    "customer_id": "CUST-001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since yesterday.",
    "category": "account_access",
    "priority": "high",
    "tags": ["login", "urgent"],
    "metadata": {"source": "web_form", "browser": "Chrome", "device_type": "desktop"}
  },
  {
    "customer_id": "CUST-002",
    "customer_email": "bob@example.com",
    "customer_name": "Bob Example",
    "subject": "Invoice question",
    "description": "I have a question about invoice number 12345."
  }
]
```

---

### XML Format

Tickets can be imported from an XML file with a `<tickets>` root element containing `<ticket>` child elements. Each scalar field is a child element whose tag name matches the JSON key (snake_case). Tags use a `<tags><tag>` wrapper; metadata uses a `<metadata>` wrapper with `<source>`, `<browser>`, and `<device_type>` children. Parsed with `defusedxml.ElementTree` (secure; never standard `xml.etree`).

**Rules:**
- All values are element text content (no XML attributes).
- Optional fields may be omitted entirely; empty text content is treated as omission.
- Whitespace surrounding element text is stripped.
- Row 1 = first `<ticket>` element.

**Example:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>CUST-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since yesterday.</description>
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
    <customer_id>CUST-002</customer_id>
    <customer_email>bob@example.com</customer_email>
    <customer_name>Bob Example</customer_name>
    <subject>Invoice question</subject>
    <description>I have a question about invoice number 12345.</description>
  </ticket>
</tickets>
```

---

## Auto-Classification

The auto-classification feature uses a rule-based keyword matcher to automatically assign `category` and `priority` to tickets based on their `subject` and `description`. Classification decisions are logged for audit purposes.

### POST /tickets/{ticket_id}/auto-classify

Run the keyword-based auto-classifier on an existing ticket, updating its category and priority.

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Ticket identifier (e.g. `550e8400-e29b-41d4-a716-446655440000`) |

**Success — 200 OK**

Returns a `ClassificationResult` object with the classification decision and matching keywords.

```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "account_access",
  "priority": "urgent",
  "confidence": 0.60,
  "reasoning": "Matched priority keywords: ['critical']. Matched category keywords: ['login', 'access'].",
  "keywords_found": ["critical", "login", "access"]
}
```

**ClassificationResult schema**

| Field | Type | Description |
|-------|------|-------------|
| `ticket_id` | UUID | The ticket being classified |
| `category` | string | Assigned category: `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, or `other` |
| `priority` | string | Assigned priority: `urgent`, `high`, `medium`, or `low` |
| `confidence` | float | Confidence score (0.0 to 1.0), calculated as `min(1.0, distinct_keyword_hits / 5.0)` rounded to 2 decimal places |
| `reasoning` | string | Human-readable explanation of matched priority and category keywords |
| `keywords_found` | array of strings | List of unique keywords that matched in the ticket text (in order: priority keywords first, then category keywords) |

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `ticket_id` is not a valid UUID |
| 404 | No ticket exists with the given ID |

**Side effects**

- Ticket's `category` and `priority` are updated with the classification result.
- Ticket's `updated_at` is refreshed to current UTC time.
- Classification result is recorded in the classification log for audit purposes.
- `resolved_at` is **not** modified; classification does not affect status.

**cURL example**

```bash
curl -s -X POST http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify \
  | python3 -m json.tool
```

---

### GET /tickets/{ticket_id}/classifications

Retrieve the classification history for a ticket (append-only log of all `auto-classify` invocations on that ticket).

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Ticket identifier |

**Success — 200 OK**

Array of `ClassificationResult` objects in insertion order (oldest first). May be empty for a ticket that has never been classified.

```json
[
  {
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "account_access",
    "priority": "high",
    "confidence": 0.40,
    "reasoning": "Matched priority keywords: ['blocking']. Matched category keywords: ['account', 'access'].",
    "keywords_found": ["blocking", "account", "access"]
  },
  {
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "account_access",
    "priority": "urgent",
    "confidence": 0.60,
    "reasoning": "Matched priority keywords: ['critical']. Matched category keywords: ['login', 'access'].",
    "keywords_found": ["critical", "login", "access"]
  }
]
```

**Errors**

| Code | Condition |
|------|-----------|
| 400 | `ticket_id` is not a valid UUID |
| 404 | No ticket exists with the given ID (even if the classification log has entries) |

**Note:** The ticket **must exist** for classifications to be returned. If the ticket is deleted, its classification history is not accessible. A 200 response with an empty array `[]` indicates the ticket exists but has never been classified.

**cURL example**

```bash
curl -s http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/classifications \
  | python3 -m json.tool
```

---

## Classification Rules

The auto-classifier is a pure rule-based system that matches keywords in the concatenated `subject + description` text (lowercased). This section documents the exact keyword tables and resolution logic.

### Priority Keywords

Priority is resolved by matching keywords against the input text in a precedence order: if `urgent` keywords match, the ticket is marked `urgent`; else if `high` keywords match, the priority is `high`; else if `low` keywords match, the priority is `low`; otherwise, the priority defaults to `medium`.

| Priority | Keywords |
|----------|----------|
| `urgent` | `"can't access"`, `"critical"`, `"production down"`, `"security"` |
| `high` | `"important"`, `"blocking"`, `"asap"` |
| `low` | `"minor"`, `"cosmetic"`, `"suggestion"` |
| `medium` | (default — no keywords) |

### Category Keywords

Category is resolved by testing categories in declaration order; the **first category** whose keywords appear in the text is assigned. If no category matches, the ticket is categorized as `other`.

| Category | Keywords |
|----------|----------|
| `account_access` | `"login"`, `"password"`, `"2fa"`, `"account"`, `"access"`, `"sign in"`, `"locked out"` |
| `technical_issue` | `"bug"`, `"error"`, `"crash"`, `"broken"`, `"not working"`, `"exception"`, `"500"` |
| `billing_question` | `"payment"`, `"invoice"`, `"refund"`, `"charge"`, `"billing"`, `"subscription"` |
| `feature_request` | `"feature"`, `"enhancement"`, `"request"`, `"would like"`, `"suggestion"`, `"add"` |
| `bug_report` | `"defect"`, `"reproduce"`, `"steps to reproduce"`, `"regression"`, `"expected behavior"` |
| `other` | (default — no keywords) |

### Confidence Calculation

The confidence score reflects how many distinct keywords were matched in the input text:

```
keywords_found = unique list of all matched priority + category keywords
hits = len(keywords_found)
confidence = round(min(1.0, hits / 5.0), 2)
```

Examples:
- 0 hits → 0.00 confidence
- 1 hit → 0.20 confidence
- 5+ hits → 1.00 confidence
- 3 hits → 0.60 confidence

### Matching Rules

- **Substring matching:** Keywords match via `in` operator — no tokenization or stemming. For example, `"can't access"` matches text containing the substring `"can't access"` (not just the word "access").
- **Case-insensitive:** Text is lowercased before matching; keyword tables are all lowercase.
- **Deduplication:** Keywords appearing in multiple categories are counted once in `keywords_found`.
- **Order preservation:** `keywords_found` lists priority keywords first (in their table order), then category keywords (across all categories in their table order).
- **Precedence (priority only):** When multiple priority levels match, the highest precedence wins. The default (`medium`) is never included in `keywords_found` since it has no keywords.
- **First-match (category only):** When multiple categories match, the first-listed in the category keyword table wins.
