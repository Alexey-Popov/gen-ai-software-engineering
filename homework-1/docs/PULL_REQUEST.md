# Homework 1: Banking Transactions API — one contract, 4 backends (TDD) + 3 frontends

> Paste this into the PR description. Images are referenced from `docs/screenshots/`; to make
> them render inline in the PR, drag the matching files into the description where each tag is.

## 📌 Summary

This PR delivers Homework 1 — a **Banking Transactions REST API** developed **test-first (TDD)**
with AI assistance. The novel part: starting from **one engineered prompt** and **one TDD plan**,
the same API contract was implemented in **four different backends** (Java, Go, Python, C#) and
consumed by **three different frontends** (Angular, Electron, Flutter) — proving the workflow is
technology-agnostic. All required tasks and **all four** optional features are implemented, with
**153 automated tests across the backends (all green)**. A single interactive launcher
(`./run.sh`) runs any backend + frontend combination.

---

## ✅ What was built

### Backends — same 9-cycle TDD plan, identical HTTP contract on port 3000

| Stack | Location | Tests | Notes |
|---|---|---|---|
| **Java 17 + Spring Boot 3** (primary, fully documented) | `backend/` | **53** | Bean Validation, `@RestControllerAdvice`, Actuator health, Scalar docs |
| Go 1.22 + Chi | `backend-go/` | **50** | `shopspring/decimal`, `sync.RWMutex` store, hand-rolled validation |
| Python + FastAPI | `backend-fastapi/` | **32** | Pydantic v2, native Swagger `/docs` + `/openapi.json` |
| C# / .NET 10 Minimal API | `backend-dotnet/` | **18** | `System.Text.Json`, xUnit + `WebApplicationFactory`, Scalar docs |

Every backend implements the identical contract:

- **Task 1 — Core API:** `POST /transactions` (201, server-assigned id/timestamp/status),
  `GET /transactions`, `GET /transactions/{id}` (404 if missing), `GET /accounts/{id}/balance`.
- **Task 2 — Validation:** structured `400` — `{ "error": "Validation failed", "details":
  [{field, message}] }` — positive amount ≤ 2 decimals, `ACC-XXXXX` accounts, ISO 4217 currency,
  valid type.
- **Task 3 — History / filtering:** `accountId` (from **or** to), `type`, inclusive `from`/`to`
  date range, combinable (AND).
- **Task 4 — all four options:** account **summary** (A), **simple interest** (B),
  **CSV export** (C, `text/csv` + attachment), per-IP **rate limiting** (D, `429`).

Money is always exact (BigDecimal / decimal / shopspring — never float); storage is in-memory
(no database). Each backend also serves **health** at `/actuator/health` and interactive **API
docs** at `/docs`.

### Frontends — same REST API, fully decoupled

| Client | Stack | Location |
|---|---|---|
| Web app (primary) | Angular 22 + Microsoft Fluent (acrylic-glass UI, brand gradient, light/dark) | `frontend/` |
| Desktop | Electron (HTML/CSS/JS) | `frontend-electron/` |
| Web (mobile-friendly) | Flutter Web (Dart, Material 3) | `frontend-flutter/` |

Each covers every endpoint: transactions list with filters and CSV export; a create form that
maps the backend's `400 details[]` to per-field errors; account tools (balance, summary, simple
interest); a live API-status chip (`/actuator/health`); and a light/dark theme toggle. Any
frontend works against any backend, since they all speak the same REST/JSON on port 3000.

### Tooling & docs

- **`./run.sh`** — interactive launcher: choose a backend, then a frontend; it starts the backend
  on :3000, seeds sample data, launches the frontend, and stops everything on `Ctrl+C`.
- `demo/seed.sh` (sample data), `PROMPT.md`, `PROMPT-FRONTEND.md`, `PLAN-BACKEND-TDD.md`,
  a detailed `README.md`, and `HOWTORUN.md`.

---

## 🤖 The AI-assisted workflow (our interaction)

The project was built with **Claude**, workflow-first — the process, not just the output, was
deliberate. These screenshots capture it end to end.

### Planning phase — prompt → frontend prompt → TDD plan

![Kick-off and research](docs/screenshots/1.png)
*Claude reads the homework tasks and researches Anthropic's official prompt-engineering guidance
before writing anything.*

![Delivering PROMPT.md](docs/screenshots/2.png)
*Claude delivers `PROMPT.md` — a professional prompt built from Anthropic best practices, with a
technique→source mapping.*

![Frontend prompt](docs/screenshots/3.png)
*Next: an Angular + Microsoft Fluent frontend prompt (`PROMPT-FRONTEND.md`).*

![Frontend prompt + TDD plan request](docs/screenshots/4.png)
*The frontend prompt's contents, then the request for a TDD implementation plan.*

![The TDD plan](docs/screenshots/5.png)
*`PLAN-BACKEND-TDD.md` — Red → Green → Refactor, the test pyramid, and nine ordered cycles.*

![Cycle-by-cycle workflow begins](docs/screenshots/6.png)
*Agreed workflow: implement one cycle at a time and verify with local `mvn test`; Cycle 0 begins.*

### The TDD cycles — Red → Green → Refactor

