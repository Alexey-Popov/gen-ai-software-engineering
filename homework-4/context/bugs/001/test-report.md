# Test Report — Bug Fixes 001

**Date:** 2026-06-02  
**Branch:** homework-4-submission  
**Skill applied:** FIRST (Fast · Independent · Repeatable · Self-validating · Timely)

---

## Build & Test Results

| Step | Outcome |
|------|---------|
| `dotnet build AiTicketHub.sln` | **Succeeded** — 0 errors, 0 warnings |
| `dotnet test AiTicketHub.sln` | **Passed** — 209 passed, 0 failed, 0 skipped |

Pre-existing tests: **148**  
New tests added: **61**  
Total: **209**

---

## New Test Files

| File | Bugs covered | New tests |
|------|-------------|-----------|
| `tests/.../Domain/TicketEntityBugFixTests.cs` | BUG-025, BUG-001, BUG-002 | 15 |
| `tests/.../Infrastructure/KeywordClassifierBugFixTests.cs` | BUG-004, BUG-005 | 7 |
| `tests/.../Application/TicketServiceBugFixTests.cs` | BUG-027, BUG-006, BUG-007, BUG-028, BUG-018 | 7 |
| `tests/.../Infrastructure/TicketRepositoryBugFixTests.cs` | BUG-029, BUG-021 | 4 |
| `tests/.../Infrastructure/Parsers/CsvTicketParserBugFixTests.cs` | BUG-024, BUG-010, BUG-011 | 5 |
| `tests/.../Infrastructure/Parsers/JsonTicketParserBugFixTests.cs` | BUG-022 | 1 |
| `tests/.../Infrastructure/Parsers/XmlTicketParserBugFixTests.cs` | BUG-023, BUG-013 | 2 |
| `tests/.../Application/TicketImportServiceBugFixTests.cs` | BUG-016, BUG-017 | 3 |
| `tests/.../Application/UpdateTicketValidatorBugFixTests.cs` | BUG-008 | 5 |
| `tests/.../Application/AutoClassifyValidatorTests.cs` | BUG-009 | 7 |
| `tests/.../Application/CreateTicketValidatorBugFixTests.cs` | BUG-026, BUG-019 | 5 |
| **Total** | | **61** |

---

## FIRST Compliance

Every generated test class carries the compliance comment block required by the skill.

| Letter | Principle | How satisfied |
|--------|-----------|---------------|
| **F** Fast | < 100 ms per test | No file I/O, no network, no sleep. All parsers use `MemoryStream`; all services and repositories are either in-memory or Moq-mocked. |
| **I** Independent | No shared mutable state | `[SetUp]` creates fresh instances (mocks, repositories, validators, classifiers) before each test. No static state shared between tests. |
| **R** Repeatable | Same result on every run | All GUIDs are `Guid.NewGuid()` per-test; no clock-dependent assertions; parser inputs are hard-coded strings. |
| **S** Self-validating | At least one `.Should()` per test | Every test asserts via FluentAssertions or verifies exception type; no `Console.WriteLine` as sole check. |
| **T** Timely | Only changed code tested | Tests map 1-to-1 to the 22 bugs listed in `fix-summary.md`; no tests for unchanged methods. |

---

## Per-Bug Test Coverage

### Domain — `Ticket.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-025 | Constructor guards for null/whitespace inputs | `Constructor_Null*_ThrowsArgumentException` × 5; `Constructor_Whitespace*_ThrowsArgumentException` × 2 |
| BUG-001 | `TransitionTo`: added `InProgress→Resolved` and `WaitingCustomer→Resolved` | `TransitionTo_FromInProgressToResolved_Succeeds`; `TransitionTo_FromWaitingCustomerToResolved_Succeeds`; `TransitionTo_FromNewToResolved_Fails` (regression guard); `TransitionTo_FromNew/ResolvedTo*_Succeeds` × 2 |
| BUG-002 | `ApplyUpdate`: empty strings no longer overwrite existing values | `ApplyUpdate_EmptySubject_DoesNotChangeSubject`; `ApplyUpdate_EmptyDescription_DoesNotChangeDescription`; `ApplyUpdate_NonEmptySubject_UpdatesSubject` |

### Infrastructure — `KeywordClassifier.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-004 | Null-safe `$"{subject ?? ""} {description ?? ""}"` | `Classify_NullSubject_DoesNotThrow`; `Classify_NullDescription_DoesNotThrow`; `Classify_BothNull_DoesNotThrowAndDefaultsToOtherMedium` |
| BUG-005 | `ContainsWord` with `\b` word-boundary regex | `Classify_SubstringContainingBugKeyword_DoesNotMatchBugReportCategory` ("debugged" ≠ "bug"); `Classify_ExactWordBug_MatchesBugReportCategory`; `Classify_WordContainingLoginSubstring_DoesNotMatchLoginKeyword`; `Classify_ExactWordLogin_MatchesAccountAccessCategory` |

