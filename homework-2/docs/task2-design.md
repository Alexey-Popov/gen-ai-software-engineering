# Task 2 Design Note — Auto-Classification

This document is the locked contract for Phase 1 (Task 2) of homework-2. It is the source of truth for the test-engineer (writing failing tests first) and the developer (implementing against those tests). All decisions here conform to `homework-2/docs/architecture-skeleton.md` and build on `homework-2/docs/task1-design.md`.

In scope: rule-based keyword classifier, classification log, `POST /tickets/{id}/auto-classify`, `GET /tickets/{id}/classifications`, `auto_classify` flag on `POST /tickets`, DI wiring for log.

Out of scope: LLM/ML calls, `manual_override` flag on ticket, confidence field on `Ticket`, log eviction on ticket delete.

---

## 1. Classifier Algorithm

### 1.1 Function contract

```python
def classify(ticket_id: UUID, subject: str, description: str) -> ClassificationResult
```

- Pure function. No I/O. Deterministic.
- Caller passes `ticket_id` (the router fetches the ticket and forwards `ticket.id`).
- Never raises on empty strings; returns defaults (see §6, edge case #1).

### 1.2 Input normalisation

- Concatenate `subject + " " + description` into one search string.
- Lowercase before matching. All keyword tables are lowercase.
- Substring containment via `in` — no tokenisation, no stemming.

### 1.3 Priority resolution

1. Collect `matched_priorities` for every priority whose keywords appear as substrings.
2. Precedence: `urgent > high > low > medium`.
   - urgent matched → `urgent`
   - else high matched → `high`
   - else low matched → `low`
   - else → `medium` (default, no keywords)
3. `medium` never appears in `keywords_found`.

### 1.4 Category resolution

1. Walk categories in declaration order: `account_access → technical_issue → billing_question → feature_request → bug_report → other`.
2. First category whose keywords include a substring match wins.
3. `other` is the fallback; it never appears in `keywords_found`.

### 1.5 Confidence formula

- `keywords_found` = union of all matched priority keywords + all matched category keywords across **all** categories (not just the winner), deduplicated, order-preserving (priority keywords first, then category keywords in declaration order).
- `hits = len(keywords_found)`
- `confidence = round(min(1.0, hits / 5.0), 2)`
- 0 hits → 0.00; 1 hit → 0.20; 5+ hits → 1.00.

### 1.6 Reasoning string format

```
"Matched priority keywords: {priority_kws}. Matched category keywords: {category_kws}."
```

Both are Python `repr`-style string lists (e.g. `['critical']` or `[]`). Order follows table declaration order.

### 1.7 keywords_found construction

Flat `list[str]`, deduplicated via `dict.fromkeys(...)` to preserve first-seen order. Priority keywords first (table order), then category keywords (table order across all categories).

---

## 2. Route Contracts

### 2.1 Summary table

| # | Method | Path | Body | Query/path | Success | Errors |
|---|--------|------|------|------------|---------|--------|
| 1 | POST | `/tickets` (modified) | `TicketCreate` JSON | `auto_classify?: bool` (default `false`) | `201` + `Ticket` | `400` |
| 2 | POST | `/tickets/{ticket_id}/auto-classify` | — | `ticket_id` UUID | `200` + `ClassificationResult` | `400`, `404` |
| 3 | GET | `/tickets/{ticket_id}/classifications` | — | `ticket_id` UUID | `200` + `ClassificationResult[]` | `400`, `404` |

All 4xx use the standard envelope: `{"error": "...", "details": [{"field": "...", "message": "..."}]}`.

### 2.2 POST `/tickets` — modified

- New: `auto_classify: bool = Query(False)`.
- When `true` (after ticket insert):
  1. Call `result = classify(ticket.id, ticket.subject, ticket.description)`.
  2. Mutate ticket: `ticket.category = result.category`, `ticket.priority = result.priority`, `ticket.updated_at = datetime.now(timezone.utc)`.
  3. `store.update(ticket)`.
  4. `log.record(result)`.
  5. Return `201` with the updated ticket. `ClassificationResult` not in create response.
- Classifier always overwrites client-supplied `category`/`priority`. No lock.
- `?auto_classify=banana` → `400` via central handler, `field: "auto_classify"`. Ticket not created.

### 2.3 POST `/tickets/{ticket_id}/auto-classify`

- Steps: fetch ticket (404 if missing) → classify → mutate category/priority/updated_at → store.update → log.record → return `200 ClassificationResult`.
- `resolved_at` is NOT touched — governed only by status transitions.
- Calling twice on the same ticket produces two log entries; ticket ends in the same state.

### 2.4 GET `/tickets/{ticket_id}/classifications`

- Steps: fetch ticket (404 if missing, even if log has entries — existence check first) → `log.entries(ticket_id=ticket_id)` → return `200 list[ClassificationResult]`.
- May return `[]` for an existing ticket that has never been classified.
- Insertion order (chronological). No pagination.

---

## 3. ClassificationResult Response Schema

```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "account_access",
  "priority": "urgent",
  "confidence": 0.60,
  "reasoning": "Matched priority keywords: ['critical']. Matched category keywords: ['login', 'access'].",
  "keywords_found": ["critical", "login", "access"]
}
```

- `Ticket` model is NOT extended. Confidence lives only in the log.

---

## 4. Dependency Injection for `classification_log`

### 4.1 Production wiring

`services/classification_log.py` stub already declares `_log = ClassificationLog()` and `get_log()`. No changes needed to that file. Routes declare `log: ClassificationLog = Depends(get_log)`.

### 4.2 Test isolation

Add `fresh_log` fixture to `tests/conftest.py`:
```python
@pytest.fixture
def fresh_log() -> ClassificationLog:
    return ClassificationLog()
```

Update `client` fixture to override both:
```python
app.dependency_overrides[get_store] = lambda: fresh_store
app.dependency_overrides[get_log] = lambda: fresh_log
```
Both cleared on teardown via `app.dependency_overrides.clear()`.

Tests that need direct log access accept both `client` and `fresh_log` — pytest fixture caching guarantees they share the same instance.

### 4.3 Routes that depend on the log

| Route | Dependencies |
|-------|--------------|
| `POST /tickets` | `store`, `log` (only when `auto_classify=true`) |
| `POST /tickets/{id}/auto-classify` | `store`, `log` |
| `GET /tickets/{id}/classifications` | `store` (existence check), `log` |
| All Task 1 routes | `store` only (unchanged) |

---

## 5. Keyword Tables (verbatim from TASKS.md)

### 5.1 Priority keywords

| Priority | Keywords |
|----------|----------|
| `urgent` | `"can't access"`, `"critical"`, `"production down"`, `"security"` |
| `high`   | `"important"`, `"blocking"`, `"asap"` |
| `low`    | `"minor"`, `"cosmetic"`, `"suggestion"` |
| `medium` | (default — no keywords) |

### 5.2 Category keywords

| Category | Keywords |
|----------|----------|
| `account_access`   | `"login"`, `"password"`, `"2fa"`, `"account"`, `"access"`, `"sign in"`, `"locked out"` |
| `technical_issue`  | `"bug"`, `"error"`, `"crash"`, `"broken"`, `"not working"`, `"exception"`, `"500"` |
| `billing_question` | `"payment"`, `"invoice"`, `"refund"`, `"charge"`, `"billing"`, `"subscription"` |
| `feature_request`  | `"feature"`, `"enhancement"`, `"request"`, `"would like"`, `"suggestion"`, `"add"` |
| `bug_report`       | `"defect"`, `"reproduce"`, `"steps to reproduce"`, `"regression"`, `"expected behavior"` |
| `other`            | (default — no keywords) |

### 5.3 Cross-table notes

- `"suggestion"` appears in both `low` (priority) and `feature_request` (category). Counted once in `keywords_found`.
- `"can't access"` (urgent) and `"access"` (account_access) both match text containing "can't access". Both go into `keywords_found`.
- `"500"` is a substring that may match numeric content (e.g. "$500"). Accepted imprecision per spec.

---

## 6. Edge Cases

| # | Situation | Behaviour |
|---|-----------|-----------|
| 1 | No keywords in subject+description | `category=other`, `priority=medium`, `confidence=0.0`, `keywords_found=[]` |
| 2 | Only priority keywords match | `category=other`, priority per precedence |
| 3 | Only category keywords match | `priority=medium`, category per first-match |
| 4 | Multiple priorities match | Highest precedence wins; all matched priority keywords in `keywords_found` |
| 5 | Multiple categories match | First-listed wins; all matched category keywords across all categories in `keywords_found` |
| 6 | Same keyword in priority + category | Counted once in `keywords_found` |
| 7 | Mixed-case input | Lowercased before matching |
| 8 | Auto-classify on non-existent ticket | `404`, no log entry written |
| 9 | GET classifications on non-existent ticket | `404` (not `200 []`) |
| 10 | GET classifications on ticket with no classifications | `200 []` |
| 11 | Auto-classify called twice | Two log entries; ticket ends in same state |
| 12 | `POST /tickets?auto_classify=true` with body `category=other` | Classifier overwrites both category and priority |
| 13 | PUT after auto-classify | Just sets fields; no lock. Subsequent auto-classify overwrites again |
| 14 | `?auto_classify=banana` | `400`, `field: "auto_classify"`. Ticket not created |

---

## 7. Five-Bullet Summary

- Pure substring classifier: priority precedence `urgent > high > low > medium`, category first-match in declaration order; confidence = `round(min(1.0, distinct_hits / 5.0), 2)`.
- Three route changes: new `POST /tickets/{id}/auto-classify` (200 + ClassificationResult), new `GET /tickets/{id}/classifications` (200 + array, ticket existence required), and `?auto_classify=true` flag on `POST /tickets`.
- Classifier always overwrites category/priority — no manual_override lock, no extra ticket fields; confidence lives only in classification_log.
- `classify(ticket_id, subject, description)` takes ticket_id explicitly so the pure function populates ClassificationResult without I/O.
- DI mirrors get_store: `get_log()` dependency, `fresh_log` fixture, client fixture updated to override both dependencies for per-test isolation.
