# Customer Support Ticket Management System - Initial Instructions

## Project Overview

Build a Node.js + TypeScript application that implements a REST API for managing customer support tickets. The system will:
- Accept and validate support tickets from multiple sources
- Import tickets in bulk from CSV, JSON, and XML formats
- Store tickets in-memory for fast access
- Provide CRUD operations with filtering capabilities
- Prepare infrastructure for AI-powered categorization and priority assignment (Phase 2)

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Testing**: Jest + Supertest
- **Validation**: Zod (schema validation)
- **File Parsing**: csv-parse, fast-xml-parser
- **UUID Generation**: uuid

## Quick Start

### 1. Prerequisites
- Node.js v18 or higher
- npm or yarn package manager

### 2. Project Setup
```bash
cd homework-2
npm install
```

### 3. Development
```bash
npm run dev          # Start dev server with auto-reload
npm run build        # Compile TypeScript
npm start            # Run compiled app
```

### 4. Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### 5. API Documentation
- **Base URL**: `http://localhost:3000`
- **API Docs**: Full endpoint documentation in [API_REFERENCE.md](./API_REFERENCE.md)

## Project Structure

```
homework-2/
├── src/
│   ├── routes/              # Express route handlers
│   │   ├── tickets.ts       # Ticket CRUD endpoints
│   │   └── import.ts        # Bulk import endpoint
│   ├── models/              # Type definitions
│   │   └── ticket.ts        # Ticket interface & enums
│   ├── validators/          # Input validation logic
│   │   ├── ticket-validator.ts
│   │   └── import-validator.ts
│   ├── services/            # Business logic
│   │   ├── ticket-service.ts
│   │   └── import-service.ts
│   ├── utils/               # Helper functions
│   │   ├── file-parser.ts   # CSV/JSON/XML parsing
│   │   ├── error-handler.ts
│   │   └── logger.ts
│   ├── app.ts               # Express app setup
│   └── index.ts             # Server entry point
├── tests/
│   ├── test_ticket_api.ts       # API endpoint tests (11)
│   ├── test_ticket_model.ts     # Data validation tests (9)
│   ├── test_import_csv.ts       # CSV import tests (6)
│   ├── test_import_json.ts      # JSON import tests (5)
│   ├── test_import_xml.ts       # XML import tests (5)
│   ├── test_categorization.ts   # Classifier tests (10)
│   ├── test_integration.ts      # End-to-end tests (5)
│   ├── test_performance.ts      # Benchmark tests (5)
│   └── fixtures/                # Sample CSV / JSON / XML data
├── package.json
├── tsconfig.json
├── .env.example
├── jest.config.js
├── INSTRUCTIONS.md          # This file
├── DEVELOPMENT_PLAN.md      # Step-by-step plan
├── API_REFERENCE.md         # Full endpoint documentation
├── ARCHITECTURE.md          # System design and diagrams
└── TESTING_GUIDE.md         # QA guide and test data reference
```

## Key Requirements

### Ticket Model
Each ticket must have:
- **id**: UUID (auto-generated)
- **customer_id**: string (required)
- **customer_email**: valid email format (required)
- **customer_name**: string (required)
- **subject**: 1-200 characters (required)
- **description**: 10-2000 characters (required)
- **category**: One of [account_access, technical_issue, billing_question, feature_request, bug_report, other]
- **priority**: One of [urgent, high, medium, low]
- **status**: One of [new, in_progress, waiting_customer, resolved, closed]
- **created_at**: ISO datetime (auto-set)
- **updated_at**: ISO datetime (auto-updated)
- **resolved_at**: ISO datetime (nullable, set when resolved)
- **assigned_to**: string (nullable, staff member name)
- **tags**: string array (optional labels)
- **metadata**: source, browser, device_type (optional context)

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets` | Create a single ticket |
| POST | `/tickets/import` | Bulk import from file |
| GET | `/tickets` | List all tickets (supports filtering) |
| GET | `/tickets/:id` | Get specific ticket |
| PUT | `/tickets/:id` | Update ticket |
| DELETE | `/tickets/:id` | Delete ticket |

### Validation Rules
- **Email**: Must be valid email format
- **String lengths**: Enforce min/max as specified
- **Enums**: Reject invalid category/priority/status values
- **Required fields**: customer_id, customer_email, customer_name, subject, description (at minimum)
- **Return errors**: Detailed validation error messages with field names

### Error Handling
- **400 Bad Request**: Validation failures (detailed error list)
- **404 Not Found**: Ticket doesn't exist
- **409 Conflict**: Business logic violations
- **500 Internal Server Error**: Unexpected errors (with request ID for debugging)
- **Bulk import**: Return summary with successful/failed counts and error details per record

### Import Format Support
- **CSV**: Standard comma-separated, support quoted fields
- **JSON**: Array of ticket objects or single object
- **XML**: Flat or nested structure (auto-detect)
- **Error recovery**: Continue processing on individual record failures

## Development Phases

### Phase 1: API Foundation (This Sprint)
- ✅ Project setup
- ✅ Core API with CRUD operations
- ✅ In-memory storage
- ✅ Input validation
- ✅ Bulk import with CSV/JSON/XML support
- ✅ Comprehensive tests
- ✅ API documentation

### Phase 2: AI Integration (Future)
- Claude API integration for auto-categorization
- Context-Model-Prompt framework application
- Priority assignment using AI
- Enhanced documentation with AI tools

## Environment Variables

Create `.env` file (see `.env.example`):
```
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

## Testing Strategy

- **56 tests** across 8 dedicated test files (see [TESTING_GUIDE.md](./TESTING_GUIDE.md))
- **Fixtures**: `tests/fixtures/` contains valid, mixed, and invalid sample files
- **Coverage Target**: >85% code coverage
- See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for full manual testing checklist and performance benchmarks

## Next Steps

1. Read [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for step-by-step implementation guide
2. Review [API_REFERENCE.md](./API_REFERENCE.md) for detailed endpoint specifications and cURL examples
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design diagrams and trade-off decisions
4. Review [TESTING_GUIDE.md](./TESTING_GUIDE.md) for QA checklist and performance benchmarks
5. Run tests frequently to catch issues early (`npm run test:coverage`)

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Guide](https://jestjs.io/)
- [Zod Validation Library](https://zod.dev/)
