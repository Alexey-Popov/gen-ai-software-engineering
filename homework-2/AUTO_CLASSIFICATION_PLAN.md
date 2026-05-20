# Development Plan - Auto-Classification Feature

## Overview

This document outlines the step-by-step plan to implement automatic ticket categorization and priority assignment. The feature adds a dedicated `POST /tickets/:id/auto-classify` endpoint that applies deterministic keyword-based rules to ticket text, returns a structured classification result with a confidence score, stores the results back onto the ticket, and logs each classification decision.

**Builds on**: Phase 1–6 of the core ticket system (`DEVELOPMENT_PLAN.md`)

**New files**: `src/services/classifier.ts`, `demo/auto-classify-test.ps1`, `demo/auto-classify-test.sh`  
**Modified files**: `src/models/ticket.ts`, `src/routes/tickets.ts`

---

## Phase 7: Auto-Classification Engine

### Objective
Implement keyword-based classification of ticket category and priority, expose it via a REST endpoint, persist results to the ticket, and maintain an in-memory decision log.

---

### Tasks

#### 7.1 Add Classification Interfaces to Ticket Model
**File**: `src/models/ticket.ts`

- [ ] Add `ClassificationResult` interface:
  ```typescript
  export interface ClassificationResult {
    category: Category;
    priority: Priority;
    confidence: number;      // 0–1, rounded to 2 decimal places
    reasoning: string;       // human-readable explanation of match
    keywords_found: string[];
  }
  ```
- [ ] Add `ClassificationLog` interface:
  ```typescript
  export interface ClassificationLog {
    ticket_id: string;
    timestamp: string;       // ISO datetime
    subject: string;
    description: string;
    result: ClassificationResult;
  }
  ```

**Deliverable**: Model file compiles without errors; interfaces exported

---

#### 7.2 Implement Classifier Service
**File**: `src/services/classifier.ts`

##### 7.2.1 Category keyword map (checked in priority order)
| Category | Trigger keywords |
|---|---|
| `bug_report` | `steps to reproduce`, `reproduction steps`, `reproducible`, `expected behavior`, `actual behavior`, `defect` |
| `account_access` | `login`, `password`, `2fa`, `two-factor`, `can't log in`, `sign in`, `authentication`, `locked out`, `forgot password` |
| `billing_question` | `payment`, `invoice`, `refund`, `charge`, `billing`, `subscription`, `cost`, `pricing`, `receipt` |
| `feature_request` | `enhancement`, `suggestion`, `feature request`, `would like`, `please add`, `improve`, `new feature` |
| `technical_issue` | `error`, `crash`, `not working`, `broken`, `exception`, `500`, `timeout`, `fails`, `bug` |
| `other` | fallback — no keywords matched |

> `bug_report` is checked before `technical_issue` because its signals are more specific.

##### 7.2.2 Priority keyword map (all checked; highest found wins)
| Priority | Trigger keywords |
|---|---|
| `urgent` | `can't access`, `critical`, `production down`, `security`, `urgent`, `emergency`, `data loss` |
| `high` | `important`, `blocking`, `asap`, `blocker`, `high priority` |
| `low` | `minor`, `cosmetic`, `suggestion`, `low priority`, `nice to have`, `whenever` |
| `medium` | default — no priority keyword matched |

##### 7.2.3 Confidence scoring
```
base = 0.5
per category keyword matched: +0.15 (cap at 0.95 total)
if priority has an explicit keyword match: +0.05
if category falls back to 'other': cap confidence at 0.55, minimum 0.40
round to 2 decimal places
```

##### 7.2.4 Functions to implement

- [ ] `classifyTicket(ticket: Ticket): ClassificationResult`
  - Lowercase `ticket.subject + ' ' + ticket.description`
  - Check category keyword map in declared order; first matching category wins
  - Collect all matched keywords for the winning category
  - Check all priority keyword maps; use highest-level match found
  - Calculate confidence score
  - Build `reasoning` string: `"Category '...' matched keywords: a, b. Priority '...' matched keywords: c."`
  - Return `ClassificationResult`

- [ ] `logDecision(ticketId: string, ticket: Ticket, result: ClassificationResult): void`
  - Append `ClassificationLog` entry to in-memory `Map<string, ClassificationLog[]>`
  - `console.log` structured line:
    ```
    [2026-05-20T10:00:00.000Z] AUTO-CLASSIFY ticket=abc123 category=technical_issue priority=urgent confidence=0.80 keywords=error,crash,critical
    ```

- [ ] `getClassificationLog(ticketId: string): ClassificationLog[]`
  - Returns all log entries for a ticket (empty array if none)

- [ ] `clearClassificationLogs(): void`
  - Clears the entire log map (for test teardown)

**Deliverable**: `src/services/classifier.ts` with exported functions

---

#### 7.3 Add Auto-Classify Endpoint to Ticket Routes
**File**: `src/routes/tickets.ts`