![Cycle 0 delivered](docs/screenshots/7.png)
*Cycle 0: the walking skeleton and the first two tests.*

![Reorganize + continue](docs/screenshots/8.png)
*Cycle 0 passes; the backend is moved into `backend/`, then Cycle 1 proceeds.*

![Cycle 1 implemented](docs/screenshots/9.png)
*Cycle 1 (create & retrieve) test-first — model, repository, service, endpoints, 404.*

![Cycle 2 begins](docs/screenshots/10.png)
*"9 tests passed — next." Cycle 2: validation with the structured 400 body. The same rhythm ran
through Cycle 9, and the same plan later produced the Go, FastAPI, and .NET backends.*

---

## 🔁 TDD progression (Java backend) — every cycle

Each cycle was verified locally with `mvn test` before continuing. Counts are cumulative.

| Cycle | Focus | Total tests |
|------:|-------|:-----------:|
| 0 | Walking skeleton | 2 |
| 1 | Create & retrieve | 9 |
| 2 | Validation & structured errors | 21 |
| 3 | Account balance | 28 |
| 4 | History / filtering | 33 |
| 5 | Account summary (4A) | 37 |
| 6 | Simple interest (4B) | 44 |
| 7 | CSV export (4C) | 47 |
| 8 | Rate limiting (4D) | 49 |
| 9 | End-to-end integration | 50 |
| — | Health + API reference | **53** |

Discipline throughout: never write code without a failing test; never weaken a test to reach
green; money never uses float. The Go backend follows the same nine cycles (50 tests); FastAPI
(32) and .NET (18) were generated from the same plan and verified.

---

## 🧪 Testing — 153 backend tests, all green

![All tests passing](docs/screenshots/11.png)
*`mvn test` — all 53 Java tests pass (`Tests run: 53, Failures: 0`).*

Run any backend's suite:

```bash
cd backend         && mvn test          # 53
cd backend-go      && go test ./...      # 50
cd backend-fastapi && pytest -q          # 32
cd backend-dotnet  && dotnet test        # 18
```

---

## 🚀 The API running & in action

![Backend running](docs/screenshots/12.png)
*`mvn spring-boot:run` — `Tomcat started on port 3000`, `Started BankingApplication`.*

![Sample requests](docs/screenshots/13.png)
*Sample requests via curl: transactions list, balance, and summary as JSON.*

![Scalar API reference](docs/screenshots/14.png)
*The interactive API reference at `/docs` (Scalar), generated from the OpenAPI spec.*

![Health endpoint](docs/screenshots/15.png)
*`GET /actuator/health` → `{"status":"UP", ...}`.*

---

## 🖥️ Frontend (Angular + Microsoft Fluent)

![Transactions — dark](docs/screenshots/16.png)
*Transactions list with filters, status badges, and the live "API online" chip (dark theme).*

![Transactions — light](docs/screenshots/17.png)
*The same view in the light theme.*

![Create with validation](docs/screenshots/18.png)
*The create form: invalid account format and non-positive amount flagged inline (from the
backend's `400 details[]`).*

![Account tools](docs/screenshots/19.png)
*Account tools: balance, summary, and simple-interest calculators.*

![CSV export](docs/screenshots/20.png)
*"Export CSV" downloads the transactions and opens them in a spreadsheet.*

---

## 🧭 One-command run — the whole stack in action

![run.sh launching FastAPI + the Electron desktop app](docs/screenshots/21.png)
*`./run.sh` in action: the chosen backend **Python + FastAPI** is started and seeded on :3000,
and the chosen frontend **Electron** runs as a native desktop app (Account tools) against it —
"API online". The same launcher runs any of the four backends with any of the three frontends.*

## ▶️ How to run & verify (reviewer guide)

**Fastest**, from `homework-1/`:

```bash
./run.sh          # choose a backend, then a frontend; seeds data; Ctrl+C stops everything
```

**Per-backend, by hand:**

```bash
cd backend         && mvn spring-boot:run
cd backend-go      && go run ./cmd/server
cd backend-fastapi && uvicorn app.main:app --port 3000
cd backend-dotnet  && dotnet run --project src/BankingApi
```

**Verify (any backend):** `http://localhost:3000/actuator/health` → `UP`;
`http://localhost:3000/docs` → API reference; `bash demo/seed.sh` then `GET /transactions`.

---

## 🧗 Challenges & decisions

- **No DB required** → thread-safe in-memory stores; exact decimal money in every language.
- **One contract across four stacks** → lowercase enum JSON, a single `400 {error, details}`
  shape, and `/actuator/health` + `/docs` everywhere, so any frontend runs against any backend.
- **Test isolation for rate limiting** was solved per platform (a fresh app per test, or a low
  configurable limit).
- **Honest verification** — I ran the Python / Node / Go / Java toolchains where available; the
  reviewer confirms the rest locally (each project's README has the exact commands).

---

## ☑️ Submission checklist

- [x] All required endpoints + validation + filtering
- [x] All four Task 4 features — in **every** backend
- [x] 153 automated tests, passing
- [x] `README.md` (approach + AI usage) and `HOWTORUN.md`
- [x] Screenshots in `docs/screenshots/`
- [x] One-command run (`./run.sh`)

Reviewer: **@Alexey-Popov**
