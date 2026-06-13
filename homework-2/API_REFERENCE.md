# API Reference

> **Generated with**: Claude Sonnet 4.6  
> **Audience**: API Consumers

Base URL: `http://localhost:3000`  
Content-Type: `application/json` (unless noted otherwise for imports)

---

## Data Models

### Ticket

| Field            | Type                  | Required | Notes                              |
|------------------|-----------------------|----------|------------------------------------|
| id               | string (UUID)         | auto     | Generated on creation              |
| customer_id      | string                | yes      |                                    |
| customer_email   | string (email)        | yes      | Must be valid email format         |
| customer_name    | string                | yes      |                                    |
| subject          | string (1–200 chars)  | yes      |                                    |
| description      | string (10–2000 chars)| yes      |                                    |
| category         | Category enum         | no       | See enum values below              |
| priority         | Priority enum         | no       | See enum values below              |
| status           | Status enum           | no       | Defaults to `new`                  |
| created_at       | ISO 8601 datetime     | auto     |                                    |
| updated_at       | ISO 8601 datetime     | auto     |                                    |
| resolved_at      | ISO 8601 datetime     | no       | Set when status = `resolved`       |
| assigned_to      | string                | no       |                                    |
| tags             | string[]              | no       |                                    |
| metadata         | Metadata object       | no       | See below                          |

### Enums

**Category**: `account_access` | `technical_issue` | `billing_question` | `feature_request` | `bug_report` | `other`

**Priority**: `urgent` | `high` | `medium` | `low`

**Status**: `new` | `in_progress` | `waiting_customer` | `resolved` | `closed`

**Source** (metadata): `web_form` | `email` | `api` | `chat` | `phone`

**DeviceType** (metadata): `desktop` | `mobile` | `tablet`

### Metadata Object

```json
{
  "source": "web_form",
  "browser": "Chrome 120",
  "device_type": "desktop"
}
```

### ImportResult

```json
{
  "total": 10,
  "successful": 8,
  "failed": 2,
  "errors": [
    {
      "recordIndex": 3,
      "errors": {
        "customer_email": "Invalid email format"
      }
    }
  ],
  "created_ids": ["uuid-1", "uuid-2"]
}
```

---

## Error Response Format

All errors use the same shape:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "customer_email", "message": "Invalid email" },
    { "field": "subject", "message": "String must contain at least 1 character(s)" }
  ],
  "requestId": "req-abc123"
}
```

| HTTP Status | Meaning                    |
|-------------|----------------------------|
| 400         | Validation failed          |
| 404         | Resource not found         |
| 500         | Internal server error      |

---

## Endpoints

### POST /tickets

Create a single ticket.

**Request**
```json
{
  "customer_id": "CUST001",
  "customer_email": "alice@example.com",
  "customer_name": "Alice Smith",
  "subject": "Cannot log in",
  "description": "I have been unable to log into my account for the past two days.",
  "category": "account_access",
  "priority": "high",
  "status": "new"
}
```

**Response** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST001",
  "customer_email": "alice@example.com",
  "customer_name": "Alice Smith",
  "subject": "Cannot log in",
  "description": "I have been unable to log into my account for the past two days.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-21T10:00:00.000Z",
  "updated_at": "2026-05-21T10:00:00.000Z"
}
```

**cURL**
```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Smith",
    "subject": "Cannot log in",
    "description": "I have been unable to log into my account for the past two days.",
    "category": "account_access",
    "priority": "high"
  }'
```

---

### GET /tickets

List all tickets. Supports filtering via query parameters.

**Query Parameters**

| Parameter    | Type   | Description                    |
|--------------|--------|--------------------------------|
| category     | string | Filter by category enum value  |
| priority     | string | Filter by priority enum value  |
| status       | string | Filter by status enum value    |
| customer_id  | string | Filter by customer ID          |
| assigned_to  | string | Filter by assigned staff name  |

**Response** `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_email": "alice@example.com",
    "subject": "Cannot log in",
    "category": "account_access",
    "priority": "high",
    "status": "new",
    "created_at": "2026-05-21T10:00:00.000Z",
    "updated_at": "2026-05-21T10:00:00.000Z"
  }
]
```

**cURL**
```bash
# List all tickets
curl http://localhost:3000/tickets

# Filter by status and priority
curl "http://localhost:3000/tickets?status=new&priority=urgent"
```

---

### GET /tickets/:id

Get a single ticket by ID.

**Response** `200 OK` — returns the ticket object (same shape as POST response)

**Response** `404 Not Found`
```json
{ "error": "Ticket not found", "requestId": "req-abc123" }
```

**cURL**
```bash
curl http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

---

### PUT /tickets/:id

Partially update a ticket. Send only the fields to change.

**Request**
```json
{
  "priority": "urgent",
  "status": "in_progress",
  "assigned_to": "agent-007"
}
```

**Response** `200 OK` — returns the full updated ticket object

**Response** `400 Bad Request` — if the body is empty or contains invalid values

**cURL**
```bash
curl -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress", "assigned_to": "agent-007" }'
```

---

### DELETE /tickets/:id

Delete a ticket by ID.

**Response** `204 No Content` — ticket successfully deleted

**Response** `404 Not Found` — ticket does not exist

**cURL**
```bash
curl -X DELETE http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

---

### POST /tickets/import

Bulk import tickets from a CSV, JSON, or XML payload.

**Format Detection** (in priority order):
1. `?format=csv|json|xml` query parameter
2. `Content-Type` header: `text/csv`, `application/json`, `text/xml`
3. Auto-detection from content shape

**CSV Request**
```bash
curl -X POST "http://localhost:3000/tickets/import" \
  -H "Content-Type: text/csv" \
  --data-binary @tests/fixtures/valid-tickets.csv
```

**JSON Request**
```bash
curl -X POST "http://localhost:3000/tickets/import" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "customer_id": "CUST001",
      "customer_email": "alice@example.com",
      "customer_name": "Alice Smith",
      "subject": "Cannot log in",
      "description": "I have been unable to log into my account for the past two days.",
      "category": "account_access",
      "priority": "high"
    }
  ]'
```

**XML Request**
```bash
curl -X POST "http://localhost:3000/tickets/import?format=xml" \
  -H "Content-Type: text/xml" \
  --data-binary @tests/fixtures/valid-tickets.xml
```

**Response** `200 OK`
```json
{
  "total": 10,
  "successful": 9,
  "failed": 1,
  "errors": [
    {
      "recordIndex": 4,
      "errors": {
        "customer_email": "Invalid email"
      }
    }
  ],
  "created_ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

Import always returns `200` even if some records fail — check `failed` and `errors` to identify problems.
