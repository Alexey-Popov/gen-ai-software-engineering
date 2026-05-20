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

- [x] `createTicket(payload: CreateTicketPayload): Ticket`
  - Validate input
  - Generate UUID and timestamps
  - Store in memory
  - Return created ticket
  
- [x] `getTicket(id: string): Ticket | null`
  - Fetch from memory
  - Return null if not found
  
- [x] `getAllTickets(filters?: FilterOptions): Ticket[]`
  - Support filtering by:
    - category
    - priority
    - status
    - customer_id
    - assigned_to
  - Return matching tickets
  
- [x] `updateTicket(id: string, updates: Partial<Ticket>): Ticket | null`
  - Validate id exists
  - Merge updates
  - Update `updated_at` timestamp
  - Return updated ticket
  
- [x] `deleteTicket(id: string): boolean`
  - Remove from memory
  - Return success status
  
- [x] `resolveTicket(id: string, assignedTo?: string): Ticket | null`
  - Set status to 'resolved'
  - Set resolved_at timestamp
  - Optionally set assigned_to

**Test Coverage**:
- [x] Create with valid data
- [x] Create rejects invalid data
- [x] Get existing/non-existing tickets
- [x] Update modifies fields correctly
- [x] Delete removes ticket
- [x] Filters work correctly
- [x] Timestamps auto-update

**Deliverable**: `src/services/ticket-service.ts` with 95%+ test coverage ✅

---

#### 3.2 Implement Import Service
**File**: `src/services/import-service.ts`

- [x] `importTickets(fileContent: string, format: 'csv' | 'json' | 'xml'): ImportResult`
  - Parse file format
  - Validate each record
  - Create successful tickets
  - Collect errors for failed records
  - Return summary with counts and errors
  
- [x] Error handling strategy:
  - Continue processing on individual failures
  - Provide row/record numbers in errors
  - Return partial success

**Test Coverage**:
- [x] Valid CSV import succeeds
- [x] Valid JSON import succeeds
- [x] Valid XML import succeeds
- [x] Malformed records reported with line numbers
- [x] Mixed valid/invalid records processed
- [x] Empty files handled gracefully
- [x] Unsupported format rejected

**Deliverable**: `src/services/import-service.ts` with import logic ✅

---

#### 3.3 Implement File Parser Utility
**File**: `src/utils/file-parser.ts`

- [x] `parseCSV(content: string): Record<string, unknown>[]`
  - Handle quoted fields
  - Handle empty lines
  - Return array of objects with header keys
  
- [x] `parseJSON(content: string): unknown`
  - Parse JSON safely
  - Handle both array and single object
  - Normalize to array
  
- [x] `parseXML(content: string): Record<string, unknown>[]`
  - Auto-detect structure (flat or nested)
  - Convert to array of objects
  - Handle attributes and text content

**Test Coverage**:
- [x] Each format parsed correctly
- [x] Edge cases (empty fields, special chars, etc.)
- [x] Malformed input gives clear errors
- [x] Unicode handled correctly

**Deliverable**: `src/utils/file-parser.ts` with parser functions ✅

---

### Phase 3 Completion Criteria
- ✅ Services implement complete CRUD operations
- ✅ In-memory storage works correctly
- ✅ Import supports CSV, JSON, XML
- ✅ Error handling is comprehensive
- ✅ All services have 95%+ test coverage

**Status: COMPLETE** ✅

---

## Phase 4: REST API Routes & Error Handling

### Objective
Implement Express routes for all API endpoints with proper error handling.

### Tasks

#### 4.1 Setup Express App
**File**: `src/app.ts`

- [x] Create Express app with middleware:
  - `express.json()` — Parse JSON bodies
  - `express.text()` — Parse plain text (for imports)
  - Error handling middleware
  - Request logging middleware
  
- [x] Setup request ID tracking for errors

**Deliverable**: Express app configured and ready ✅

---

