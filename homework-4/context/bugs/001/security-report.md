# Security Review — Bug Fixes 001

**Date:** 2026-06-02
**Branch:** homework-4-submission
**Scope:** Security review of the 12 source files modified in `context/bugs/001/fix-summary.md`. No source files were edited as part of this review.

**Files reviewed:**

1. `src/AiTicketHub/Domain/Entities/Ticket.cs`
2. `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`
3. `src/AiTicketHub/Application/Services/TicketService.cs`
4. `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`
5. `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`
6. `src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs`
7. `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`
8. `src/AiTicketHub/API/Controllers/TicketController.cs`
9. `src/AiTicketHub/Application/Services/TicketImportService.cs`
10. `src/AiTicketHub/Application/Validators/UpdateTicketValidator.cs`
11. `src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs`
12. `src/AiTicketHub/Application/Validators/CreateTicketValidator.cs`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 1     |
| Medium   | 3     |
| Low      | 5     |
| Info     | 2     |

The recent bug-fix pass closed many input-validation and null-safety gaps. However, the review surfaced one critical architectural omission (no auth), one new high-impact wiring gap (validator added but never invoked), and several lower-severity hygiene issues — most notably an undisposed `JsonDocument`, a remaining TOCTOU window in `UpdateClassificationAsync`, and an exfiltrated secret that persists in git history despite the source removal.

---

## Findings

### CRITICAL-1 — No authentication or authorization on any endpoint

**File:** `src/AiTicketHub/API/Controllers/TicketController.cs` (all actions)

**Description:** `TicketController` has no `[Authorize]` attribute, no authentication scheme is enforced, and no per-request ownership checks exist anywhere in the service or repository. Any unauthenticated caller can:

- Create tickets impersonating arbitrary `CustomerId` / `CustomerEmail` / `CustomerName` values.
- Enumerate every ticket in the system via `GET /api/tickets`, harvesting customer PII (email, name, free-form descriptions).
- Read, update, delete, re-classify, or bulk-import tickets that belong to other customers (IDOR — Insecure Direct Object Reference).

**Impact:** Unrestricted read/write/delete of all ticket and customer data. PII disclosure (CWE-359). Broken access control (OWASP A01:2021).

**Note:** This is a pre-existing architectural issue, not a regression introduced by the recent fixes. It is the single largest exposure in the changed surface area and warrants explicit acknowledgement before any production deployment.

**Recommendation:** Add an authentication scheme (JWT bearer, API key, or cookie session as appropriate). Decorate the controller with `[Authorize]` and add per-action authorization (e.g. tenant/customer scoping) so users can only see and mutate their own tickets. Treat any ticket whose `CustomerId` doesn't match the caller's identity as a 404, not a 403, to avoid existence-oracle behavior.

---

### HIGH-1 — `AutoClassify` endpoint silently bypasses `AutoClassifyValidator`

**File:** `src/AiTicketHub/Application/Services/TicketService.cs:170-193`
**Related:** `src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs`

**Description:** Per BUG-009, `AutoClassifyValidator` was added to enforce `IsInEnum` rules on `CategoryOverride` / `PriorityOverride`. However, `TicketService.AutoClassifyAsync` does **not** inject or invoke this validator. The override values flow straight from the request into `_repository.UpdateClassificationAsync(id, category, priority)` without enum validation.

Because `TicketCategory` and `TicketPriority` are plain `enum` types, JSON deserialization accepts any integer (e.g. `{"CategoryOverride": 9999}`) and binds it to the nullable enum. The override is then persisted, leaving the ticket in an invalid state that will fail downstream consumers (UI rendering, reporting queries, exports).

**Impact:** Stored invalid enum values; data-integrity corruption that bypasses the validator added specifically to prevent it (CWE-20 — Improper Input Validation). Server-side enforcement is the only place this can be stopped, since the client controls the JSON payload directly.

