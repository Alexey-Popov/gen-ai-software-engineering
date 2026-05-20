# Development Plan - Customer Support Ticket Management System

## Overview

This document outlines the step-by-step development plan to build the customer support ticket management system. The plan is organized into 5 phases, with clear deliverables for each phase.

**Estimated Timeline**: 2-3 weeks for Phase 1 (MVP)

---

## Phase 1: Project Foundation & Setup

### Objective
Set up the Node.js + TypeScript project with all necessary dependencies and configuration.

### Tasks

#### 1.1 Initialize Node.js Project
- [x] Create `package.json` with project metadata
- [x] Install core dependencies:
  - `express` — HTTP server framework
  - `typescript` — TypeScript compiler
  - `ts-node` — Run TS directly
  - `uuid` — Generate unique IDs
- [x] Install dev dependencies:
  - `@types/node`, `@types/express` — Type definitions
  - `ts-jest`, `jest`, `@types/jest` — Testing framework
  - `supertest` — HTTP testing library
  - `nodemon` — Auto-restart on file changes
  - `zod` — Schema validation
- [x] Create `.gitignore` file

**Deliverable**: `package.json` with all dependencies installed ✅

---

#### 1.2 Configure TypeScript
- [x] Create `tsconfig.json` with:
  - Target: ES2020
  - Module: commonjs
  - Strict mode enabled
  - Strict null checks enabled
  - Source and output directories configured
- [x] Create `tsconfig.build.json` (for production builds)

**Deliverable**: Working TypeScript configuration ✅

---

#### 1.3 Configure Jest Testing
- [x] Create `jest.config.js` with:
  - ts-jest preset
  - Test directory patterns
  - Coverage thresholds (80% minimum)
  - Module name mapper for path aliases
- [x] Create test directory structure: `tests/unit/` and `tests/integration/`

**Deliverable**: Jest ready to run tests ✅

---

#### 1.4 Setup npm Scripts
- [x] Add scripts to `package.json`:
  ```json
  {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
  ```

**Deliverable**: Runnable npm commands ✅

---

#### 1.5 Create Environment Configuration
- [x] Create `.env.example` with:
  ```
  NODE_ENV=development
  PORT=3000
  LOG_LEVEL=debug
  ```
- [x] Create `src/config.ts` to load and validate environment variables

**Deliverable**: Environment variable system ready ✅

---

### Phase 1 Completion Criteria
- ✅ Project builds without errors — `npm run build` passes
- ✅ Can run `npm run dev` and start server on port 3000
- ✅ Can run `npm test` — Jest configured (no tests yet, expected)
- ✅ TypeScript compiles with strict mode enabled
- ✅ All config files in place: `tsconfig.json`, `jest.config.js`, `.env.example`
- ✅ Folder structure created: `src/routes/`, `models/`, `validators/`, `services/`, `utils/`

**Status: COMPLETE** ✅

---

## Phase 2: Data Models & Validation

### Objective
Define TypeScript types and implement comprehensive validation logic.

### Tasks

#### 2.1 Create Ticket Model Types
**File**: `src/models/ticket.ts`

- [x] Define enums:
  ```typescript
  enum Category { ... }
  enum Priority { ... }
  enum Status { ... }
  enum Source { ... }
  enum DeviceType { ... }
  ```
- [x] Define interfaces:
  ```typescript
  interface Metadata { ... }
  interface Ticket { ... }
  interface CreateTicketPayload { ... }
  interface UpdateTicketPayload { ... }
  interface ImportResult { ... }
  ```

**Deliverable**: Complete type definitions in `src/models/ticket.ts` ✅

---

#### 2.2 Implement Ticket Validator
**File**: `src/validators/ticket-validator.ts`

Using Zod schema validation, create:
- [x] Schema for creating a new ticket
- [x] Schema for updating a ticket
- [x] Helper functions:
  - `validateCreateTicket(data: unknown): Ticket`
  - `validateUpdateTicket(data: unknown, current: Ticket): Partial<Ticket>`
  - `validateEmail(email: string): boolean`
  - `validateStringLength(str: string, min: number, max: number): boolean`