- [ ] Import `classifyTicket`, `logDecision` from `'../services/classifier'`
- [ ] Add route after the existing `DELETE /:id` handler:

  ```typescript
  router.post('/:id/auto-classify', (req: Request, res: Response, next: NextFunction): void => {
    const ticket = getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({
        error: 'Ticket not found',
        details: [],
        requestId: (req as any).requestId,
      });
      return;
    }

    const result = classifyTicket(ticket);
    updateTicket(req.params.id, { category: result.category, priority: result.priority });
    logDecision(req.params.id, ticket, result);

    res.json(result);
  });
  ```

**Response 200** (example):
```json
{
  "category": "technical_issue",
  "priority": "urgent",
  "confidence": 0.80,
  "reasoning": "Category 'technical_issue' matched keywords: error, crash. Priority 'urgent' matched keywords: critical.",
  "keywords_found": ["error", "crash", "critical"]
}
```

**Response 404**:
```json
{
  "error": "Ticket not found",
  "details": [],
  "requestId": "req-5"
}
```

- [ ] Ensure no body is required — the route reads only from ticket store and `req.params.id`

**Deliverable**: Endpoint registered and callable

---

### Phase 7 Completion Criteria

- [ ] `POST /tickets/:id/auto-classify` returns 200 with `category`, `priority`, `confidence`, `reasoning`, `keywords_found`
- [ ] Returns 404 for unknown ticket IDs
- [ ] `GET /tickets/:id` after classification shows updated `category` and `priority`
- [ ] Console log line printed for each classification call
- [ ] No-keyword ticket → `category=other`, `priority=medium`, confidence ≤ 0.55
- [ ] Multi-keyword ticket → confidence increases with match count (≤ 0.95)
- [ ] Priority keywords correctly elevate/demote priority vs. default `medium`
- [ ] TypeScript compiles without errors (`npm run build`)

---

## Phase 8: Demo Scripts for Auto-Classification

### Objective
Provide ready-to-run scripts in the `demo/` folder that exercise the `POST /tickets/:id/auto-classify` endpoint, covering all category and priority combinations so the feature can be demonstrated without manual API calls.

---

### Tasks

#### 8.1 Create PowerShell Demo Script
**File**: `demo/auto-classify-test.ps1`

- [ ] Check that the server is reachable at `http://localhost:3000/health`; print a clear error and exit if not
- [ ] Create one test ticket for each expected category:

  | Test case | Subject | Description | Expected category | Expected priority |
  |---|---|---|---|---|
  | Account access | "Cannot log in to my account" | "I forgot my password and authentication is failing" | `account_access` | `medium` |
  | Technical issue – urgent | "App crashes on startup" | "Getting an error and crash every time — critical production issue" | `technical_issue` | `urgent` |
  | Billing question | "Invoice discrepancy" | "I was charged twice for my subscription — need a refund" | `billing_question` | `medium` |
  | Feature request | "New feature suggestion" | "Would like to improve the dashboard with a new feature" | `feature_request` | `low` |
  | Bug report | "Defect in checkout flow" | "Steps to reproduce: add item, check out — expected behavior differs from actual behavior" | `bug_report` | `medium` |
  | Other – high | "Quick question" | "This is blocking our workflow — asap response needed" | `other` | `high` |
  | No keywords | "Hello" | "I have a general inquiry about something" | `other` | `medium` |

- [ ] For each ticket:
  - POST to `/tickets` and capture the `id`
  - POST to `/tickets/{id}/auto-classify` and capture the result
  - Print `[PASS]` or `[FAIL]` with expected vs. actual `category` and `priority`
  - Print the `reasoning` and `keywords_found`
- [ ] Print a final summary: total tests, passed, failed
- [ ] Exit with code `1` if any test fails

**Deliverable**: `demo/auto-classify-test.ps1` runnable with `.\demo\auto-classify-test.ps1`

---

#### 8.2 Create Bash Demo Script
**File**: `demo/auto-classify-test.sh`

- [ ] Identical test cases as `auto-classify-test.ps1`, implemented with `curl` and `jq`
- [ ] Check server health before running; exit with error if not reachable
- [ ] Print `[PASS]` / `[FAIL]` per test case with expected vs. actual values
- [ ] Print final summary line
- [ ] Exit with code `1` if any test fails
- [ ] Mark executable (`chmod +x`)

**Deliverable**: `demo/auto-classify-test.sh` runnable with `bash demo/auto-classify-test.sh`

---

### Phase 8 Completion Criteria

- [ ] `auto-classify-test.ps1` runs without errors when server is up
- [ ] `auto-classify-test.sh` runs without errors when server is up
- [ ] Both scripts print `[PASS]` for all 7 test cases
- [ ] Both scripts exit with a non-zero code if any test fails
- [ ] Both scripts print a clear error if the server is not reachable
- [ ] Scripts are self-contained — no additional setup required beyond a running server

---

## Notes

- No external AI API required — classification is fully deterministic
- Keyword matching is case-insensitive (text lowercased before scan)
- Multi-word phrases (`production down`, `steps to reproduce`) matched with `includes()` on the full text
- Classification does not guard against re-classification — calling the endpoint again overwrites `category` and `priority`; this is intentional
- The in-memory log store is keyed by `ticketId` and accumulates entries across multiple calls (audit trail per ticket)
- Demo scripts require the server to be running (`npm run dev` or `demo/run.bat`)
- `jq` must be installed for the `.sh` script to parse JSON responses