#### 4.2 Implement Ticket Routes
**File**: `src/routes/tickets.ts`

- [x] `POST /tickets` — Create single ticket
  - Validate payload
  - Call ticket service
  - Return 201 with created ticket
  
- [x] `GET /tickets` — List with filtering
  - Accept query parameters for filters
  - Call service with filters
  - Return 200 with ticket array
  
- [x] `GET /tickets/:id` — Get single ticket
  - Return 200 or 404
  
- [x] `PUT /tickets/:id` — Update ticket
  - Validate id exists
  - Validate update payload
  - Return 200 with updated ticket or 404
  
- [x] `DELETE /tickets/:id` — Delete ticket
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
- [x] Each endpoint with valid data
- [x] Each endpoint with invalid data
- [x] 404 for non-existent IDs
- [x] Proper HTTP status codes
- [x] Response format consistency

**Deliverable**: `src/routes/tickets.ts` with all CRUD endpoints ✅

---

#### 4.3 Implement Import Routes
**File**: `src/routes/import.ts`

- [x] `POST /tickets/import` — Bulk import
  - Accept raw file content or pre-parsed JSON body
  - Auto-detect format from Content-Type header, `?format=` query param, or content shape
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
- [x] CSV import with valid/invalid records
- [x] JSON import
- [x] XML import
- [x] Detect format automatically
- [x] Return proper summary
- [x] Handle raw content and pre-parsed JSON body

**Deliverable**: `src/routes/import.ts` with bulk import endpoint ✅

---

#### 4.4 Implement Global Error Handler
**File**: `src/utils/error-handler.ts`

- [x] Custom error classes:
  - `ValidationError`
  - `NotFoundError`
  - `ConflictError`
  - `ServerError`
  
- [x] Express error middleware that:
  - Catches all errors
  - Assigns request ID
  - Maps to appropriate HTTP status
  - Returns consistent error format

**Deliverable**: Error handling system with middleware ✅

---

#### 4.5 Create Server Entry Point
**File**: `src/index.ts`

- [x] Load environment
- [x] Create Express app
- [x] Register routes
- [x] Register error middleware
- [x] Start listening on PORT
- [x] Log startup message

**Deliverable**: Server starts correctly on `npm run dev` ✅

---

### Phase 4 Completion Criteria
- ✅ All 6 endpoints functional
- ✅ All HTTP status codes correct
- ✅ Error responses consistent
- ✅ File import works (CSV, JSON, XML)
- ✅ Integration tests pass (27 tests)
- ✅ No unhandled promise rejections

**Status: COMPLETE** ✅

---

## Phase 5: Testing & Documentation

### Objective
Achieve >85% code coverage with a structured test suite and produce five audience-specific documentation files, each using different AI models and containing Mermaid diagrams.

---

### Part A: Test Suite

#### 5.1 Test File Structure

```
tests/
├── test_ticket_api.ts        # API endpoint tests (11 tests)
├── test_ticket_model.ts      # Data validation tests (9 tests)
├── test_import_csv.ts        # CSV parsing tests (6 tests)
├── test_import_json.ts       # JSON parsing tests (5 tests)
├── test_import_xml.ts        # XML parsing tests (5 tests)
├── test_categorization.ts    # AI classification tests (10 tests)
├── test_integration.ts       # End-to-end workflow tests (5 tests)
├── test_performance.ts       # Benchmark tests (5 tests)
└── fixtures/                 # Sample data files
    ├── valid-tickets.csv
    ├── valid-tickets.json
    ├── valid-tickets.xml
    ├── mixed-tickets.csv
    └── invalid-tickets.csv
```

---

#### 5.2 `test_ticket_api.ts` — API Endpoint Tests (11 tests)

**File**: `tests/test_ticket_api.ts`

