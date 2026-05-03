# Homework 2 — Architecture Skeleton

Single source of truth for module layout and naming conventions. Authored in Phase 1
(Task 0 scaffold). All later phases must conform to this document; deviations require
updating this file first.

Scope: derived strictly from `homework-2/TASKS.md`. Anything not covered there is listed
under "Open Questions" rather than designed speculatively.

---

## 1. Module Responsibility Table

| Path (under `homework-2/`)                       | Layer        | Responsibility (one sentence)                                                                 |
|--------------------------------------------------|--------------|-----------------------------------------------------------------------------------------------|
| `pyproject.toml`                                 | Build        | Declares package metadata, runtime deps, dev deps, and pytest config (mirrors hw1).           |
| `uv.lock`                                        | Build        | Pinned dependency graph produced by `uv lock` (committed, never hand-edited).                 |
| `.python-version`                                | Build        | Pins interpreter to `3.11` for `uv` / pyenv tooling.                                          |
| `src/app/main.py`                                | App entry    | Builds the FastAPI app, mounts routers, registers the 422→400 validation handler.             |
| `src/app/api/tickets.py`                         | API (router) | HTTP routes for ticket CRUD plus `POST /tickets/:id/auto-classify` (Task 1 + Task 2 surface). |
| `src/app/api/imports.py`                         | API (router) | HTTP route `POST /tickets/import` handling CSV/JSON/XML upload and returning ImportSummary.   |
| `src/app/domain/enums.py`                        | Domain       | String enums: `Category`, `Priority`, `Status`, `Source`, `DeviceType`.                       |
| `src/app/domain/models.py`                       | Domain       | Pydantic v2 models: `Ticket`, `TicketCreate`, `TicketUpdate`, `ImportSummary`, `ClassificationResult`. |
| `src/app/services/store.py`                      | Service      | `InMemoryTicketStore` plus `get_store()` factory used as a FastAPI dependency.                |
| `src/app/services/classifier.py`                 | Service      | Rule-based keyword classifier (Task 2 stub in Phase 1; full implementation in Task 2 phase).  |
| `src/app/services/classification_log.py`         | Service      | Append-only in-memory log of classification decisions (Task 2 stub in Phase 1).               |
| `src/app/services/importers/__init__.py`         | Service      | Package marker; may expose a thin format-dispatch helper later.                               |
| `src/app/services/importers/csv.py`              | Service      | Pure parse function: bytes → `(list[TicketCreate], list[ImportError])`.                       |
| `src/app/services/importers/json.py`             | Service      | Pure parse function for JSON payloads with the same return contract as `csv.py`.              |
| `src/app/services/importers/xml.py`              | Service      | Pure parse function for XML payloads using `defusedxml` exclusively.                          |
| `tests/conftest.py`                              | Tests        | Shared fixtures: `fresh_store`, `client` (with `dependency_overrides`), sample-file paths.    |
| `tests/unit/`                                    | Tests        | Pure-function tests: models, enums, importers, classifier, classification_log.                |
| `tests/integration/`                             | Tests        | API-level tests via `TestClient`: end-to-end flows from TASKS Task 5.                         |
| `demo/`                                          | Demo         | Run script + sample requests + sample data (filled in later phases).                          |
| `docs/screenshots/`                              | Docs         | Holds `test_coverage.png` and any AI-interaction screenshots required by submission rules.    |

---

## 2. Naming Conventions

- **Enums** (`domain/enums.py`): `PascalCase` class name, `lower_snake_case` member values matching
  the wire-format strings in TASKS.md exactly (e.g. `Category.ACCOUNT_ACCESS = "account_access"`).
  Inherit from `str, Enum` so FastAPI/Pydantic serialise members as their string value.
- **Pydantic models** (`domain/models.py`):
  - Aggregate / read model: `Ticket`.
  - Write payloads: `<Entity>Create`, `<Entity>Update` (e.g. `TicketCreate`, `TicketUpdate`).
  - Result/summary objects: `<Subject>Result` or `<Subject>Summary`
    (e.g. `ClassificationResult`, `ImportSummary`).
  - Field names use `snake_case` (matches the JSON keys in TASKS.md, e.g. `customer_id`,
    `created_at`). No alias indirection unless TASKS demands it.
