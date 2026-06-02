# Implementation Plan — Bug Fixes 001

Each entry corresponds to a verified (or minor-discrepancy) Finding ID from `verified-research.md`.
BUG-012 is omitted (Critical Discrepancy — described NRE cannot occur).

Test command for every change: `dotnet test AiTicketHub.sln`

---

## BUG-001 — State machine missing transitions

**Target file:** `src/AiTicketHub/Domain/Entities/Ticket.cs`

**Before:**
```csharp
        var isValid = (Status, newStatus) switch
        {
            (TicketStatus.New,        TicketStatus.InProgress) => true,
            (TicketStatus.InProgress, TicketStatus.WaitingCustomer) => true,
            (TicketStatus.Resolved,   TicketStatus.Closed)    => true,
            _ => false
        };
```

**After:**
```csharp
        var isValid = (Status, newStatus) switch
        {
            (TicketStatus.New,             TicketStatus.InProgress)      => true,
            (TicketStatus.InProgress,      TicketStatus.WaitingCustomer) => true,
            (TicketStatus.InProgress,      TicketStatus.Resolved)        => true,
            (TicketStatus.WaitingCustomer, TicketStatus.Resolved)        => true,
            (TicketStatus.Resolved,        TicketStatus.Closed)          => true,
            _ => false
        };
```

---

## BUG-002 — ApplyUpdate accepts empty-string fields

**Target file:** `src/AiTicketHub/Domain/Entities/Ticket.cs`

**Before:**
```csharp
        if (subject     != null)    Subject     = subject;
        if (description != null)    Description = description;
```

**After:**
```csharp
        if (!string.IsNullOrEmpty(subject))     Subject     = subject;
        if (!string.IsNullOrEmpty(description)) Description = description;
```

---

## BUG-003 — Hardcoded API key committed in source

**Target file:** `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`

**Before:**
```csharp
    private const string ClassificationApiKey = "sk-prod-abc123secret987xyz"; // TODO: move to config
```

**After:**
*(line deleted — the field is unused in the classifier body)*
```csharp

```

---

## BUG-004 — Null subject/description causes NRE in Classify

**Target file:** `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`

**Before:**
```csharp
    public ClassificationResult Classify(string subject, string description)
    {
        var text = $"{subject} {description}".ToLowerInvariant();
```

**After:**
```csharp
    public ClassificationResult Classify(string subject, string description)
    {
        var text = $"{subject ?? string.Empty} {description ?? string.Empty}".ToLowerInvariant();
```

---

## BUG-005 — Substring keyword match ("bug" matches "debug")

**Target file:** `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`

**Before** (lines 47–86, all `text.Contains(kw)` calls):
```csharp
        foreach (var (cat, keywords) in CategoryRules)
        {
            int score = 0;
            foreach (var kw in keywords)
            {
                if (!text.Contains(kw)) continue;
                score++;
                found.Add(kw);
            }

            if (score > bestScore)
            {
                bestScore = score;
                category = cat;
            }
        }

        // Collect remaining category keywords that matched but didn't win.
        foreach (var (_, keywords) in CategoryRules)
            foreach (var kw in keywords)
                if (text.Contains(kw)) found.Add(kw);

        // Determine priority; first rule whose any keyword matches wins.
        TicketPriority priority = TicketPriority.Medium;
        foreach (var (pri, keywords) in PriorityRules)
        {
            foreach (var kw in keywords)
            {
                if (!text.Contains(kw)) continue;
                found.Add(kw);
                priority = pri;
                goto priorityResolved;
            }
        }
        priorityResolved:

        // Collect all remaining priority keywords that matched.
        foreach (var (_, keywords) in PriorityRules)
            foreach (var kw in keywords)
                if (text.Contains(kw)) found.Add(kw);
```

**After** (replace all `text.Contains(kw)` with `ContainsWord(text, kw)`, add helper):
```csharp
        foreach (var (cat, keywords) in CategoryRules)
        {
            int score = 0;
            foreach (var kw in keywords)
            {
                if (!ContainsWord(text, kw)) continue;
                score++;
                found.Add(kw);
            }

            if (score > bestScore)
            {
                bestScore = score;
                category = cat;
            }
        }

        // Collect remaining category keywords that matched but didn't win.
        foreach (var (_, keywords) in CategoryRules)
            foreach (var kw in keywords)
                if (ContainsWord(text, kw)) found.Add(kw);

        // Determine priority; first rule whose any keyword matches wins.
        TicketPriority priority = TicketPriority.Medium;
        foreach (var (pri, keywords) in PriorityRules)
        {
            foreach (var kw in keywords)
            {
                if (!ContainsWord(text, kw)) continue;
                found.Add(kw);
                priority = pri;
                goto priorityResolved;
            }
        }
        priorityResolved:

        // Collect all remaining priority keywords that matched.
        foreach (var (_, keywords) in PriorityRules)
            foreach (var kw in keywords)
                if (ContainsWord(text, kw)) found.Add(kw);
```

