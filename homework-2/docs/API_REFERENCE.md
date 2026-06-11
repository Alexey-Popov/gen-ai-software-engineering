# API Reference - Support Ticket Management API

This reference describes the REST API endpoints and data schemas for the Intelligent Customer Support Ticket System.

---

## Data Models

### Ticket Schema

```json
{
  "id": "Guid",
  "customer_id": "string",
  "customer_email": "string (email)",
  "customer_name": "string",
  "subject": "string (1-200 characters)",
  "description": "string (10-2000 characters)",
  "category": "account_access | technical_issue | billing_question | feature_request | bug_report | other",
  "priority": "urgent | high | medium | low",
  "status": "new | in_progress | waiting_customer | resolved | closed",
  "created_at": "string (ISO-8601 datetime)",
  "updated_at": "string (ISO-8601 datetime)",
  "resolved_at": "string (ISO-8601 datetime, nullable)",
  "assigned_to": "string (nullable)",
  "tags": ["string"],
  "metadata": {
    "source": "web_form | email | api | chat | phone",
    "browser": "string (nullable)",
    "device_type": "desktop | mobile | tablet"
  },
  "classification_confidence": "number (0.0-1.0, nullable)",
  "classification_reasoning": "string (nullable)",
  "classification_keywords": ["string"]
}
```

---

## Endpoints

### 1. Create a Ticket
Creates a single support ticket. Automatically runs classification rules on subject and description if no explicit values are provided or if the `auto_classify` flag is set.

- **Method:** `POST`
- **URL:** `/tickets`
- **Headers:** `Content-Type: application/json`
- **Query Parameters:**
  - `autoClassify` (boolean, optional) - Overrides the default or JSON-provided classification flag.
- **Request Body:**
  ```json
  {
    "customer_id": "CUST-100",
    "customer_email": "jane.doe@example.com",
    "customer_name": "Jane Doe",
    "subject": "Cannot log in to my dashboard",
    "description": "I receive a wrong password error message and 2FA lockout. Please help reset it.",
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 125.0",
      "device_type": "desktop"
    },
    "auto_classify": true
  }
  ```
- **Response:** `201 Created`
- **cURL Example:**
  ```bash
  curl -X POST http://localhost:5104/tickets \
    -H "Content-Type: application/json" \
    -d '{
      "customer_id": "CUST-100",
      "customer_email": "jane.doe@example.com",
      "customer_name": "Jane Doe",
      "subject": "Cannot log in to my dashboard",
      "description": "I receive a wrong password error message and 2FA lockout. Please help reset it.",
      "metadata": {
        "source": "web_form",
        "browser": "Chrome 125.0",
        "device_type": "desktop"
      }
    }'
  ```

---

### 2. Bulk Import Tickets
Allows importing tickets in bulk from CSV, JSON, or XML formats.

- **Method:** `POST`
- **URL:** `/tickets/import`
- **Headers:** `Content-Type: multipart/form-data`
- **Query Parameters:**
  - `autoClassify` (boolean, optional, default `true`) - Automatically classifies categories and priorities during the import process.
- **Form Fields:**
  - `file` (binary) - The file to upload. Must have `.csv`, `.json`, or `.xml` extension.
- **Success Response:** `200 OK` (when at least one ticket is successfully imported)
- **Error Response:** `400 Bad Request` (when the file is empty, has an invalid extension, or contains 100% parsing failures)
- **Response Body:**
  ```json
  {
    "total_records": 3,
    "successful": 2,
    "failed": 1,
    "errors": [
      {
        "row": 3,
        "error": "customer_email must be a valid email address; description must be between 10 and 2000 characters"
      }
    ]
  }
  ```
- **cURL Example:**
  ```bash
  curl -X POST "http://localhost:5104/tickets/import?autoClassify=true" \
    -F "file=@/path/to/sample_tickets.csv"
  ```

---

### 3. List All Tickets
Returns a list of all tickets. Supports combination filters.

- **Method:** `GET`
- **URL:** `/tickets`
- **Query Parameters (Optional):**
  - `category` (`account_access`, `technical_issue`, etc.)
  - `priority` (`urgent`, `high`, `medium`, `low`)
  - `status` (`new`, `in_progress`, etc.)
  - `customer_id` (string)
  - `tag` (string)
- **Response:** `200 OK`
- **cURL Example:**
  ```bash
  curl "http://localhost:5104/tickets?category=account_access&priority=urgent"
  ```

---

### 4. Fetch Specific Ticket
Returns details for a ticket.

- **Method:** `GET`
- **URL:** `/tickets/{id}`
- **Response:** `200 OK` or `404 Not Found`
- **cURL Example:**
  ```bash
  curl http://localhost:5104/tickets/d3b07384-d113-4444-a267-34d650221389
  ```

---

### 5. Update a Ticket
Updates ticket fields. Manually changing `category` or `priority` sets `classification_confidence` to `1.0` and logs it as a manual override.

- **Method:** `PUT`
- **URL:** `/tickets/{id}`
- **Headers:** `Content-Type: application/json`
- **Request Body (All fields optional):**
  ```json
  {
    "status": "in_progress",
    "assigned_to": "agent_bob",
    "tags": ["urgent-hotfix"]
  }
  ```
- **Response:** `200 OK` or `404 Not Found`
- **cURL Example:**
  ```bash
  curl -X PUT http://localhost:5104/tickets/d3b07384-d113-4444-a267-34d650221389 \
    -H "Content-Type: application/json" \
    -d '{"status": "in_progress", "assigned_to": "agent_bob"}'
  ```

---

### 6. Delete a Ticket
Deletes a ticket.

- **Method:** `DELETE`
- **URL:** `/tickets/{id}`
- **Response:** `204 No Content` or `404 Not Found`
- **cURL Example:**
  ```bash
  curl -X DELETE http://localhost:5104/tickets/d3b07384-d113-4444-a267-34d650221389
  ```

---

### 7. Run Auto-Classification On-Demand
Computes classification rules on a ticket, updating its category, priority, and confidence values.

- **Method:** `POST`
- **URL:** `/tickets/{id}/auto-classify`
- **Response:** `200 OK` or `404 Not Found`
- **Response Body:**
  ```json
  {
    "category": "account_access",
    "priority": "urgent",
    "confidence": 0.8,
    "reasoning": "Matched category 'account_access' with 2 keyword match(es). Assigned 'urgent' priority due to keyword 'cannot access'.",
    "keywords_found": ["login", "credentials", "cannot access"]
  }
  ```
- **cURL Example:**
  ```bash
  curl -X POST http://localhost:5104/tickets/d3b07384-d113-4444-a267-34d650221389/auto-classify
  ```

---

## Errors Reference

When validation or endpoint execution fails, the API returns a structured HTTP error.

### 1. Data Validation Failure (HTTP 400)
Returned when model fields fail validation checks.
```json
{
  "errors": {
    "customer_email": ["customer_email must be a valid email address"],
    "subject": ["subject must be between 1 and 200 characters"]
  },
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400
}
```

### 2. Resource Not Found (HTTP 404)
Returned when fetching or updating a non-existent UUID.
```json
{
  "error": "Ticket with ID d3b07384-d113-4444-a267-34d650221389 not found."
}
```