- **Routers** (`api/*.py`): each module exposes a module-level `router = APIRouter(...)`,
  imported in `main.py` as `from app.api.<name> import router as <name>_router`.
  Route handler functions: verb-first snake_case (`create_ticket`, `list_tickets`,
  `import_tickets`, `auto_classify_ticket`).
- **Services**:
  - Class name: `InMemoryTicketStore` (mirrors hw1's `InMemoryTransactionStore`).
  - Factory: `get_store()` — singleton-returning function used both as a FastAPI dependency
    and as the override key in tests.
  - Other service entry points are plain functions, not classes, when they are stateless
    (`classify(ticket: ...)`, `parse_csv(data: bytes)`, `parse_json(...)`, `parse_xml(...)`).
- **Test fixtures** (`tests/conftest.py`):
  - `fresh_store` — returns a brand-new `InMemoryTicketStore` per test.
  - `client` — yields a `TestClient` with `app.dependency_overrides[get_store]` wired to
    `fresh_store`, then clears overrides on teardown.
  - Sample-data fixtures named `sample_<format>_bytes` or `sample_<format>_path`.
- **Test files**: TASKS uses names like `test_ticket_api`. Use `tests/integration/test_ticket_api.py`,
  `tests/unit/test_ticket_model.py`, `tests/unit/test_import_csv.py`, etc. — one TASKS bullet per file.

---

## 3. Key Design Decisions

### 3.1 Store via FastAPI dependency injection
Same pattern as hw1: a module-level singleton `_store` returned by `get_store()`, injected
into routers with `Depends(get_store)`. Tests swap it via
`app.dependency_overrides[get_store] = lambda: fresh_store` for full isolation. No globals
leak between tests. Rationale: proven in hw1; zero new infra; trivially replaceable later
if a real datastore is introduced.

### 3.2 Error envelope (carried verbatim from hw1)
All 4xx responses return:
```json
{ "error": "<short>", "details": [{"field": "<name>", "message": "<text>"}] }
```
Implemented by a single `RequestValidationError` handler in `main.py` that converts
Pydantic 422 → HTTP 400, plus manual construction inside routers for domain-level errors
(e.g. ticket not found → 404 with the same shape). Importer per-row errors use the same
`{field, message}` shape inside `ImportSummary.failed[]`.

### 3.3 Content-type negotiation for `POST /tickets/import`
TASKS does not pin a wire format. Decision for Phase 1:
- The endpoint accepts a single uploaded file via `multipart/form-data` (`UploadFile`).
- Format detection priority: (1) explicit `format` form/query field if present
  (`csv|json|xml`); (2) the uploaded file's MIME type (`text/csv`, `application/json`,
  `application/xml`/`text/xml`); (3) the filename suffix.
- Unknown / conflicting format → 400 with the standard error envelope and
  `field: "format"`.
- The router is a thin adapter: it picks the right pure parser
  (`importers.csv|json|xml`), then calls the store. Parsers themselves are
  transport-agnostic (`bytes -> (list[TicketCreate], list[ImportError])`).

### 3.4 XML parsing with `defusedxml`
`importers/xml.py` MUST import from `defusedxml` (e.g. `defusedxml.ElementTree`) and
never from the stdlib `xml.*` parsers. Rationale: stdlib parsers are vulnerable to
billion-laughs / external-entity attacks on untrusted upload input. `defusedxml` is
added to the runtime dependencies in `pyproject.toml` during Task 0.

### 3.5 Classifier and classification log are stubs in Phase 1
`classifier.py` exposes the function signature returning a `ClassificationResult`
(category, priority, confidence, reasoning, keywords) but raises `NotImplementedError`
or returns a placeholder until the Task 2 phase. `classification_log.py` exposes an
append-only API (`record(...)`, `entries()`) with an in-memory list. This locks the
shape so routers and tests can be written against a stable interface.

### 3.6 Pydantic v2 specifics
- Models use `model_config = ConfigDict(extra="forbid")` for write payloads
  (`TicketCreate`, `TicketUpdate`) so unknown fields produce a 400.
- `customer_email` uses `EmailStr` (requires `pydantic[email]`).
- `created_at` / `updated_at` / `resolved_at` are `datetime` and serialised as ISO 8601;
  generation is server-side, not client-supplied.
- `id` is `UUID` generated server-side on create.

---

## 4. Constraints Carried Forward From Homework 1

These are non-negotiable and inherited explicitly from hw1's accepted solution:

1. **Stack**: Python 3.11+, FastAPI, Pydantic v2, `uv` for env + lock, `pytest` + `pytest-cov`
   + `httpx` for tests. No other runtime frameworks.
2. **Storage**: in-memory only — no SQLite, no Redis, no files-as-DB. State lives in
   `InMemoryTicketStore`.
3. **Test isolation**: every test gets a fresh store via `dependency_overrides`. Never
   mutate the module-level `_store` directly in a test.
4. **Error envelope shape** (section 3.2) is identical to hw1; do not invent a new one.
5. **422 → 400 conversion**: handled centrally in `main.py` via a
   `RequestValidationError` handler — routers do not catch validation errors themselves.
6. **`pyproject.toml` layout**: `[project]` for runtime deps, `[dependency-groups].dev`
   for test deps, `[tool.uv] package = false`, `[tool.pytest.ini_options]` with
   `pythonpath = ["src"]` and `testpaths = ["tests"]`.
7. **Layering**: `api/` depends on `services/` and `domain/`; `services/` depends on
   `domain/`; `domain/` depends on nothing in the app. No upward imports.
8. **Submission hygiene**: PR from `homework-2-submission` on the student fork into the
   fork's `main`; never against upstream.

---

## 5. Open Questions (flagged, not guessed)

The following are ambiguous in `homework-2/TASKS.md` and must be resolved before or
during the relevant later phase. None are decided here.

1. **Import wire format** — TASKS says "Bulk import from CSV/JSON/XML" but does not
   specify whether the request is `multipart/form-data` (file upload) or a raw body with
   a `Content-Type` header. Phase 1 documents a default (section 3.3) but the final
   contract should be confirmed in the Task 1 phase.
2. **Filtering parameters for `GET /tickets`** — TASKS says "with filtering" without
   listing fields. Candidates implied by the model: `status`, `category`, `priority`,
   `assigned_to`, `customer_id`, date ranges on `created_at`. To be finalised in Task 1.
3. **Auto-classify on creation** — TASKS marks "Auto-run on ticket creation (optional
   flag)" without naming the flag. Suggested: a query/body boolean such as
   `auto_classify=true`, but the exact name and default are deferred.
4. **Manual override semantics** — TASKS requires "Allow manual override" for
   classifications. Unclear whether overrides are PUT-on-ticket (just set fields and
   skip the classifier) or a dedicated endpoint. Deferred to Task 2.
5. **Classification confidence storage** — TASKS says "Store classification
   confidence" but the ticket model in TASKS does not include a confidence field.
   Likely lives on the ticket (e.g. `metadata.classification_confidence`) or in
   `classification_log.py`. Deferred to Task 2; do not extend `Ticket` until decided.
6. **Tickets returned by import** — TASKS specifies an import summary shape
   (total / successful / failed-with-errors) but does not say whether successful rows
   are echoed back. Default assumption: only the summary, matching the spec. Confirm
   in Task 1.
7. **XML schema** — TASKS does not define the XML shape (root element name, per-ticket
   element name, attribute vs child-element style). Phase 1 picks a convention in the
   Task 1 phase and documents it in `API_REFERENCE.md`; not decided here.
8. **`defusedxml` dependency** — added to `pyproject.toml` in Task 0 by decision 3.4;
   call this out so reviewers do not see it as an unjustified addition.
9. **`pydantic[email]` extra** — required by `EmailStr` (decision 3.6). Same note: add
   it explicitly in Task 0's `pyproject.toml`.

---

## Summary (read this first)

- **Decided**: directory layout, module responsibilities, naming conventions, store DI
  pattern, error-envelope reuse, defusedxml requirement, Pydantic v2 conventions, and the
  layering rule (`api → services → domain`, never upward).
- **Deferred to Task 1 phase**: final import request contract (multipart vs raw body),
  list of supported filters on `GET /tickets`, XML element naming.
- **Deferred to Task 2 phase**: classifier rules implementation, where classification
  confidence is stored, manual-override flow, and the auto-classify-on-create flag name.
- **Stubs created in Task 0 phase**: `services/classifier.py` and
  `services/classification_log.py` exist with stable signatures so Task 1 routers and
  tests can compile against them.
- **Inviolable carry-overs from hw1**: in-memory store + `get_store()` DI, error envelope
  shape, central 422→400 handler, `pyproject.toml` shape, per-test isolation via
  `dependency_overrides`. Do not redesign these.
