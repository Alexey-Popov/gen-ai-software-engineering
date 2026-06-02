# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build the entire solution
dotnet build AiTicketHub.sln

# Run the API (starts on http://localhost:5000, Swagger at /swagger)
dotnet run --project src/AiTicketHub/API

# Run all tests
dotnet test

# Run a single test by name
dotnet test --filter "FullyQualifiedName~CreateTicket_ValidRequest"

# Run tests in a specific class
dotnet test --filter "ClassName~TicketControllerTests"

# Build and publish release
dotnet publish src/AiTicketHub/API -c Release
```

## Architecture

AiTicketHub is an ASP.NET Core 9.0 REST API for customer support ticket management, built with **Clean Architecture** across four projects:

- **`Domain`** — `Ticket` entity, enums (`TicketStatus`, `TicketCategory`, `TicketPriority`, `TicketSource`, `DeviceType`), and the `Result`/`Result<T>` pattern used throughout. No dependencies on other layers.
- **`Application`** — `ITicketService`, `ITicketRepository`, `IClassificationService`, DTOs, FluentValidation validators, and `TicketImportService`. Depends only on Domain.
- **`Infrastructure`** — Concrete implementations: `TicketRepository` (in-memory `ConcurrentDictionary`, **not persistent**), `KeywordClassifier`, and CSV/JSON/XML parsers. Depends on Application.
- **`API`** — `TicketController`, DI wiring (`ApplicationServiceExtensions`, `InfrastructureServiceExtensions`), and `Program.cs`. Depends on Application and Infrastructure.

### Key design patterns

**Result pattern**: All service and repository methods return `Result` or `Result<T>` instead of throwing. The controller's `MapError` method translates `Error.Code` strings to HTTP status codes (`Ticket.NotFound` → 404, `Ticket.InvalidStatus` → 422, etc.).

**Ticket state machine**: `Ticket.TransitionTo()` enforces a strict one-way status chain: `New → InProgress → WaitingCustomer → Resolved → Closed`. Any other transition returns a failure result.

**Keyword-based classification**: `KeywordClassifier` scores ticket subject+description against hard-coded keyword rules. Category is the highest-scoring rule; priority is first-match from Urgent → High → Low (default Medium). No external AI/ML involved.

**Import pipeline**: `POST /api/tickets/import` accepts CSV, JSON, or XML (up to 10 MB). The controller detects format from Content-Type or file extension, delegates to `TicketImportService`, which fans out to the appropriate parser, then bulk-inserts via `ITicketRepository.BulkAddAsync`.

### DI lifetimes

- `ITicketRepository` and `IClassificationService` → **Singleton** (in-memory store must survive requests)
- `ITicketService`, `ITicketImportService`, parsers → **Scoped**

### Tests

The test project (`tests/AiTicketHub.Tests`) uses **NUnit 4**, **FluentAssertions**, **Moq**, and `WebApplicationFactory<Program>` for integration tests. Tests are organized to mirror the source structure: `API/`, `Application/`, `Infrastructure/`. Integration tests in `API/TicketControllerTests.cs` spin up a real in-memory host; unit tests mock `ITicketRepository` and `IClassificationService` directly.