- [ ] `POST /tickets` returns 201 with created ticket
- [ ] `POST /tickets` returns 400 on missing required fields
- [ ] `POST /tickets` returns 400 on invalid email
- [ ] `GET /tickets` returns 200 with array of tickets
- [ ] `GET /tickets?status=new` filters by status
- [ ] `GET /tickets?priority=urgent` filters by priority
- [ ] `GET /tickets/:id` returns 200 for existing ticket
- [ ] `GET /tickets/:id` returns 404 for unknown id
- [ ] `PUT /tickets/:id` returns 200 with updated ticket
- [ ] `PUT /tickets/:id` returns 404 for unknown id
- [ ] `DELETE /tickets/:id` returns 204 on success

**Target**: 100% route coverage

---

#### 5.3 `test_ticket_model.ts` — Data Validation Tests (9 tests)

**File**: `tests/test_ticket_model.ts`

- [ ] Valid ticket payload passes Zod schema
- [ ] Missing `customer_email` is rejected
- [ ] Invalid email format is rejected
- [ ] `subject` shorter than 1 char is rejected
- [ ] `subject` longer than 200 chars is rejected
- [ ] `description` shorter than 10 chars is rejected
- [ ] Unknown `category` enum value is rejected
- [ ] Unknown `priority` enum value is rejected
- [ ] Optional fields (`tags`, `metadata`) are accepted when absent

**Target**: 100% validator coverage

---

#### 5.4 `test_import_csv.ts` — CSV Parsing Tests (6 tests)

**File**: `tests/test_import_csv.ts`

- [ ] Valid CSV with 10 rows imports all records successfully
- [ ] CSV with quoted fields (commas inside values) parsed correctly
- [ ] CSV with missing optional columns succeeds
- [ ] CSV with invalid email in one row reports error and continues
- [ ] Empty CSV file returns zero successful, zero failed
- [ ] CSV with duplicate header columns returns descriptive error

**Target**: 100% CSV parser coverage

---

#### 5.5 `test_import_json.ts` — JSON Parsing Tests (5 tests)

**File**: `tests/test_import_json.ts`

- [ ] Valid JSON array imports all records
- [ ] Single JSON object (not array) is normalized and imported
- [ ] JSON with one invalid record reports error for that record only
- [ ] Malformed JSON string returns parse error
- [ ] Empty JSON array (`[]`) returns zero successful, zero failed

**Target**: 100% JSON parser coverage

---

#### 5.6 `test_import_xml.ts` — XML Parsing Tests (5 tests)

**File**: `tests/test_import_xml.ts`

- [ ] Valid XML with nested `<ticket>` elements imports all records
- [ ] XML with flat attributes-only structure is parsed correctly
- [ ] XML with one invalid record reports error and continues
- [ ] Malformed XML returns parse error
- [ ] Empty `<tickets/>` element returns zero successful, zero failed

**Target**: 100% XML parser coverage

---

#### 5.7 `test_categorization.ts` — AI Classification Tests (10 tests)

**File**: `tests/test_categorization.ts`

- [ ] Ticket mentioning "password" is classified as `account_access`
- [ ] Ticket mentioning "crash" is classified as `technical_issue`
- [ ] Ticket mentioning "charge" or "invoice" is classified as `billing_question`
- [ ] Ticket requesting a new feature is classified as `feature_request`
- [ ] Ticket describing a reproducible defect is classified as `bug_report`
- [ ] Ambiguous ticket falls back to `other` category
- [ ] "server down" subject maps to `urgent` priority
- [ ] "minor cosmetic issue" maps to `low` priority
- [ ] Classifier response includes `reasoning` field
- [ ] Classifier handles API timeout gracefully (falls back to `other`/`medium`)

**Target**: 95%+ classifier service coverage

---

#### 5.8 `test_integration.ts` — End-to-End Workflow Tests (5 tests)

**File**: `tests/test_integration.ts`

- [ ] Full create → read → update → delete lifecycle for a single ticket
- [ ] Bulk CSV import followed by `GET /tickets` returns all imported tickets
- [ ] Create ticket → classify → verify category persisted in response
- [ ] Invalid bulk import with mixed records returns correct `successful`/`failed` counts
- [ ] Concurrent `POST /tickets` requests all succeed without data loss