**Recommendation:** Inject `IValidator<AutoClassifyRequest>` into `TicketService` and invoke `ValidateAsync(request)` before reading `CategoryOverride` / `PriorityOverride`, mirroring the pattern already used for create/update. Alternatively, perform `Enum.IsDefined` checks inside `AutoClassifyAsync` against the override values.

---

### MEDIUM-1 — TOCTOU race in `UpdateClassificationAsync` can resurrect deleted tickets

**File:** `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs:77-85`

**Description:** BUG-020 closed the resurrection race in `UpdateAsync` by switching to `TryUpdate`. The sibling method `UpdateClassificationAsync` was **not** updated and still uses the pattern that BUG-020 specifically called out as unsafe:

```csharp
if (!_store.TryGetValue(id, out var ticket))
    return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

ticket.ApplyClassification(category, priority);
_store[id] = ticket;
```

A concurrent `DeleteAsync(id)` between the `TryGetValue` and `_store[id] = ticket` can cause the deleted ticket to be re-inserted via the indexer assignment. This is also reachable via the auto-classify path (`TicketService.AutoClassifyAsync` → `UpdateClassificationAsync`).

**Impact:** Silent resurrection of deleted tickets (CWE-367 — TOCTOU). Inconsistent invariant: deletes are not durable under concurrent classification.

**Recommendation:** Apply the same `TryUpdate` pattern as `UpdateAsync`. The simplest fix is to clone-or-mutate inside a retry loop using `TryUpdate(id, mutated, existing)`, returning `TicketNotFound` if the captured `existing` reference is no longer in the dictionary.

---

### MEDIUM-2 — `JsonDocument` is never disposed (buffer-pool leak / DoS amplification)

**File:** `src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs:24-33`

**Description:** `JsonDocument` implements `IDisposable` because it rents arrays from `ArrayPool<byte>.Shared` and must return them on dispose. The current code never disposes the document:

```csharp
JsonDocument doc;
try { doc = await JsonDocument.ParseAsync(buffer, cancellationToken: ct); }
catch (JsonException ex) { ... }
// no using/finally — doc is GC-collected but pool buffers leak
```

Under sustained import load (10 MB documents), this steadily drains the shared `ArrayPool`, forcing fresh allocations across the process and increasing GC pressure system-wide. This is a documented and well-known pitfall.

**Impact:** Resource exhaustion / DoS amplification (CWE-401 — Missing Release of Memory after Effective Lifetime). Affects more than just this code path because `ArrayPool<byte>.Shared` is process-wide.

**Recommendation:** `using var doc = await JsonDocument.ParseAsync(...)`. The local `JsonElement` cursors used elsewhere in the method are safe to consume inside the `using` scope; map to records before the scope exits.

---

### MEDIUM-3 — XML parser relies on implicit `DtdProcessing.Prohibit` rather than an explicit reader configuration

**File:** `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs:27`

**Description:** `XDocument.LoadAsync(buffer, LoadOptions.None, ct)` uses the .NET default `XmlReaderSettings`, where modern .NET (Core 3.0+ / .NET 5+) sets `DtdProcessing = DtdProcessing.Prohibit` by default — which means XXE (XML External Entity) and Billion-Laughs are currently blocked. However, this is **implicit defense**: the code does not declare the assumption, so future refactors (e.g. someone switching to `XDocument.Load(string)` or supplying their own `XmlReaderSettings`) could silently re-introduce XXE.

**Impact:** Defense-in-depth gap (CWE-611 — Improper Restriction of XML External Entity Reference). Currently mitigated by the framework default, not by code.

**Recommendation:** Construct an explicit `XmlReader` with `new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersFromEntities = 0, Async = true }` and pass it to `XDocument.LoadAsync` via `XmlReader.Create(buffer, settings)`. Makes the intent unambiguous and version-stable.

---

### LOW-1 — Parse-error messages echo raw exception text to the API response

**Files:**
- `src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs:31` — `$"Invalid JSON document: {ex.Message}"`
- `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs:31` — `$"Invalid XML document: {ex.Message}"`

