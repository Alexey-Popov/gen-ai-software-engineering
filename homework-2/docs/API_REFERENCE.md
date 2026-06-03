# API Reference

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tickets` | Create a new support ticket |
| `POST` | `/tickets/import` | Bulk import from CSV/JSON/XML |
| `GET` | `/tickets` | List all tickets (with filtering) |
| `GET` | `/tickets/:id` | Get specific ticket |
| `PUT` | `/tickets/:id` | Update ticket |
| `DELETE` | `/tickets/:id` | Delete ticket |
| `POST` | `/tickets/:id/auto-classify` | Auto categorize and prioritize |

## Data Models

**Ticket Object:**
```json
{
  "id": "e2b6e510-1d88-4a4a-921d-932b130e58f0",
  "customer_id": "CUST-1000",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Login problem",
  "description": "I cannot login to my account after password reset.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-04-30T14:00:00.000Z",
  "updated_at": "2026-04-30T14:00:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": [],
  "metadata": {
    "source": "api",
    "browser": "",
    "device_type": "desktop"
  }
}
```

## Detailed Endpoints

### 1. Create a Ticket
`POST /tickets`

**Query Parameters:**
- `autoClassify` (boolean): Set to `true` to run auto-classification immediately.

**cURL Example:**
```bash
curl -X POST http://localhost:3000/tickets \
-H "Content-Type: application/json" \
-d '{"customer_email": "a@b.com", "subject": "Bug", "description": "It crashed!"}'
```

### 2. Bulk Import
`POST /tickets/import`

Upload a file (`.csv`, `.json`, `.xml`) containing tickets.

**cURL Example:**
```bash
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@sample_tickets.csv"
```
**Response:**
```json
{
  "total": 50,
  "successful": 50,
  "failed": 0,
  "errors": []
}
```

### 3. List Tickets
`GET /tickets`

**Query Parameters:**
- `category` (string): Filter by category
- `priority` (string): Filter by priority

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/tickets?category=bug_report"
```

### 4. Auto-Classify
`POST /tickets/:id/auto-classify`

Analyzes the ticket content to update the category and priority.

**cURL Example:**
```bash
curl -X POST http://localhost:3000/tickets/e2b6e510-1d88-4a4a-921d-932b130e58f0/auto-classify
```

## Error Responses
Errors format:
```json
{
  "error": "Error message details here"
}
```
- `400 Bad Request` for invalid data or formats.
- `404 Not Found` for missing resources.
