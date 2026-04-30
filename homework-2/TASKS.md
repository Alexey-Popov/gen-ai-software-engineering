# 🎧 Homework 2: Intelligent Customer Support System

## 📋 Overview

Build a customer support ticket management system that imports tickets from multiple file formats, automatically categorizes issues, and assigns priorities. Focus on applying the **Context-Model-Prompt** while generating comprehensive tests and documentation using AI tools.

---

## 🎯 Learning Objectives

- ✅ Master the **Context-Model-Prompt framework** in practice
- ✅ Generate comprehensive test suites with AI (>85% coverage)
- ✅ Create multi-level documentation

---

## 🛠️ Requirements

**Tools:** Use AI coding tools

**Tech Stack:** Choose one - Node.js/Express, Python/Flask/FastAPI, or Java/Spring Boot

---

## 📝 Tasks

### Task 1: Multi-Format Ticket Import API

Create a REST API for support tickets with these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tickets` | Create a new support ticket |
| `POST` | `/tickets/import` | Bulk import from CSV/JSON/XML |
| `GET` | `/tickets` | List all tickets (with filtering) |
| `GET` | `/tickets/:id` | Get specific ticket |
| `PUT` | `/tickets/:id` | Update ticket |
| `DELETE` | `/tickets/:id` | Delete ticket |

**Ticket Model:**
```json
{
  "id": "UUID",
  "customer_id": "string",
  "customer_email": "email",
  "customer_name": "string",
  "subject": "string (1-200 chars)",
  "description": "string (10-2000 chars)",
  "category": "account_access | technical_issue | billing_question | feature_request | bug_report | other",
  "priority": "urgent | high | medium | low",
  "status": "new | in_progress | waiting_customer | resolved | closed",
  "created_at": "datetime",
  "updated_at": "datetime",
  "resolved_at": "datetime (nullable)",
  "assigned_to": "string (nullable)",
  "tags": ["array"],
  "metadata": {
    "source": "web_form | email | api | chat | phone",
    "browser": "string",
    "device_type": "desktop | mobile | tablet"
  }
}
```

**Requirements:**
- Parse CSV, JSON, and XML file formats
- Validate all required fields (email format, string lengths, enums)
- Return bulk import summary: total records, successful, failed with error details
- Handle malformed files gracefully with meaningful error messages
- Use appropriate HTTP status codes (201, 400, 404, etc.)

---

### Task 2: Auto-Classification

Implement automatic ticket categorization and priority assignment.

**Categories:**
- `account_access` - login, password, 2FA issues
- `technical_issue` - bugs, errors, crashes
- `billing_question` - payments, invoices, refunds
- `feature_request` - enhancements, suggestions
- `bug_report` - defects with reproduction steps
- `other` - uncategorizable

**Priority Rules:**
- **Urgent**: "can't access", "critical", "production down", "security"
- **High**: "important", "blocking", "asap"
- **Medium**: default
- **Low**: "minor", "cosmetic", "suggestion"

**Endpoint:**
```
POST /tickets/:id/auto-classify
```

**Response includes:** category, priority, confidence score (0-1), reasoning, keywords found

**Requirements:**
- Auto-run on ticket creation (optional flag)
- Store classification confidence
- Allow manual override
- Log all decisions

---

### Task 3: AI-Generated Test Suite

Generate comprehensive tests achieving **>85% code coverage**.

**Required Test Files:**

```
tests/
├── test_ticket_api          # API endpoints (11 tests)
├── test_ticket_model        # Data validation (9 tests)
├── test_import_csv          # CSV parsing (6 tests)
├── test_import_json         # JSON parsing (5 tests)
├── test_import_xml          # XML parsing (5 tests)
├── test_categorization      # Classification (10 tests)
├── test_integration         # End-to-end workflows (5 tests)
├── test_performance         # Benchmarks (5 tests)
└── fixtures/                   # Sample data files
```

**Test Coverage Requirements:**
- Overall: >85%

---

### Task 4: Multi-Level Documentation

Generate 5 documentation files for different audiences:

**1. README.md** (Developers)
- Project overview and features
- Architecture diagram (Mermaid)
- Installation and setup instructions
- How to run tests
- Project structure

**2. API_REFERENCE.md** (API Consumers)
- All endpoints with request/response examples
- Data models and schemas
- Error response formats
- cURL examples for each endpoint

**3. ARCHITECTURE.md** (Technical Leads)
- High-level architecture diagram (Mermaid)
- Component descriptions
- Data flow diagrams (Mermaid sequence diagrams)
- Design decisions and trade-offs
- Security and performance considerations

**4. TESTING_GUIDE.md** (QA Engineers)
- Test pyramid diagram (Mermaid)
- How to run tests
- Sample test data locations
- Manual testing checklist
- Performance benchmarks table

**Requirements:**
- Use different AI models for different doc types
- Include at least 3 Mermaid diagrams across documents

---

### Task 5: Integration & Performance Tests

Implement end-to-end tests.

**Integration Tests:**
- Complete ticket lifecycle workflow
- Bulk import with auto-classification verification
- Concurrent operations (20+ simultaneous requests)
- Combined filtering by category and priority

---

## 📦 Deliverables

### 1️⃣ Source Code

### 2️⃣ Test Coverage Report
- Coverage report showing >85%
- Screenshot in `docs/screenshots/test_coverage.png`

### 3️⃣ Sample Data
- `sample_tickets.csv` (50 tickets)
- `sample_tickets.json` (20 tickets)
- `sample_tickets.xml` (30 tickets)
- Invalid data files for negative tests

---

<div align="center">

**Good luck! 🍀**

</div>