**Description:** Both parsers include the raw `ex.Message` of `JsonException` / generic `Exception` in the user-facing `ParseRowError`, which flows back through `ImportTicketsResponse` to the HTTP body. Library exception messages may include byte offsets, internal state, or — for the XML catch-all — file system paths in odd corner cases.

**Impact:** Minor information disclosure (CWE-209). The shipping framework exceptions are not known to expose anything sensitive today, but a future library update or a wrapped exception could leak more.

**Recommendation:** Log `ex.ToString()` server-side, and return a sanitized message such as `"Invalid JSON document; see server logs."` plus a correlation ID to the client.

---

### LOW-2 — `Exception` catch-all in `XmlTicketParser.ParseAsync` swallows unrelated faults

**File:** `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs:29`

**Description:** The `try` block catches `Exception ex` rather than the specific `XmlException` / `IOException`. This will also swallow `OutOfMemoryException`, `StackOverflowException` would not be caught but other runtime faults would, and `OperationCanceledException` from a cancelled `ct` is converted into a generic parse error instead of being re-thrown. The latter masks legitimate cancellation as a "user data is bad" error.

**Impact:** Lower observability of real failures; cancellation semantics violated (CWE-396 — Declaration of Catch for Generic Exception).

**Recommendation:** Catch `XmlException` (and optionally `IOException`) explicitly. Let `OperationCanceledException` propagate. Mirror the more targeted `JsonException` catch already used by `JsonTicketParser`.

---

### LOW-3 — Internal `MapError` returns `Error` object verbatim on 500 fallback

**File:** `src/AiTicketHub/API/Controllers/TicketController.cs:107-114`

**Description:** The fallback branch `_ => StatusCode(500, error)` returns the entire `Error` object — including `Code` and `Message` — in the response body. If any future code path constructs an `Error` whose `Message` includes stack-trace fragments, file paths, or database details, those leak directly to clients. Today the codebase is disciplined about message content, so the practical exposure is small, but the pattern is fragile.

**Impact:** Latent information-disclosure surface (CWE-209).

**Recommendation:** For the 500 fallback, return a generic `{ code = "Internal.Error", message = "An unexpected error occurred.", traceId = HttpContext.TraceIdentifier }` and log the actual `Error` server-side. Keep the typed 4xx mappings as-is.

---

### LOW-4 — Domain `ApplyUpdate` does not enforce length limits (defense-in-depth gap)

**File:** `src/AiTicketHub/Domain/Entities/Ticket.cs:113-132`

**Description:** The constructor (post-BUG-025) guards required fields with `string.IsNullOrWhiteSpace`, but `ApplyUpdate` accepts `subject` and `description` of any length so long as they are non-empty. Length validation lives exclusively in `UpdateTicketValidator` (200/2000 chars). If any future caller bypasses the service layer and constructs `ApplyUpdate` calls directly, the domain has no guard.

**Impact:** Defense-in-depth weakness only; not exploitable through current code paths because all callers go through validators.

**Recommendation:** Mirror the constructor's invariant checks inside `ApplyUpdate` (length bounds for `subject`/`description`) so the aggregate enforces its own invariants and validators become an additional layer rather than the sole layer.

---

### LOW-5 — Hand-rolled CSV parser does not handle embedded newlines inside quoted fields

**File:** `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs:31, 156-192`

**Description:** The parser reads input via `reader.ReadLineAsync`, then splits each line with `SplitCsvLine`. A legitimate CSV record with a newline inside a quoted field (e.g. `"line1\nline2"`) is split across two `ReadLineAsync` calls, leaves `inQuotes = true` at end-of-line, and triggers the BUG-011 `FormatException`. The record is rejected even though it is well-formed CSV per RFC 4180.

**Impact:** Availability/correctness for legitimate well-formed input. Not a vulnerability, but it interacts with security in that it pushes users toward sanitizing inputs in ad-hoc ways (e.g. stripping newlines) which can introduce new bugs.