**Test Coverage**:
- [x] Valid tickets pass validation
- [x] Invalid emails are rejected
- [x] String length boundaries enforced
- [x] Invalid enums rejected
- [x] Required fields validated
- [x] Detailed error messages returned

**Deliverable**: `src/validators/ticket-validator.ts` with 100% test coverage ✅

---

#### 2.3 Implement Import File Validator
**File**: `src/validators/import-validator.ts`

- [x] Validate CSV structure
- [x] Validate JSON structure
- [x] Validate XML structure
- [x] Provide detailed error reporting per record:
  ```typescript
  interface ValidationError {
    recordIndex: number;
    errors: Record<string, string>;
  }
  ```

**Deliverable**: Import validator with specific error messages ✅

---

### Phase 2 Completion Criteria
- ✅ All models compile without type errors
- ✅ Validators reject invalid data appropriately
- ✅ Error messages are clear and helpful
- ✅ Unit tests pass with 100% coverage

**Status: COMPLETE** ✅

---

## Phase 3: Core Services & Business Logic

### Objective
Implement ticket storage and retrieval logic.

### Tasks

#### 3.1 Implement Ticket Service
**File**: `src/services/ticket-service.ts`

In-memory storage using a Map:

- [ ] `createTicket(payload: CreateTicketPayload): Ticket`
  - Validate input
  - Generate UUID and timestamps
  - Store in memory
  - Return created ticket
  
- [ ] `getTicket(id: string): Ticket | null`
  - Fetch from memory
  - Return null if not found
  
- [ ] `getAllTickets(filters?: FilterOptions): Ticket[]`
  - Support filtering by:
    - category
    - priority
    - status
    - customer_id
    - assigned_to
  - Return matching tickets
  
- [ ] `updateTicket(id: string, updates: Partial<Ticket>): Ticket | null`
  - Validate id exists
  - Merge updates
  - Update `updated_at` timestamp
  - Return updated ticket
  
- [ ] `deleteTicket(id: string): boolean`
  - Remove from memory
  - Return success status
  
- [ ] `resolveTicket(id: string, assignedTo?: string): Ticket | null`
  - Set status to 'resolved'
  - Set resolved_at timestamp
  - Optionally set assigned_to

**Test Coverage**:
- [ ] Create with valid data
- [ ] Create rejects invalid data
- [ ] Get existing/non-existing tickets
- [ ] Update modifies fields correctly
- [ ] Delete removes ticket
- [ ] Filters work correctly
- [ ] Timestamps auto-update

**Deliverable**: `src/services/ticket-service.ts` with 95%+ test coverage

---

#### 3.2 Implement Import Service
**File**: `src/services/import-service.ts`

- [ ] `importTickets(fileContent: string, format: 'csv' | 'json' | 'xml'): ImportResult`
  - Parse file format
  - Validate each record
  - Create successful tickets
  - Collect errors for failed records
  - Return summary with counts and errors
  
- [ ] Error handling strategy:
  - Continue processing on individual failures
  - Provide row/record numbers in errors
  - Return partial success

**Test Coverage**:
- [ ] Valid CSV import succeeds
- [ ] Valid JSON import succeeds
- [ ] Valid XML import succeeds
- [ ] Malformed records reported with line numbers
- [ ] Mixed valid/invalid records processed
- [ ] Empty files handled gracefully
- [ ] Unsupported format rejected

**Deliverable**: `src/services/import-service.ts` with import logic

---

#### 3.3 Implement File Parser Utility
**File**: `src/utils/file-parser.ts`

- [ ] `parseCSV(content: string): Record<string, unknown>[]`
  - Handle quoted fields
  - Handle empty lines
  - Return array of objects with header keys
  
- [ ] `parseJSON(content: string): unknown`
  - Parse JSON safely
  - Handle both array and single object
  - Normalize to array
  
- [ ] `parseXML(content: string): Record<string, unknown>[]`
  - Auto-detect structure (flat or nested)
  - Convert to array of objects
  - Handle attributes and text content

**Test Coverage**:
- [ ] Each format parsed correctly
- [ ] Edge cases (empty fields, special chars, etc.)
- [ ] Malformed input gives clear errors
- [ ] Unicode handled correctly

