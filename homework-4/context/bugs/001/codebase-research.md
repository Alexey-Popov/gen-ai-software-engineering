# Codebase Research — Bug Findings

Reviewed all `.cs` source files under `homework-4/src/AiTicketHub`. Findings below are ordered by severity/layer.

---

## BUG-001

**File:** `homework-4/src/AiTicketHub/Domain/Entities/Ticket.cs`  
**Line:** 66–86  
**Snippet:**
```csharp
var isValid = (Status, newStatus) switch
{
    (TicketStatus.New,        TicketStatus.InProgress)      => true,
    (TicketStatus.InProgress, TicketStatus.WaitingCustomer) => true,
    (TicketStatus.Resolved,   TicketStatus.Closed)          => true,
    _ => false
};
```
**Description:** The state machine is missing at least one expected transition: `InProgress → Resolved` and `WaitingCustomer → Resolved`/`WaitingCustomer → InProgress` are both rejected, leaving tickets stuck with no path to `Resolved` from `InProgress` directly.

---

## BUG-002

**File:** `homework-4/src/AiTicketHub/Domain/Entities/Ticket.cs`  
**Line:** 105–125  
**Snippet:**
```csharp
if (subject     != null)    Subject     = subject;
if (description != null)    Description = description;
```
**Description:** `ApplyUpdate` accepts and stores empty strings for `subject` and `description` because the null guard does not reject `""`, allowing required fields to be blanked out silently.

---

## BUG-003

**File:** `homework-4/src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`  
**Line:** 12  
**Snippet:**
```csharp
private const string ClassificationApiKey = "sk-prod-abc123secret987xyz"; // TODO: move to config
```
**Description:** A hardcoded secret API key is committed in source code, exposing a credential in version history and to anyone with repo access.

---

## BUG-004

**File:** `homework-4/src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`  
**Line:** 38  
**Snippet:**
```csharp
public ClassificationResult Classify(string subject, string description)
```
**Description:** `subject` and `description` are not null-checked; passing `null` for either causes a `NullReferenceException` at `$"{subject} {description}".ToLowerInvariant()`.

---

## BUG-005

**File:** `homework-4/src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`  
**Line:** 51–52  
**Snippet:**
```csharp
if (!text.Contains(kw)) continue;
score++;
```
**Description:** Keyword matching uses plain substring search, so short keywords like `"bug"` falsely match unrelated words such as `"debug"` or `"debugger"`, skewing classification scores.

---

## BUG-006

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketService.cs`  
**Line:** 64–68  
**Snippet:**
```csharp
if (request.AutoClassify)
{
    var classification = _classifier.Classify(ticket.Subject, ticket.Description);
    ticket.ApplyClassification(classification.Category, classification.Priority);
}
```
**Description:** After auto-classification the modified ticket is never persisted; the repository still holds the original unclassified data, so subsequent `GET` calls return stale category/priority values.

---

## BUG-007

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketService.cs`  
**Line:** 95  
**Snippet:**
```csharp
var total = allResult.Value!.Count;
```
**Description:** `total` counts all tickets in the store rather than the post-filter count, causing the pagination response to report an incorrect total when filters are applied.

---

## BUG-008

**File:** `homework-4/src/AiTicketHub/Application/Validators/UpdateTicketValidator.cs`  
**Line:** 7–15  
**Snippet:**
```csharp
RuleFor(x => x.Subject)
    .MaximumLength(200).WithMessage("Subject cannot exceed 200 characters.")
    .MinimumLength(1).WithMessage("Subject must be at least 1 character.")
    .When(x => x.Subject != null);
```
**Description:** `MinimumLength(1)` does not reject whitespace-only strings, so `Subject = " "` passes validation and overwrites the stored subject with blank content.

---

## BUG-009

**File:** `homework-4/src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs`  
**Line:** 7–10  
**Snippet:**
```csharp
public class AutoClassifyValidator : AbstractValidator<AutoClassifyRequest>
{
    public AutoClassifyValidator() { }
}
```
**Description:** The validator is a no-op stub with no rules, providing zero input validation for the auto-classify endpoint.

---

