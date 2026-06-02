# Fix Summary — Bug Fixes 001

**Date:** 2026-06-02  
**Branch:** homework-4-submission  
**Result:** All 22 bugs applied. Build succeeded (0 errors, 0 warnings). Tests passed (148/148).

---

## Files Modified

### 1. `src/AiTicketHub/Domain/Entities/Ticket.cs`

| Bug | Change |
|-----|--------|
| BUG-025 | Constructor: added `ArgumentException` guards for `customerId`, `customerEmail`, `customerName`, `subject`, `description` when null/whitespace. |
| BUG-001 | `TransitionTo`: added `InProgress → Resolved` and `WaitingCustomer → Resolved` transitions to the state machine switch. |
| BUG-002 | `ApplyUpdate`: changed `!= null` checks for `subject` and `description` to `!string.IsNullOrEmpty(...)` so empty strings are no longer silently accepted. |

### 2. `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`

| Bug | Change |
|-----|--------|
| BUG-003 | Removed hardcoded `ClassificationApiKey` constant (`"sk-prod-abc123secret987xyz"`). |
| BUG-004 | `Classify`: replaced `$"{subject} {description}"` with `$"{subject ?? string.Empty} {description ?? string.Empty}"` to prevent NRE on null inputs. |
| BUG-005 | Replaced all `text.Contains(kw)` calls with `ContainsWord(text, kw)` and added a `ContainsWord` helper using `\b` word-boundary regex to prevent substring false-positives (e.g. "bug" matching "debug"). |
| BUG-030 | Added `_logger.LogWarning(...)` before the confidence calculation when `TotalKeywords == 0`, so misconfigured classifiers are observable. |

### 3. `src/AiTicketHub/Application/Services/TicketService.cs`

| Bug | Change |
|-----|--------|
| BUG-027 | `CreateTicketAsync`: added null guard on `request` returning `Validation.Failed` failure before calling `ValidateAsync`. |
| BUG-006 | `CreateTicketAsync`: added `await _repository.UpdateAsync(ticket)` after `ApplyClassification` so the auto-classified category/priority is actually persisted. |
| BUG-007 | `ListTicketsAsync`: changed `total = allResult.Value!.Count` to `total = filtered.Count` so pagination totals reflect applied filters. |
| BUG-028 | `UpdateTicketAsync`: added null guard on `request` returning `Validation.Failed` failure before calling `ValidateAsync`. |
| BUG-018 | `AutoClassifyAsync`: added `request ??= new AutoClassifyRequest()` so a null request body doesn't NRE on `request.CategoryOverride`. |

### 4. `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`

| Bug | Change |
|-----|--------|
| BUG-029 | `AddAsync`: added `ArgumentNullException.ThrowIfNull(ticket)` guard. |
| BUG-020 | `UpdateAsync`: switched from `TryGetValue` + direct assignment to `TryGetValue` + `TryUpdate` to close the TOCTOU race with concurrent deletes. |
| BUG-021 | `BulkAddAsync`: added `ArgumentNullException.ThrowIfNull(tickets)` and a per-element null check that returns a `Ticket.Invalid` failure rather than NRE-ing. |

### 5. `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`

| Bug | Change |
|-----|--------|
| BUG-024 | `ParseAsync`: added `ArgumentNullException.ThrowIfNull(input)`. |
| BUG-010 | After splitting fields, added a column-count check that records an error and skips rows shorter than the header. |
| BUG-011 | `SplitCsvLine`: throws `FormatException` when `inQuotes` is still true at end of line. Call site wraps `SplitCsvLine` in `try/catch (FormatException)` and records the error. |

### 6. `src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs`

| Bug | Change |
|-----|--------|
| BUG-022 | `ParseAsync`: added `ArgumentNullException.ThrowIfNull(input)`. |

### 7. `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`

| Bug | Change |
|-----|--------|
| BUG-023 | `ParseAsync`: added `ArgumentNullException.ThrowIfNull(input)`. |
| BUG-013 | `GetValue`: replaced `child?.Value.Trim()` + `IsNullOrEmpty` check with an explicit `if (child == null) return null; return child.Value.Trim()` so whitespace-only elements return `""` instead of `null`, preserving the whitespace-only content for downstream validators to handle. |

### 8. `src/AiTicketHub/API/Controllers/TicketController.cs`

| Bug | Change |
|-----|--------|
| BUG-014 | `CreateTicket`: changed parameter to `CreateTicketRequest?` and added an explicit null guard returning 400. |
| BUG-015 | `ImportTickets`: replaced `Path.GetExtension(file.FileName)` with `Path.GetExtension(Path.GetFileName(file.FileName ?? string.Empty))` to strip any path traversal prefix from the client-supplied filename. |

### 9. `src/AiTicketHub/Application/Services/TicketImportService.cs`

| Bug | Change |
|-----|--------|
| BUG-016 | `ImportAsync`: added `ArgumentNullException.ThrowIfNull(format, nameof(format))` before the switch to prevent NRE on null format. |
| BUG-017 | Bulk-insert error reporting: replaced `parseResult.Errors.Count + i + 1` with `i + 1` so the reported row numbers reflect the ticket's position within the successfully-parsed records, not an inflated index. |

### 10. `src/AiTicketHub/Application/Validators/UpdateTicketValidator.cs`

| Bug | Change |
|-----|--------|
| BUG-008 | Replaced `MinimumLength(1)` on `Subject` with `Must(s => !string.IsNullOrWhiteSpace(s))`. Added the same `Must` check before `MinimumLength(10)` on `Description` so whitespace-only strings are rejected. |

### 11. `src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs`

| Bug | Change |
|-----|--------|
| BUG-009 | Added `IsInEnum` rules for `CategoryOverride` and `PriorityOverride` (guarded with `When(x => x.*.HasValue)`) — the constructor was previously empty, providing no validation. |

### 12. `src/AiTicketHub/Application/Validators/CreateTicketValidator.cs`

| Bug | Change |
|-----|--------|
| BUG-026 / BUG-019 | Added `RuleForEach(x => x.Tags).Must(t => !string.IsNullOrWhiteSpace(t))` (guarded with `When(x => x.Tags != null)`) so individual tag elements cannot be empty or whitespace. |

---

## Build & Test Results

| Step | Outcome |
|------|---------|
| `dotnet build AiTicketHub.sln` | **Succeeded** — 0 errors, 0 warnings |
| `dotnet test AiTicketHub.sln` | **Passed** — 148 passed, 0 failed, 0 skipped |

No build or test failures encountered.