**Target**: Validates cross-component interactions

---

#### 5.9 `test_performance.ts` — Benchmark Tests (5 tests)

**File**: `tests/test_performance.ts`

- [ ] `POST /tickets` responds in < 100 ms under no load
- [ ] `GET /tickets` with 1 000 in-memory tickets responds in < 200 ms
- [ ] Bulk import of 500-record CSV completes in < 2 s
- [ ] 50 concurrent `GET /tickets` requests all complete without error
- [ ] Memory usage after importing 1 000 tickets stays below 100 MB

**Target**: Establish baseline benchmarks; fail if thresholds exceeded

---

#### 5.10 Test Fixtures

**Directory**: `tests/fixtures/`

- [ ] `valid-tickets.csv` — 10 valid tickets covering all categories and priorities
- [ ] `valid-tickets.json` — JSON array of 10 valid tickets
- [ ] `valid-tickets.xml` — XML document with 10 `<ticket>` elements
- [ ] `mixed-tickets.csv` — 10 rows: 8 valid + 2 with intentional errors
- [ ] `invalid-tickets.csv` — 5 rows all with validation errors

---

### Part B: Documentation

Five audience-specific documentation files, generated with different AI models and containing at least 3 Mermaid diagrams in total.

#### 5.11 `README.md` — Developer Guide

**Model**: Claude Haiku 4.5 (fast generation, developer-friendly tone)

- [ ] Project overview and feature list
- [ ] Architecture diagram (Mermaid `graph TD`) — **Mermaid diagram #1**
- [ ] Installation and setup instructions (`npm install`, `.env` setup)
- [ ] How to run tests (`npm test`, `npm run test:coverage`)
- [ ] Project folder structure with brief description of each directory

---

#### 5.12 `API_REFERENCE.md` — API Consumer Reference

**Model**: Claude Sonnet 4.6 (balanced accuracy for technical docs)

- [ ] All 6 endpoints with full request/response JSON examples
- [ ] Data models and Zod-validated field schemas
- [ ] Error response format with all error codes
- [ ] cURL example for every endpoint
- [ ] Query parameter table for `GET /tickets`

---

#### 5.13 `ARCHITECTURE.md` — Technical Architecture

**Model**: Claude Opus 4.7 (deep reasoning for design-level content)

- [ ] High-level architecture diagram (Mermaid `graph LR`) — **Mermaid diagram #2**
- [ ] Component descriptions (routes, services, validators, utils)
- [ ] Data flow sequence diagram (Mermaid `sequenceDiagram`) — **Mermaid diagram #3**
- [ ] Design decisions and trade-offs (in-memory storage, Zod vs. manual validation)
- [ ] Security considerations (no auth, input sanitization)
- [ ] Performance considerations (sync vs. async, import batch size)

---

#### 5.14 `TESTING_GUIDE.md` — QA Guide

**Model**: Claude Sonnet 4.6

- [ ] Test pyramid diagram (Mermaid `graph TD`) showing unit / integration / e2e layers
- [ ] How to run each test file individually
- [ ] Sample test data locations (`tests/fixtures/`)
- [ ] Manual testing checklist (one item per endpoint)
- [ ] Performance benchmarks table (thresholds from `test_performance.ts`)

---

#### 5.15 Update `INSTRUCTIONS.md`

- [ ] Verify all instructions are current after Phase 5 additions
- [ ] Add troubleshooting section (port conflicts, missing node_modules)
- [ ] Reference new documentation files (`README.md`, `API_REFERENCE.md`, etc.)

---

### Phase 5 Completion Criteria
- [ ] 56 total tests across 8 test files, all passing
- [ ] >85% overall code coverage (`npm run test:coverage`)
- [ ] `tests/fixtures/` contains all 5 sample data files
- [ ] `README.md`, `API_REFERENCE.md`, `ARCHITECTURE.md`, `TESTING_GUIDE.md` created
- [ ] At least 3 Mermaid diagrams present across documentation files
- [ ] Each documentation file generated with the specified AI model
- [ ] `INSTRUCTIONS.md` updated and accurate