**Recommendation:** Either replace the hand-rolled parser with `CsvHelper` (which is already in the ASP.NET ecosystem) or accumulate lines until quote-count is balanced before splitting.

---

### INFO-1 — Removed hardcoded API key persists in git history

**File:** `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs` (BUG-003)

**Description:** The constant `"sk-prod-abc123secret987xyz"` was removed from source per BUG-003. However, the value remains accessible via `git log -p` / `git show` on the pre-fix commit. Anyone with read access to the repository (including past forks, mirrors, and CI artifact caches) can still recover the secret. The string has the shape of a production API key prefix (`sk-prod-`).

**Impact:** If the value was ever a real credential — even one used only in dev — it must be considered compromised (CWE-798 — Use of Hard-coded Credentials).

**Recommendation:** Treat the key as exposed and rotate it at the issuing provider immediately. Even if it was a placeholder, document that fact (e.g. in fix-summary.md) so future auditors don't need to chase it. Going forward, secrets should be loaded from `IConfiguration` / user-secrets / environment variables, never inlined.

---

### INFO-2 — Stored ticket fields are not sanitized against downstream CSV/spreadsheet formula injection

**Files:** All parsers (`CsvTicketParser`, `JsonTicketParser`, `XmlTicketParser`) and `Ticket` storage.

**Description:** Imported and user-submitted text fields (`Subject`, `Description`, `CustomerName`, etc.) are stored verbatim. If any downstream tool later exports tickets to CSV / XLSX and a user opens the export in Excel or Google Sheets, fields beginning with `=`, `+`, `-`, `@`, or tab characters will be interpreted as formulas (CWE-1236 — Improper Neutralization of Formula Elements in a CSV File).

**Impact:** None on this service directly. Listed as informational because the data is collected here and the safest mitigation is to neutralize at the export boundary (prefix with a single quote, or use proper XLSX cell types) rather than during ingest.

**Recommendation:** When/if an export feature is added, sanitize cell values per OWASP's CSV-injection guidance. Do not sanitize on ingest, as it would corrupt legitimate user content.

---

## Confirmation of fixes that did improve the security posture

For completeness, the following changes from BUGS-001 measurably reduce risk:

- **BUG-003** removed an inlined credential from source (still see INFO-1).
- **BUG-005** replaced substring matching with `\b`-bounded regex, eliminating false-positive classifications and avoiding accidental information leakage in `reasoning` strings derived from partial-word hits.
- **BUG-011** rejects malformed quoted CSV instead of silently producing corrupted records.
- **BUG-014** / **BUG-022** / **BUG-023** / **BUG-024** / **BUG-027** / **BUG-028** add explicit null-input rejection at every entry point, closing potential NRE-based DoS surfaces.
- **BUG-015** strips path components from the client-supplied `IFormFile.FileName` before extension inspection, defusing path-traversal-shaped filenames even though the filename is not currently used as a path.
- **BUG-020** closed the resurrect-after-delete TOCTOU in `UpdateAsync` (sibling method still affected — see MEDIUM-1).
- **BUG-021** prevents NRE on null elements in `BulkAddAsync`, returning a structured failure instead.
- **BUG-025** enforces non-empty/whitespace invariants in the `Ticket` constructor.
- **BUG-026** / **BUG-019** reject whitespace-only tag entries at validation time.

---

## Recommended remediation order

1. **CRITICAL-1** — wire up authentication & authorization before any external deployment.
2. **HIGH-1** — invoke `AutoClassifyValidator` in `TicketService.AutoClassifyAsync`.
3. **MEDIUM-1** — switch `UpdateClassificationAsync` to `TryUpdate`.
4. **MEDIUM-2** — `using` the `JsonDocument`.
5. **MEDIUM-3** — explicit `XmlReaderSettings` for the XML parser.
6. **INFO-1** — rotate the exposed API key value at its issuing provider.
7. Remaining LOW items as cleanup.