Also add this helper method at the end of the `KeywordClassifier` class, before the closing `}`:

**Before** (closing brace of class):
```csharp
        return new ClassificationResult(category, priority, confidence, reasoning, keywordsFound);
    }
}
```

**After:**
```csharp
        return new ClassificationResult(category, priority, confidence, reasoning, keywordsFound);
    }

    private static bool ContainsWord(string text, string word) =>
        System.Text.RegularExpressions.Regex.IsMatch(
            text,
            @"\b" + System.Text.RegularExpressions.Regex.Escape(word) + @"\b");
}
```

---

## BUG-006 — Classification not explicitly persisted after CreateTicketAsync

**Target file:** `src/AiTicketHub/Application/Services/TicketService.cs`

**Before:**
```csharp
        if (request.AutoClassify)
        {
            var classification = _classifier.Classify(ticket.Subject, ticket.Description);
            ticket.ApplyClassification(classification.Category, classification.Priority);
        }
```

**After:**
```csharp
        if (request.AutoClassify)
        {
            var classification = _classifier.Classify(ticket.Subject, ticket.Description);
            ticket.ApplyClassification(classification.Category, classification.Priority);
            await _repository.UpdateAsync(ticket);
        }
```

---

## BUG-007 — Pagination total ignores active filters

**Target file:** `src/AiTicketHub/Application/Services/TicketService.cs`

**Before:**
```csharp
        var total    = allResult.Value!.Count;
```

**After:**
```csharp
        var total    = filtered.Count;
```

---

## BUG-008 — UpdateTicketValidator allows whitespace-only Subject/Description

**Target file:** `src/AiTicketHub/Application/Validators/UpdateTicketValidator.cs`

**Before:**
```csharp
        RuleFor(x => x.Subject)
            .MaximumLength(200).WithMessage("Subject cannot exceed 200 characters.")
            .MinimumLength(1).WithMessage("Subject must be at least 1 character.")
            .When(x => x.Subject != null);

        RuleFor(x => x.Description)
            .MinimumLength(10).WithMessage("Description must be at least 10 characters.")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters.")
            .When(x => x.Description != null);
```

**After:**
```csharp
        RuleFor(x => x.Subject)
            .MaximumLength(200).WithMessage("Subject cannot exceed 200 characters.")
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Subject must not be empty or whitespace.")
            .When(x => x.Subject != null);

        RuleFor(x => x.Description)
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Description must not be empty or whitespace.")
            .MinimumLength(10).WithMessage("Description must be at least 10 characters.")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters.")
            .When(x => x.Description != null);
```

---

## BUG-009 — AutoClassifyValidator has no validation rules

**Target file:** `src/AiTicketHub/Application/Validators/AutoClassifyValidator.cs`

**Before:**
```csharp
public class AutoClassifyValidator : AbstractValidator<AutoClassifyRequest>
{
    public AutoClassifyValidator() { }
}
```

**After:**
```csharp
public class AutoClassifyValidator : AbstractValidator<AutoClassifyRequest>
{
    public AutoClassifyValidator()
    {
        RuleFor(x => x.CategoryOverride)
            .IsInEnum().WithMessage("Invalid ticket category.")
            .When(x => x.CategoryOverride.HasValue);

        RuleFor(x => x.PriorityOverride)
            .IsInEnum().WithMessage("Invalid ticket priority.")
            .When(x => x.PriorityOverride.HasValue);
    }
}
```

---

## BUG-010 — CsvTicketParser silently returns empty for short rows

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`

**Before:**
```csharp
            var fields = SplitCsvLine(line);
            var (record, error) = MapRow(headers, fields, rowNumber);
```

**After:**
```csharp
            var fields = SplitCsvLine(line);
            if (fields.Length < headers.Count)
            {
                errors.Add(new ParseRowError(rowNumber,
                    $"Row has {fields.Length} column(s) but header declares {headers.Count}."));
                continue;
            }
            var (record, error) = MapRow(headers, fields, rowNumber);
```

---

## BUG-011 — CsvTicketParser silently accepts unclosed quoted fields

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`

**Change 1 — detect unclosed quote in SplitCsvLine:**

**Before:**
```csharp
        fields.Add(current.ToString());
        return fields.ToArray();
    }
```