**Deliverable**: `src/utils/file-parser.ts` with parser functions

---

### Phase 3 Completion Criteria
- ✅ Services implement complete CRUD operations
- ✅ In-memory storage works correctly
- ✅ Import supports CSV, JSON, XML
- ✅ Error handling is comprehensive
- ✅ All services have 95%+ test coverage

---

## Phase 4: REST API Routes & Error Handling

### Objective
Implement Express routes for all API endpoints with proper error handling.

### Tasks

#### 4.1 Setup Express App
**File**: `src/app.ts`

- [ ] Create Express app with middleware:
  - `express.json()` — Parse JSON bodies
  - `express.text()` — Parse plain text (for imports)
  - Error handling middleware
  - Request logging middleware
  
- [ ] Setup CORS if needed
- [ ] Setup request ID tracking for errors

**Deliverable**: Express app configured and ready

---

#### 4.2 Implement Ticket Routes
**File**: `src/routes/tickets.ts`

- [ ] `POST /tickets` — Create single ticket
  - Validate payload
  - Call ticket service
  - Return 201 with created ticket
  
- [ ] `GET /tickets` — List with filtering
  - Accept query parameters for filters
  - Call service with filters
  - Return 200 with ticket array
  
- [ ] `GET /tickets/:id` — Get single ticket
  - Validate UUID format
  - Return 200 or 404
  
- [ ] `PUT /tickets/:id` — Update ticket
  - Validate id exists
  - Validate update payload
  - Return 200 with updated ticket or 404
  
- [ ] `DELETE /tickets/:id` — Delete ticket
  - Return 204 on success or 404

**Error Responses**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "requestId": "req-123"
}
```

**Test Coverage**:
- [ ] Each endpoint with valid data
- [ ] Each endpoint with invalid data
- [ ] 404 for non-existent IDs
- [ ] Proper HTTP status codes
- [ ] Response format consistency

**Deliverable**: `src/routes/tickets.ts` with all CRUD endpoints

---

#### 4.3 Implement Import Routes
**File**: `src/routes/import.ts`

- [ ] `POST /tickets/import` — Bulk import
  - Accept file upload (multipart/form-data) or raw file content
  - Detect format (CSV, JSON, XML)
  - Call import service
  - Return 200 with import summary:
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

**Test Coverage**:
- [ ] CSV import with valid/invalid records
- [ ] JSON import
- [ ] XML import
- [ ] Detect format automatically
- [ ] Return proper summary
- [ ] Handle file upload vs raw content

**Deliverable**: `src/routes/import.ts` with bulk import endpoint

---

#### 4.4 Implement Global Error Handler
**File**: `src/utils/error-handler.ts`

- [ ] Custom error classes:
  - `ValidationError`
  - `NotFoundError`
  - `ConflictError`
  - `ServerError`
  
- [ ] Express error middleware that:
  - Catches all errors
  - Assigns request ID
  - Maps to appropriate HTTP status
  - Returns consistent error format
  - Logs errors for debugging

**Deliverable**: Error handling system with middleware

---

#### 4.5 Create Server Entry Point
**File**: `src/index.ts`

- [ ] Load environment
- [ ] Create Express app
- [ ] Register routes
- [ ] Register error middleware
- [ ] Start listening on PORT
- [ ] Log startup message

**Deliverable**: Server starts correctly on `npm run dev`

---

### Phase 4 Completion Criteria
- ✅ All 6 endpoints functional
- ✅ All HTTP status codes correct
- ✅ Error responses consistent
- ✅ File upload works
- ✅ Integration tests pass
- ✅ No unhandled promise rejections

---

## Phase 5: Testing & Documentation

### Objective
Achieve comprehensive test coverage and create clear documentation.

### Tasks

#### 5.1 Unit Tests
**File**: `tests/unit/`

- [ ] Validator tests
  - Valid/invalid inputs
  - Edge cases (boundary values)
  - Error messages

- [ ] Service tests
  - CRUD operations
  - Filtering logic
  - Import logic
  - Error conditions

- [ ] Utility tests
  - File parsing
  - Format detection
  - Error handling

**Target**: 95%+ coverage

---

#### 5.2 Integration Tests
**File**: `tests/integration/api.test.ts`

- [ ] Endpoint tests using Supertest:
  - Create ticket flow
  - Read operations
  - Update operations
  - Delete operations
  - Import flow with real files
  - Error scenarios

- [ ] Test fixtures:
  - `tests/fixtures/valid.csv`
  - `tests/fixtures/valid.json`
  - `tests/fixtures/valid.xml`
  - `tests/fixtures/invalid.csv`
  - Sample tickets for testing

**Target**: 80%+ overall coverage

---

#### 5.3 Create API Documentation
**File**: `API.md`

Document each endpoint:
- [ ] Request/response examples
- [ ] Query parameter descriptions
- [ ] Error codes and messages
- [ ] Sample cURL commands
- [ ] Postman collection (optional)

**Sections**:
- Authentication (if applicable)
- Base URL
- Rate limiting (if applicable)
- Endpoint reference
- Error codes
- Examples

---

#### 5.4 Update INSTRUCTIONS.md
- [ ] Verify all instructions are current
- [ ] Add troubleshooting section
- [ ] Add common issues and solutions
- [ ] Add performance tips

---

#### 5.5 Create Test Fixtures
**Directory**: `tests/fixtures/`

- [ ] `valid-tickets.csv` — Sample CSV with 10 valid tickets
- [ ] `valid-tickets.json` — Sample JSON with valid tickets
- [ ] `valid-tickets.xml` — Sample XML with valid tickets
- [ ] `mixed-tickets.csv` — CSV with valid and invalid records
- [ ] `invalid-tickets.csv` — CSV with all invalid records

---

### Phase 5 Completion Criteria
- ✅ 85%+ overall code coverage
- ✅ All tests passing
- ✅ API documentation complete
- [ ] README updated with full instructions
- ✅ No linting errors (if ESLint added)

---

## Context-Model-Prompt Application

### Where CMP Applies (Phase 2 - Future)

When implementing AI-powered categorization and priority assignment:

**Context**:
- Category definitions and business rules
- Priority assignment criteria
- Company-specific ticket patterns
- Past ticket categorization examples (if available)

**Model**:
- Use Claude Sonnet 4.6 (balanced speed/cost)
- Configure for deterministic output (low temperature)
- Use token usage optimization (if high volume)

**Prompt**:
- Clear categorization instructions
- Priority assignment rules
- Output format requirements
- Few-shot examples of categorizations

Example prompt structure:
```
You are a customer support ticket categorizer.