## BUG-010

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`  
**Line:** 47–54  
**Snippet:**
```csharp
string Get(string name)
{
    string key = name.ToLowerInvariant();
    return headers.TryGetValue(key, out int idx) && idx < fields.Length
        ? fields[idx].Trim()
        : string.Empty;
}
```
**Description:** When a CSV header index exceeds the number of fields in a data row (`idx >= fields.Length`), the helper silently returns `string.Empty`, which causes mandatory-field validation to fail with a misleading "field missing" error rather than "row too short".

---

## BUG-011

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`  
**Line:** 143–177  
**Snippet:**
```csharp
bool inQuotes = false;
// ... loop exits with inQuotes still true if quote is unclosed
fields.Add(current.ToString());
return fields.ToArray();
```
**Description:** The CSV line splitter does not detect unclosed quoted fields; an unterminated quote silently merges the remainder of the line into the last field without raising an error.

---

## BUG-012

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs`  
**Line:** 162  
**Snippet:**
```csharp
.Select(e => e.GetString()!.Trim())
```
**Description:** The null-forgiving operator suppresses the compiler warning but `GetString()` can still return `null` for a JSON `null` element inside the array, causing a `NullReferenceException` at runtime.

---

## BUG-013

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`  
**Line:** 143–149  
**Snippet:**
```csharp
var value = child?.Value.Trim();
return string.IsNullOrEmpty(value) ? null : value;
```
**Description:** A whitespace-only XML element value is trimmed to empty and mapped to `null`, silently converting an intentionally empty string into a "field missing" result and potentially triggering incorrect validation errors.

---

## BUG-014

**File:** `homework-4/src/AiTicketHub/API/Controllers/TicketController.cs`  
**Line:** 18–24  
**Snippet:**
```csharp
[HttpPost]
public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
{
    var result = await _service.CreateTicketAsync(request);
```
**Description:** No explicit null guard on `request`; if the JSON body is missing or malformed and model binding yields `null`, the call propagates into the service layer where it throws instead of returning a clean 400 response.

---

## BUG-015

**File:** `homework-4/src/AiTicketHub/API/Controllers/TicketController.cs`  
**Line:** 65–83  
**Snippet:**
```csharp
var format = DetectFormat(file.ContentType, Path.GetExtension(file.FileName));
```
**Description:** `file.FileName` is user-controlled and not sanitized; a crafted filename (e.g., path-traversal sequences or null bytes) is passed directly to `Path.GetExtension`, and the raw filename is not logged or audited.

---

## BUG-016

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketImportService.cs`  
**Line:** 29–37  
**Snippet:**
```csharp
var parseResult = format.ToLowerInvariant() switch
{
    "csv"  => ...,
    "json" => ...,
    "xml"  => ...,
    _      => throw new ArgumentException($"Unsupported format '{format}'.", nameof(format))
};
```
**Description:** If `format` is `null`, calling `.ToLowerInvariant()` throws a `NullReferenceException` before the switch even executes, bypassing the caller's error-handling path.

---

## BUG-017

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketImportService.cs`  
**Line:** 57  
**Snippet:**
```csharp
allErrors.Add(new ImportErrorItem(parseResult.Errors.Count + i + 1, bulkResults[i].Error!.Message));
```
**Description:** Row numbers for bulk-insert failures are computed as `parseErrors.Count + i + 1`, which is wrong when parse errors are interspersed with successful records; the reported row number will not correspond to the actual input row.

---