**After:**
```csharp
        if (inQuotes)
            throw new FormatException("Unterminated quoted field in CSV line.");
        fields.Add(current.ToString());
        return fields.ToArray();
    }
```

**Change 2 — catch FormatException in ParseAsync loop** (applies to the same BUG-011 fix; update the call site from BUG-010's After block):

**Before** (after BUG-010 is applied):
```csharp
            var fields = SplitCsvLine(line);
            if (fields.Length < headers.Count)
```

**After:**
```csharp
            string[] fields;
            try { fields = SplitCsvLine(line); }
            catch (FormatException ex)
            {
                errors.Add(new ParseRowError(rowNumber, ex.Message));
                continue;
            }
            if (fields.Length < headers.Count)
```

---

## BUG-013 — XmlTicketParser GetValue collapses whitespace-only elements to null

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`

**Before:**
```csharp
    private static string? GetValue(XElement parent, string name)
    {
        var child = parent.Elements()
            .FirstOrDefault(e => e.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase));
        var value = child?.Value.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
    }
```

**After:**
```csharp
    private static string? GetValue(XElement parent, string name)
    {
        var child = parent.Elements()
            .FirstOrDefault(e => e.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (child == null) return null;
        return child.Value.Trim();
    }
```

---

## BUG-014 — TicketController CreateTicket no null guard on request body

**Target file:** `src/AiTicketHub/API/Controllers/TicketController.cs`

**Before:**
```csharp
    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        var result = await _service.CreateTicketAsync(request);
```

**After:**
```csharp
    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest? request)
    {
        if (request == null)
            return BadRequest(new { code = "Validation.Failed", message = "Request body is required." });
        var result = await _service.CreateTicketAsync(request);
```

---

## BUG-015 — TicketController filename not sanitized before use

**Target file:** `src/AiTicketHub/API/Controllers/TicketController.cs`

**Before:**
```csharp
        var format = DetectFormat(file.ContentType, Path.GetExtension(file.FileName));
```

**After:**
```csharp
        var safeExtension = Path.GetExtension(Path.GetFileName(file.FileName ?? string.Empty));
        var format = DetectFormat(file.ContentType, safeExtension);
```

---

## BUG-016 — TicketImportService.ImportAsync NRE when format is null

**Target file:** `src/AiTicketHub/Application/Services/TicketImportService.cs`

**Before:**
```csharp
    public async Task<ImportTicketsResponse> ImportAsync(Stream input, string format, CancellationToken ct = default)
    {
        var parseResult = format.ToLowerInvariant() switch
```

**After:**
```csharp
    public async Task<ImportTicketsResponse> ImportAsync(Stream input, string format, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(format, nameof(format));
        var parseResult = format.ToLowerInvariant() switch
```

---

## BUG-017 — TicketImportService bulk-insert error reports wrong row numbers

**Target file:** `src/AiTicketHub/Application/Services/TicketImportService.cs`

**Before:**
```csharp
                    allErrors.Add(new ImportErrorItem(parseResult.Errors.Count + i + 1, bulkResults[i].Error!.Message));
```

**After:**
```csharp
                    allErrors.Add(new ImportErrorItem(i + 1, bulkResults[i].Error!.Message));
```

---

## BUG-018 — TicketService.AutoClassifyAsync NRE when request is null

**Target file:** `src/AiTicketHub/Application/Services/TicketService.cs`

**Before:**
```csharp
    public async Task<Result<AutoClassifyResponse>> AutoClassifyAsync(Guid id, AutoClassifyRequest request)
    {
        var getResult = await _repository.GetByIdAsync(id);
```

**After:**
```csharp
    public async Task<Result<AutoClassifyResponse>> AutoClassifyAsync(Guid id, AutoClassifyRequest request)
    {
        request ??= new AutoClassifyRequest();
        var getResult = await _repository.GetByIdAsync(id);
```

---

## BUG-019 — CreateTicketRequest Tags has no element-level validation

**Target file:** `src/AiTicketHub/Application/Validators/CreateTicketValidator.cs`

*(No change to the DTO record itself; element-level validation belongs in the validator. Fix is identical to BUG-026 below and must be applied once in `CreateTicketValidator.cs`.)*

---

## BUG-020 — TicketRepository.UpdateAsync TOCTOU with concurrent delete

**Target file:** `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`

**Before:**
```csharp
    public Task<Result<Ticket>> UpdateAsync(Ticket ticket)
    {
        if (!_store.TryGetValue(ticket.Id, out _))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        _store[ticket.Id] = ticket;
        return Task.FromResult(Result<Ticket>.Success(ticket));
    }
```

**After:**
```csharp
    public Task<Result<Ticket>> UpdateAsync(Ticket ticket)
    {
        if (!_store.TryGetValue(ticket.Id, out var existing))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        // TryUpdate atomically replaces only if the stored reference has not changed,
        // preventing silent resurrection of a concurrently-deleted ticket.
        if (!_store.TryUpdate(ticket.Id, ticket, existing))
            return Task.FromResult(Result<Ticket>.Failure(Errors.TicketNotFound));

        return Task.FromResult(Result<Ticket>.Success(ticket));
    }
```

---

## BUG-021 — TicketRepository.BulkAddAsync no null guard on collection or elements

**Target file:** `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`

**Before:**
```csharp
    public Task<IReadOnlyList<Result<Ticket>>> BulkAddAsync(IReadOnlyList<Ticket> tickets)
    {
        var results = new List<Result<Ticket>>(tickets.Count);
        foreach (var ticket in tickets)
        {
            results.Add(_store.TryAdd(ticket.Id, ticket)
                ? Result<Ticket>.Success(ticket)
                : Result<Ticket>.Failure(Errors.TicketDuplicate));
        }
        return Task.FromResult<IReadOnlyList<Result<Ticket>>>(results);
    }
```

**After:**
```csharp
    public Task<IReadOnlyList<Result<Ticket>>> BulkAddAsync(IReadOnlyList<Ticket> tickets)
    {
        ArgumentNullException.ThrowIfNull(tickets);
        var results = new List<Result<Ticket>>(tickets.Count);
        foreach (var ticket in tickets)
        {
            if (ticket == null)
            {
                results.Add(Result<Ticket>.Failure(new Error("Ticket.Invalid", "Ticket element must not be null.")));
                continue;
            }
            results.Add(_store.TryAdd(ticket.Id, ticket)
                ? Result<Ticket>.Success(ticket)
                : Result<Ticket>.Failure(Errors.TicketDuplicate));
        }
        return Task.FromResult<IReadOnlyList<Result<Ticket>>>(results);
    }
```

---

## BUG-022 — JsonTicketParser.ParseAsync NRE on null input stream

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/JsonTicketParser.cs`

**Before:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer the stream so we can check for empty content
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
```

**After:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer the stream so we can check for empty content
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
```

---

## BUG-023 — XmlTicketParser.ParseAsync NRE on null input stream

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/XmlTicketParser.cs`

**Before:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer stream to check emptiness
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
```

**After:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        // Buffer stream to check emptiness
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
```

---

## BUG-024 — CsvTicketParser.ParseAsync NRE on null input stream

**Target file:** `src/AiTicketHub/Infrastructure/Parsers/CsvTicketParser.cs`

**Before:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        using var reader = new StreamReader(input, Encoding.UTF8, leaveOpen: true);
```

**After:**
```csharp
    public async Task<ParseResult<TicketImportRecord>> ParseAsync(Stream input, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        var records = new List<TicketImportRecord>();
        var errors  = new List<ParseRowError>();

        using var reader = new StreamReader(input, Encoding.UTF8, leaveOpen: true);
```

---

## BUG-025 — Ticket constructor accepts null/empty required fields

**Target file:** `src/AiTicketHub/Domain/Entities/Ticket.cs`

**Before:**
```csharp
    {
        Id = id;
        CustomerId = customerId;
        CustomerEmail = customerEmail;
        CustomerName = customerName;
        Subject = subject;
        Description = description;
        Category = category;
        Priority = priority;
        Status = status;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
        ResolvedAt = resolvedAt;
        AssignedTo = assignedTo;
        Tags = tags;
        Source = source;
        Browser = browser;
        DeviceType = deviceType;
    }
```

**After:**
```csharp
    {
        if (string.IsNullOrWhiteSpace(customerId))    throw new ArgumentException("CustomerId is required.",    nameof(customerId));
        if (string.IsNullOrWhiteSpace(customerEmail)) throw new ArgumentException("CustomerEmail is required.", nameof(customerEmail));
        if (string.IsNullOrWhiteSpace(customerName))  throw new ArgumentException("CustomerName is required.",  nameof(customerName));
        if (string.IsNullOrWhiteSpace(subject))       throw new ArgumentException("Subject is required.",       nameof(subject));
        if (string.IsNullOrWhiteSpace(description))   throw new ArgumentException("Description is required.",   nameof(description));
        Id = id;
        CustomerId = customerId;
        CustomerEmail = customerEmail;
        CustomerName = customerName;
        Subject = subject;
        Description = description;
        Category = category;
        Priority = priority;
        Status = status;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
        ResolvedAt = resolvedAt;
        AssignedTo = assignedTo;
        Tags = tags;
        Source = source;
        Browser = browser;
        DeviceType = deviceType;
    }
```

---

## BUG-026 — CreateTicketValidator Tags only enforces NotNull (also covers BUG-019)

**Target file:** `src/AiTicketHub/Application/Validators/CreateTicketValidator.cs`

**Before:**
```csharp
        RuleFor(x => x.Tags)
            .NotNull().WithMessage("Tags must not be null.");
    }
}
```

**After:**
```csharp
        RuleFor(x => x.Tags)
            .NotNull().WithMessage("Tags must not be null.");
        RuleForEach(x => x.Tags)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Tag entries must not be empty or whitespace.")
            .When(x => x.Tags != null);
    }
}
```

---

## BUG-027 — TicketService.CreateTicketAsync passes null to validator

**Target file:** `src/AiTicketHub/Application/Services/TicketService.cs`

**Before:**
```csharp
    public async Task<Result<CreateTicketResponse>> CreateTicketAsync(CreateTicketRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
```

**After:**
```csharp
    public async Task<Result<CreateTicketResponse>> CreateTicketAsync(CreateTicketRequest request)
    {
        if (request == null)
            return Result<CreateTicketResponse>.Failure(new Error(Errors.ValidationFailed.Code, "Request must not be null."));
        var validation = await _createValidator.ValidateAsync(request);
```

---

## BUG-028 — TicketService.UpdateTicketAsync passes null to validator

**Target file:** `src/AiTicketHub/Application/Services/TicketService.cs`

**Before:**
```csharp
    public async Task<Result<UpdateTicketResponse>> UpdateTicketAsync(Guid id, UpdateTicketRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
```

**After:**
```csharp
    public async Task<Result<UpdateTicketResponse>> UpdateTicketAsync(Guid id, UpdateTicketRequest request)
    {
        if (request == null)
            return Result<UpdateTicketResponse>.Failure(new Error(Errors.ValidationFailed.Code, "Request must not be null."));
        var validation = await _updateValidator.ValidateAsync(request);
```

---

## BUG-029 — TicketRepository.AddAsync NRE on null ticket

**Target file:** `src/AiTicketHub/Infrastructure/Repositories/TicketRepository.cs`

**Before:**
```csharp
    public Task<Result<Ticket>> AddAsync(Ticket ticket)
    {
        if (!_store.TryAdd(ticket.Id, ticket))
```

**After:**
```csharp
    public Task<Result<Ticket>> AddAsync(Ticket ticket)
    {
        ArgumentNullException.ThrowIfNull(ticket);
        if (!_store.TryAdd(ticket.Id, ticket))
```

---

## BUG-030 — KeywordClassifier silently returns zero confidence when unconfigured

**Target file:** `src/AiTicketHub/Infrastructure/Services/KeywordClassifier.cs`

**Before:**
```csharp
        var keywordsFound = found.ToList();
        double confidence = TotalKeywords == 0
            ? 0.0
            : Math.Round(Math.Clamp((double)keywordsFound.Count / TotalKeywords, 0.0, 1.0), 4);
```

**After:**
```csharp
        var keywordsFound = found.ToList();
        if (TotalKeywords == 0)
            _logger.LogWarning("KeywordClassifier has no keywords configured; all classifications will use defaults.");
        double confidence = TotalKeywords == 0
            ? 0.0
            : Math.Round(Math.Clamp((double)keywordsFound.Count / TotalKeywords, 0.0, 1.0), 4);
```

---

## Application order and notes

Apply changes in this order to avoid conflicts within shared files:

1. `Ticket.cs` — BUG-025 (constructor guards), then BUG-001 (state machine), then BUG-002 (ApplyUpdate)
2. `KeywordClassifier.cs` — BUG-003 (remove key), BUG-004 (null guard), BUG-005 (word match + helper), BUG-030 (log warning)
3. `TicketService.cs` — BUG-027, BUG-006, BUG-007, BUG-028, BUG-018
4. `TicketRepository.cs` — BUG-029, BUG-020, BUG-021
5. `CsvTicketParser.cs` — BUG-024, BUG-010, BUG-011 (both changes)
6. `JsonTicketParser.cs` — BUG-022
7. `XmlTicketParser.cs` — BUG-023, BUG-013
8. `TicketController.cs` — BUG-014, BUG-015
9. `TicketImportService.cs` — BUG-016, BUG-017
10. `UpdateTicketValidator.cs` — BUG-008
11. `AutoClassifyValidator.cs` — BUG-009
12. `CreateTicketValidator.cs` — BUG-026 (covers BUG-019)
