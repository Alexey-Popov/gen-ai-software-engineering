# Customer Support Ticket Management System

## Project Goal

Build a Node.js + TypeScript REST API for managing customer support tickets with multi-format import, in-memory storage, and AI-ready infrastructure for categorization and priority assignment.

## Tech Stack

- **Runtime**: Node.js v18+
- **Language**: TypeScript (strict mode)
- **Framework**: Express.js
- **Testing**: Jest + Supertest (80%+ coverage target)
- **Validation**: Zod schema validation
- **File Parsing**: csv-parse, fast-xml-parser
- **Utilities**: uuid, nodemon

## Architecture

### File Structure
```
src/
├── routes/                    # Express route handlers
│   ├── tickets.ts            # Ticket CRUD: POST, GET, PUT, DELETE
│   └── import.ts             # Bulk import: POST /tickets/import
├── models/                    # Type definitions
│   └── ticket.ts             # Interfaces, enums, types
├── validators/               # Input validation
│   ├── ticket-validator.ts   # Ticket field validation (Zod)
│   └── import-validator.ts   # File format validation
├── services/                 # Business logic layer
│   ├── ticket-service.ts     # CRUD operations, in-memory storage
│   └── import-service.ts     # Bulk import orchestration
├── utils/                    # Helper functions
│   ├── file-parser.ts        # CSV/JSON/XML parsing
│   ├── error-handler.ts      # Error mapping & responses
│   └── logger.ts             # Logging utility
├── app.ts                    # Express middleware setup
└── index.ts                  # Server entry point (port 3000)

tests/
├── unit/                     # Unit tests for validators, services, utils
└── integration/              # Integration tests for API endpoints

fixtures/                    # Sample data for testing imports
├── valid-tickets.csv
├── valid-tickets.json
├── valid-tickets.xml
└── mixed-tickets.csv
```

### Key Patterns

**Services handle all business logic** — Use `ticket-service.ts` for any data operation:
- `createTicket(payload)`, `getTicket(id)`, `getAllTickets(filters)`, `updateTicket(id, updates)`, `deleteTicket(id)`
- In-memory storage: `Map<id, Ticket>`

**Validators enforce all constraints** — Use Zod schemas in `ticket-validator.ts`:
- Email format, string lengths, enum values, required fields
- Return detailed error messages with field names
- Continue processing on individual failures in bulk import

**File parsing is format-agnostic** — `file-parser.ts` handles:
- CSV with quoted fields and empty lines
- JSON (array or single object, normalized to array)
- XML (flat or nested, auto-detected)
- Returns `Record<string, unknown>[]`

**Error responses are consistent** — Always return:
```json
{
  "error": "Human-readable message",
  "details": [{"field": "name", "message": "..."}],
  "requestId": "req-123"
}
```

## Ticket Model

**Enums**:
- `Category`: account_access, technical_issue, billing_question, feature_request, bug_report, other
- `Priority`: urgent, high, medium, low
- `Status`: new, in_progress, waiting_customer, resolved, closed
- `Source`: web_form, email, api, chat, phone
- `DeviceType`: desktop, mobile, tablet

**Required Fields**:
- `id` (UUID, auto-generated)
- `customer_id` (string)
- `customer_email` (valid email)
- `customer_name` (string)
- `subject` (1-200 chars)
- `description` (10-2000 chars)
- `category` (enum)
- `priority` (enum)
- `status` (enum)
- `created_at`, `updated_at` (ISO datetime, auto-set)

**Optional Fields**:
- `resolved_at` (datetime, set when status = resolved)
- `assigned_to` (staff name)
- `tags` (string array)
- `metadata` (source, browser, device_type)

## REST API

**6 Endpoints** (in `routes/tickets.ts` and `routes/import.ts`):

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/tickets` | 201 | Create single ticket |
| GET | `/tickets` | 200 | List all (supports filtering by category, priority, status, customer_id, assigned_to) |
| GET | `/tickets/:id` | 200/404 | Get single ticket |
| PUT | `/tickets/:id` | 200/404 | Update ticket (partial updates only) |
| DELETE | `/tickets/:id` | 204/404 | Delete ticket |
| POST | `/tickets/import` | 200 | Bulk import CSV/JSON/XML with error recovery |

**Import Response** (success with some failures):
```json
{
  "total": 50,
  "successful": 48,
  "failed": 2,
  "errors": [
    {
      "recordIndex": 5,
      "errors": {
        "email": "Invalid email format",
        "subject": "Too short"
      }
    }
  ]
}
```

## Testing

- **Unit tests** (`tests/unit/`): Validators, services, utilities
- **Integration tests** (`tests/integration/`): API endpoints with realistic data
- **Fixtures** (`tests/fixtures/`): Sample CSV/JSON/XML files
- **Target**: 85%+ code coverage (validators/services 95%+, routes 80%+)

Run tests:
```bash
npm test              # All tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## How to Extend

### Add New Category/Priority
1. Update enums in `src/models/ticket.ts`
2. Update Zod schema in `src/validators/ticket-validator.ts`
3. Update tests to cover new values
4. When using AI (Phase 2), update prompt in `src/services/classifier.ts`

### Add New File Format (Phase 1+)
1. Implement parser in `src/utils/file-parser.ts`: `parseXYZ(content: string): Record<string, unknown>[]`
2. Update format detection logic in `import-service.ts`
3. Add tests and fixtures in `tests/fixtures/`

### Add AI Categorization (Phase 2)
1. Create `src/services/classifier.ts` with Claude SDK integration
2. Define Context (categories, rules) → Model (Sonnet 4.6) → Prompt
3. Call classifier before saving ticket in `ticket-service.ts`
4. Cache results if high volume

## Important Constraints

- **In-memory only**: No database. Data lost on server restart. Fine for MVP.
- **No authentication**: All endpoints public. Add auth in production.
- **Strict validation**: Reject invalid data immediately with detailed errors.
- **Error recovery**: Bulk import continues on failures, reports summary.
- **Timestamps**: Auto-managed by service (created_at, updated_at, resolved_at).

## Development Flow

1. **Phase 1** (In progress): Core API + import + tests
   - See `DEVELOPMENT_PLAN.md` for detailed tasks
   - Focus on validation, CRUD, file parsing, test coverage
   
2. **Phase 2** (Future): AI integration
   - Use Context-Model-Prompt framework
   - Integrate Claude API for auto-categorization/priority
   - Expand documentation with AI tools

## Environment

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

## Commands

```bash
npm run dev           # Start with hot-reload (nodemon)
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled app
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Documentation Files

- **INSTRUCTIONS.md** — User setup guide and quick reference
- **DEVELOPMENT_PLAN.md** — Step-by-step implementation with checkboxes
- **API.md** — Detailed endpoint docs (endpoint reference, examples, error codes)
- **This file (CLAUDE.md)** — Architecture for Claude

## Key Files to Know

- `src/services/ticket-service.ts` — All data operations
- `src/validators/ticket-validator.ts` — All validation logic
- `src/utils/file-parser.ts` — Format detection and parsing
- `src/routes/tickets.ts` — CRUD endpoints
- `src/routes/import.ts` — Bulk import endpoint
- `tests/integration/api.test.ts` — Full API test suite