### Application — `TicketService.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-027 | `CreateTicketAsync`: null-request guard | `CreateTicketAsync_NullRequest_ReturnsValidationFailed` |
| BUG-006 | `CreateTicketAsync`: `UpdateAsync` called after auto-classify | `CreateTicketAsync_AutoClassifyTrue_CallsUpdateAsyncToPersistClassification`; `CreateTicketAsync_AutoClassifyFalse_NeverCallsUpdateAsync` |
| BUG-007 | `ListTicketsAsync`: `total = filtered.Count` not `allResult.Value.Count` | `ListTicketsAsync_FilterApplied_TotalCountReflectsFilteredCount`; `ListTicketsAsync_NoFilter_TotalCountEqualsAllTickets` |
| BUG-028 | `UpdateTicketAsync`: null-request guard | `UpdateTicketAsync_NullRequest_ReturnsValidationFailed` |
| BUG-018 | `AutoClassifyAsync`: `request ??= new AutoClassifyRequest()` | `AutoClassifyAsync_NullRequest_DoesNotThrowAndReturnsSuccess` |

### Infrastructure — `TicketRepository.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-029 | `AddAsync`: `ArgumentNullException.ThrowIfNull(ticket)` | `AddAsync_NullTicket_ThrowsArgumentNullException` |
| BUG-021 | `BulkAddAsync`: null-list guard + per-element null check | `BulkAddAsync_NullList_ThrowsArgumentNullException`; `BulkAddAsync_ListContainingNullElement_ReturnsInvalidErrorForNullSlot`; `BulkAddAsync_MixedNullAndValidTickets_NullSlotFailsValidSucceeds` |

### Infrastructure — `CsvTicketParser.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-024 | `ParseAsync`: `ArgumentNullException.ThrowIfNull(input)` | `ParseAsync_NullInput_ThrowsArgumentNullException` |
| BUG-010 | Column-count check before field mapping | `ParseAsync_RowFewerColumnsThanHeader_ReturnsColumnCountError`; `ParseAsync_RowExactlyHeaderColumnCount_IsProcessedNormally` |
| BUG-011 | `SplitCsvLine` throws `FormatException` on unterminated quote | `ParseAsync_UnterminatedQuotedField_ReturnsFormatError`; `ParseAsync_ProperlyQuotedFieldWithComma_ParsedCorrectly` |

### Infrastructure — `JsonTicketParser.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-022 | `ParseAsync`: `ArgumentNullException.ThrowIfNull(input)` | `ParseAsync_NullInput_ThrowsArgumentNullException` |

### Infrastructure — `XmlTicketParser.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-023 | `ParseAsync`: `ArgumentNullException.ThrowIfNull(input)` | `ParseAsync_NullInput_ThrowsArgumentNullException` |
| BUG-013 | `GetValue`: whitespace-only element returns `""` not `null` | `ParseAsync_WhitespaceOnlySubjectElement_ReturnsParseError` |

### Application — `TicketImportService.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-016 | `ImportAsync`: `ArgumentNullException.ThrowIfNull(format)` | `ImportAsync_NullFormat_ThrowsArgumentNullException` |
| BUG-017 | Bulk-error row = `i + 1`, not `parseErrors.Count + i + 1` | `ImportAsync_BulkInsertFailureWithPriorParseError_BulkErrorRowNumberIsOneNotTwo`; `ImportAsync_AllRecordsInsertedSuccessfully_ReportsZeroErrors` |

### Application — `UpdateTicketValidator.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-008 | Whitespace-only `Subject`/`Description` now fail validation | `Validate_WhitespaceOnlySubject_FailsOnSubject`; `Validate_WhitespaceOnlyDescription_FailsOnDescription`; `Validate_SingleSpaceSubject_FailsOnSubject`; `Validate_NullSubject_IsValid`; `Validate_NullDescription_IsValid` |

### Application — `AutoClassifyValidator.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-009 | Added `IsInEnum` rules for `CategoryOverride` and `PriorityOverride` | `Validate_NoOverrides_IsValid`; `Validate_ValidCategoryOverride_IsValid`; `Validate_ValidPriorityOverride_IsValid`; `Validate_InvalidCategoryOverride_FailsOnCategoryOverride`; `Validate_InvalidPriorityOverride_FailsOnPriorityOverride`; `Validate_BothValidOverrides_IsValid`; `Validate_BothInvalidOverrides_FailsOnBoth` |

### Application — `CreateTicketValidator.cs`

| Bug | Change | Tests |
|-----|--------|-------|
| BUG-026 / BUG-019 | `RuleForEach(Tags).Must(not empty/whitespace)` | `Validate_EmptyStringTagEntry_FailsOnTags`; `Validate_WhitespaceOnlyTagEntry_FailsOnTags`; `Validate_AllValidTagEntries_IsValid`; `Validate_EmptyTagsList_IsValid`; `Validate_SingleWhitespaceTag_FailsOnTags` |

---

## Bugs Without Dedicated New Tests

| Bug | Reason |
|-----|--------|
| BUG-003 | Removal of the `ClassificationApiKey` constant — no runtime behaviour to assert; confirmed by absence of the constant in the compiled assembly. |
| BUG-020 | `UpdateAsync` TOCTOU race fix (`TryUpdate` instead of indexer). The existing `TicketRepositoryTests.UpdateAsync_ExistingTicket_ReturnsUpdatedTicket` and `UpdateAsync_UnknownId_ReturnsNotFoundError` cover the observable outcomes; a reliable deterministic race test would require artificial thread scheduling and is out of scope for unit tests. |
| BUG-030 | `LogWarning` when `TotalKeywords == 0`. `TotalKeywords` is a private `static readonly` computed from hardcoded rules and cannot be reset to 0 without reflection or subclassing. The warning path is not observable through the public API. |

No build or test failures encountered.