## BUG-018

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketService.cs`  
**Line:** 165–187  
**Snippet:**
```csharp
public async Task<Result<AutoClassifyResponse>> AutoClassifyAsync(Guid id, AutoClassifyRequest request)
{
    ...
    var category = request.CategoryOverride ?? classification.Category;
    var priority = request.PriorityOverride ?? classification.Priority;
```
**Description:** `request` is not null-checked; if the caller passes `null`, accessing `request.CategoryOverride` throws a `NullReferenceException` at runtime.

---

## BUG-019

**File:** `homework-4/src/AiTicketHub/Application/DTOs/CreateTicketRequest.cs`  
**Line:** 6–20  
**Snippet:**
```csharp
public record CreateTicketRequest(
    ...
    List<string> Tags,
    ...
);
```
**Description:** `Tags` is a non-nullable `List<string>` with no validation preventing null elements or whitespace-only strings inside the list.

---

## BUG-020

**File:** `homework-4/src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`  
**Line:** 37–44  
**Snippet:**
```csharp
if (!_store.TryGetValue(ticket.Id, out _))
    return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

_store[ticket.Id] = ticket;
```
**Description:** There is a TOCTOU race condition: a concurrent delete can remove the ticket between the `TryGetValue` existence check and the `_store[ticket.Id] = ticket` write, silently re-inserting a deleted ticket.

---

## BUG-021

**File:** `homework-4/src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`  
**Line:** 54–64  
**Snippet:**
```csharp
public Task<IReadOnlyList<Result<Ticket>>> BulkAddAsync(IReadOnlyList<Ticket> tickets)
{
    var results = new List<Result<Ticket>>(tickets.Count);
    foreach (var ticket in tickets)
    {
        results.Add(_store.TryAdd(ticket.Id, ticket) ...);
    }
```
**Description:** No null check on the `tickets` parameter or its elements; passing `null` or a list containing `null` elements causes a `NullReferenceException` inside the loop.

---

## BUG-022

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs`  
**Line:** 11–21  
**Snippet:**
```csharp
using var buffer = new MemoryStream();
await input.CopyToAsync(buffer, ct);
```
**Description:** No null check on the `input` stream; if `null` is passed, `CopyToAsync` throws a `NullReferenceException` rather than a descriptive `ArgumentNullException`.

---

## BUG-023

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`  
**Line:** 11–21  
**Snippet:**
```csharp
using var buffer = new MemoryStream();
await input.CopyToAsync(buffer, ct);
```
**Description:** No null check on the `input` stream; same issue as BUG-022 for the XML parser.

---

## BUG-024

**File:** `homework-4/src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`  
**Line:** 11–16  
**Snippet:**
```csharp
using var reader = new StreamReader(input, Encoding.UTF8, leaveOpen: true);
```
**Description:** No null check on the `input` stream; a `null` argument propagates to `StreamReader`'s constructor instead of being caught at the parser's public boundary.

---

## BUG-025

**File:** `homework-4/src/AiTicketHub/Domain/Entities/Ticket.cs`  
**Line:** 27–63  
**Snippet:**
```csharp
public Ticket(
    Guid id,
    string customerId,
    string customerEmail,
    string customerName,
    string subject,
    string description,
    ...
    List<string> tags,
    ...)
```
**Description:** The constructor accepts and stores `null` or empty values for required fields (`customerId`, `customerEmail`, `customerName`, `subject`, `description`, `tags`) without any guard, allowing the domain entity to reach an invalid state.

---

## BUG-026

**File:** `homework-4/src/AiTicketHub/Application/Validators/CreateTicketValidator.cs`  
**Line:** 42–44  
**Snippet:**
```csharp
RuleFor(x => x.Tags)
    .NotNull().WithMessage("Tags must not be null.");
```
**Description:** `Tags` validation only rejects `null`; it permits an empty list, lists with only whitespace strings, and lists with duplicate tags, all of which may be invalid per business rules.

---

## BUG-027

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketService.cs`  
**Line:** 33–35  
**Snippet:**
```csharp
public async Task<Result<CreateTicketResponse>> CreateTicketAsync(CreateTicketRequest request)
{
    var validation = await _createValidator.ValidateAsync(request);
```
**Description:** `request` is not null-checked before being passed to the validator; a `null` argument results in a `NullReferenceException` inside FluentValidation rather than a clean validation failure.

---

## BUG-028

**File:** `homework-4/src/AiTicketHub/Application/Services/TicketService.cs`  
**Line:** 108–110  
**Snippet:**
```csharp
public async Task<Result<UpdateTicketResponse>> UpdateTicketAsync(Guid id, UpdateTicketRequest request)
{
    var validation = await _updateValidator.ValidateAsync(request);
```
**Description:** Same null-request issue as BUG-027 applies to `UpdateTicketAsync`; no guard before the validator call.

---

## BUG-029

**File:** `homework-4/src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`  
**Line:** 15–20  
**Snippet:**
```csharp
public Task<Result<Ticket>> AddAsync(Ticket ticket)
{
    if (!_store.TryAdd(ticket.Id, ticket))
        return Task.FromResult(Result<Ticket>.Failure(Errors.TicketDuplicate));
```
**Description:** No null check on `ticket`; a `null` argument causes a `NullReferenceException` accessing `ticket.Id` rather than returning a proper failure result.

---

## BUG-030

**File:** `homework-4/src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`  
**Line:** 89–91  
**Snippet:**
```csharp
double confidence = TotalKeywords == 0
    ? 0.0
    : Math.Round(Math.Clamp((double)keywordsFound.Count / TotalKeywords, 0.0, 1.0), 4);
```
**Description:** When all keyword rule arrays are empty `TotalKeywords` is 0 and confidence is hardcoded to `0.0` regardless of actual matches, silently masking a misconfigured classifier with no error or warning.
