# API Reference

## Base URL

`http://localhost:3000`

## Data Model

```json
{
  "id": "uuid",
  "customer_id": "string",
  "customer_email": "string (email)",
  "customer_name": "string",
  "subject": "string (1-200 chars)",
  "description": "string (10-2000 chars)",
  "category": "account_access | technical_issue | billing_question | feature_request | bug_report | other",
  "priority": "urgent | high | medium | low",
  "status": "new | in_progress | waiting_customer | resolved | closed",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime",
  "resolved_at": "ISO datetime | null",
  "assigned_to": "string | null",
  "tags": ["string"],
  "metadata": {
    "source": "web_form | email | api | chat | phone | mobile_app",
    "browser": "string",
    "device_type": "desktop | mobile | tablet"
  }
}
```

## Endpoints

### GET /

Health check.

```bash
curl http://localhost:3000/
```

### POST /tickets

Create a single ticket.

```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "user@example.com",
    "customer_name": "John Doe",
    "subject": "Cannot login",
    "description": "I cannot log in and need a password reset"
  }'
```

Example response (`201`):

```json
{
  "id": "f8b0f9f2-1111-4ce4-8888-345678901234",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Cannot login",
  "description": "I cannot log in and need a password reset",
  "category": "other",
  "priority": "medium",
  "status": "new"
}
```

### POST /tickets/import

Bulk import tickets from CSV/JSON/XML.

```bash
curl -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: text/csv" \
  --data-binary @demo/sample_tickets.csv
```

Example response (`200`):

```json
{
  "total": 50,
  "successful": 50,
  "failed": 0,
  "errors": []
}
```

### GET /tickets

List all tickets or filter by query params (`category`, `priority`, `status`, `from`, `to`).

```bash
curl "http://localhost:3000/tickets?category=technical_issue&priority=high"
```

### GET /tickets/:id

Get one ticket by id.

```bash
curl http://localhost:3000/tickets/{ticket-id}
```

### PUT /tickets/:id

Update ticket fields.

```bash
curl -X PUT http://localhost:3000/tickets/{ticket-id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "agent@example.com"
  }'
```

### DELETE /tickets/:id

Delete a ticket.

```bash
curl -X DELETE http://localhost:3000/tickets/{ticket-id}
```

### POST /tickets/:id/auto-classify

Classify category and priority using keyword rules.

```bash
curl -X POST http://localhost:3000/tickets/{ticket-id}/auto-classify
```

Example response (`200`):

```json
{
  "id": "f8b0f9f2-1111-4ce4-8888-345678901234",
  "category": "account_access",
  "priority": "high",
  "confidence": 0.62,
  "reasoning": "Found keywords in subject and description",
  "keywords_found": ["login", "password", "access"]
}
```

## Error Responses

### Validation Error (`400`)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "customer_email",
      "message": "customer_email must be a valid email address (e.g., user@example.com)"
    }
  ]
}
```

### Not Found (`404`)

```json
{
  "error": "Ticket not found",
  "id": "ticket-id"
}
```

### Unsupported Format (`400`)

```json
{
  "error": "Unsupported format",
  "message": "Only CSV, JSON, and XML formats are supported"
}
```