[CONTEXT]
Categories and their definitions:
- account_access: Issues with login, password, account recovery
- technical_issue: Software bugs, feature requests, technical problems
...

[RULES]
- If ticket mentions password or login → account_access
- If ticket mentions crash or error → technical_issue
...

[TASK]
Analyze the following ticket and assign category and priority.

[TICKET]
{ticket details}

[OUTPUT FORMAT]
Return JSON:
{
  "category": "...",
  "priority": "...",
  "reasoning": "..."
}
```

This approach ensures consistent, explainable categorization.

---

## Success Metrics

✅ **Functionality**
- All 6 endpoints working correctly
- All file formats (CSV/JSON/XML) imported successfully
- Full CRUD operations functional

✅ **Quality**
- 85%+ code coverage
- All tests passing
- No console errors or warnings

✅ **Documentation**
- API documentation complete
- Code comments for complex logic
- README with setup instructions

✅ **Code Quality**
- TypeScript strict mode
- Consistent error handling
- Clean code structure

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Setup | 2-3 hours | ✅ Complete |
| Phase 2: Models & Validation | 4-5 hours | ✅ Complete |
| Phase 3: Services | 6-8 hours | ⏳ Pending |
| Phase 4: Routes & Errors | 6-8 hours | ⏳ Pending |
| Phase 5: Testing & Docs | 6-8 hours | ⏳ Pending |
| **Total** | **24-32 hours** | |

---

## Notes

- Refer back to [INSTRUCTIONS.md](./INSTRUCTIONS.md) for setup details
- Keep validation strict — better to reject invalid data than process it
- Write tests as you code, not after
- For Phase 2 (AI integration), use this plan as a template and extend with API calls