---

## Phase 6: Demo & Quick-Start Files

### Objective
Provide ready-to-use scripts and sample data so anyone can run and test the API without reading detailed documentation.

### Tasks

#### 6.1 Create Startup Script
**File**: `homework-2/demo/run.bat`

- [x] Set `NODE_ENV=development` and `PORT=3000`
- [x] Install dependencies (`npm install`) if `node_modules` is missing
- [x] Start the server with `npm run dev`
- [x] Print the base URL on startup

**Deliverable**: Double-click `run.bat` starts the API server

---

#### 6.2 Create Seed Script
**File**: `homework-2/demo/seed.ps1`

- [x] Send several `POST /tickets` requests with realistic ticket data covering all categories and priorities
- [x] Print each created ticket ID and status to the console
- [x] Require the server to be running first (show a clear error if not reachable)

**Deliverable**: Running `seed.ps1` populates the in-memory store with test tickets

---

#### 6.3 Create Sample Request Scripts
**Files**: `homework-2/demo/sample-requests.sh` and `homework-2/demo/sample-requests.ps1`

- [x] Demonstrate every endpoint:
  - `POST /tickets` — create a ticket
  - `GET /tickets` — list all tickets
  - `GET /tickets/:id` — get single ticket (uses ID from create response)
  - `PUT /tickets/:id` — update a ticket
  - `DELETE /tickets/:id` — delete a ticket
  - `POST /tickets/import` — bulk import from `sample-data.json`
- [x] Include filter examples (`?status=new`, `?priority=urgent`)
- [x] `.sh` version uses `curl`; `.ps1` version uses `Invoke-RestMethod`

**Deliverable**: Scripts that demonstrate the full API surface

---

#### 6.4 Create Sample Data File
**File**: `homework-2/demo/sample-data.json`

- [x] JSON array of 5–10 valid tickets covering:
  - Multiple categories (account_access, technical_issue, billing_question, …)
  - Multiple priorities (urgent, high, medium, low)
  - Various optional fields (tags, metadata, assigned_to)
- [x] Used as the import payload in `sample-requests.*`

**Deliverable**: Ready-to-import JSON fixture

---

#### 6.5 Create HOWTORUN.md
**File**: `homework-2/HOWTORUN.md`

- [x] Prerequisites (Node.js version, npm)
- [x] Quick-start steps (clone → install → run)
- [x] How to use each demo script (`run.bat`, `seed.ps1`, `sample-requests.*`)
- [x] API base URL and available endpoints summary
- [x] Common troubleshooting (port already in use, missing node_modules)

**Deliverable**: Single-page guide to get from zero to a running, tested API

---

### Phase 6 Completion Criteria
- ✅ `run.bat` starts the server with one double-click
- ✅ `seed.ps1` populates test data successfully
- ✅ Both `sample-requests` scripts exercise every endpoint without errors
- ✅ `sample-data.json` imports cleanly via `/tickets/import`
- ✅ `HOWTORUN.md` is accurate and self-contained

**Status: COMPLETE** ✅

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
| Phase 3: Services | 6-8 hours | ✅ Complete |
| Phase 4: Routes & Errors | 6-8 hours | ✅ Complete |
| Phase 5: Testing & Docs | 10-14 hours | ⏳ Pending |
| Phase 6: Demo & Quick-Start | 1-2 hours | ✅ Complete |
| **Total** | **25-34 hours** | |

---

## Notes

- Refer back to [INSTRUCTIONS.md](./INSTRUCTIONS.md) for setup details
- Keep validation strict — better to reject invalid data than process it
- Write tests as you code, not after
- For Phase 2 (AI integration), use this plan as a template and extend with API calls
