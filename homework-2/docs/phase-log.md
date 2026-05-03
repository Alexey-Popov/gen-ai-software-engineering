# Homework-2 Phase Log

Rolling log of per-phase summaries. Updated after each agent phase.

## Task 0 / Phase 1 — Architect
- Produced architecture-skeleton.md
- Locked layout, naming conventions, DI pattern, error envelope
- defusedxml + pydantic[email] added to deps
- Deferred: filter params, XML schema, auto-classify flag name, confidence storage
- Open questions flagged in architecture-skeleton.md §5

## Task 0 / Phase 3 — Developer (scaffold)
- Created pyproject.toml (support-tickets-api, runtime + dev deps, uv + pytest config)
- Created all package __init__.py files and directory structure under src/app/ and tests/
- Implemented domain layer: enums.py (Category, Priority, Status, Source, DeviceType) and models.py (TicketMetadata, TicketCreate, TicketUpdate, Ticket, ImportError, ImportSummary, ClassificationResult)
- Implemented InMemoryTicketStore with insert/get/list_all/update/delete/filter methods and get_store() singleton factory
- Created stubs for classifier.py, classification_log.py, and all three importers (csv/json/xml) — all raise NotImplementedError with descriptive messages
- Created stub routers (tickets.py, imports.py) — all handlers return HTTP 501 Not Implemented
- Wired main.py with both routers and the RequestValidationError → 400 handler (identical envelope to hw1)
- Created tests/conftest.py with fresh_store and client fixtures using dependency_overrides
- Verified: `uv sync` succeeds and `from app.main import app` imports cleanly
