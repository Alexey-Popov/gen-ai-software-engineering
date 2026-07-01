# 🟦 Banking API — C# / .NET 8 Minimal API (alternative backend)

A fourth implementation of the Banking Transactions API, in **C# with ASP.NET Core Minimal
APIs**, built from the same plan and exposing the **same HTTP contract on port 3000** — so the
Angular frontend works against it unchanged.

> Java (primary) is in [`../backend/`](../backend); Go in [`../backend-go/`](../backend-go);
> FastAPI in [`../backend-fastapi/`](../backend-fastapi).

## Prerequisites

- **.NET 10 SDK** (`dotnet --version` → 10.x) — https://dotnet.microsoft.com/download

## Run

```bash
cd homework-1/backend-dotnet
dotnet run --project src/BankingApi      # API on http://localhost:3000
```

## Test

```bash
cd homework-1/backend-dotnet
dotnet test                              # xUnit + WebApplicationFactory (18 tests)
```

## Health & API reference

- **API reference (Scalar):** http://localhost:3000/docs
- **OpenAPI spec:** http://localhost:3000/openapi/v1.json
- **Health:** http://localhost:3000/actuator/health → `{"status":"UP"}`

## Design notes

- **Framework:** ASP.NET Core Minimal APIs (.NET 10), endpoints declared in `Program.cs`.
- **Money:** `decimal` throughout (exact; serialized as JSON numbers by `System.Text.Json`).
- **JSON:** camelCase property policy + `JsonStringEnumConverter` (lowercase enums:
  `deposit`/`completed`).
- **Validation:** hand-written `TransactionValidator` → shared
  `400 {error:"Validation failed", details:[{field,message}]}` shape.
- **Storage:** in-memory `ConcurrentDictionary` (no database).
- **Rate limiting:** custom per-IP fixed-window middleware → `429` (limit configurable via
  `RateLimit:Limit`, used by the tests).
- **Docs:** built-in `Microsoft.AspNetCore.OpenApi` serves the spec at `/openapi/v1.json`,
  rendered by **Scalar** (CDN) at `/docs`.
- **Tests:** xUnit with `WebApplicationFactory<Program>`; each test spins up a fresh app
  (isolated in-memory store).

> This project was generated from the shared TDD plan but **not compiled in the generation
> environment** (.NET / NuGet were unavailable there). Run `dotnet test` locally; report any
> compile issues and they can be fixed quickly.
