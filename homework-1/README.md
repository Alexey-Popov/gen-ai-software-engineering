# Banking Transactions API

> **Student:** Ilya Chantsov
> **Course:** AI-Assisted Development
> **AI Tools Used:** Claude Code (claude-sonnet-4-6)

A simple REST API for banking transactions built with Python and FastAPI.

---

## Features

- **Task 1 — Core endpoints:** Create transactions, list all, get by ID, check account balance
- **Task 2 — Validation:** Pydantic-powered validation for amount (positive, ≤ 2 decimal places), account format (`ACC-XXXXX`), and ISO 4217 currency codes — returns structured 400 errors
- **Task 3 — Filtering:** Filter transactions by account ID, type, and date range; filters are fully combinable
- **Task 4 — Account summary:** `GET /accounts/{id}/summary` returns total deposits, total withdrawals, transaction count, and most recent transaction date

---

## Tech Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| Framework | FastAPI | REST API with auto-generated Swagger UI |
| Validation | Pydantic v2 | Request/response models and field validators |
| Server | Uvicorn | ASGI server |
| Testing | pytest + httpx | Automated test suite |

---

## Why FastAPI?

This is a training project. The primary goal is to minimize setup friction — for any reviewer, and for myself as the person building it. Every extra tool that must be installed (Postman, Bruno, curl knowledge) is friction that distracts from the actual learning objective.

FastAPI ships with Swagger UI built in: start the server, open a browser, test everything interactively. No extra software beyond Python itself — for anyone.

Two additional reasons:

- **Pydantic integration** — all validation rules (Task 2) are declared as field validators with minimal boilerplate; no manual if/else chains
- **Modern and type-safe** — full Python type hints throughout, better developer experience

---

## Architecture

- **In-memory storage:** A module-level dict in `src/models/transaction.py` — no database, no persistence between restarts. Keeps the implementation focused on API logic.
- **Pydantic v2 models:** `TransactionCreate` handles all input validation; `Transaction` extends it with auto-generated `id`, `timestamp`, and `status`.
- **Two routers:** `src/routes/transactions.py` handles `/transactions` endpoints; `src/routes/accounts.py` handles `/accounts` endpoints.
- **Custom 400 handler:** FastAPI's default 422 validation response is overridden to return 400 with the structured `{"error": ..., "details": [...]}` format.

---

## Project Structure

```
homework-1/
├── src/
│   ├── app.py                  # FastAPI app + routers + error handler
│   ├── models/
│   │   └── transaction.py      # Pydantic models + in-memory store
│   └── routes/
│       ├── transactions.py     # /transactions endpoints
│       └── accounts.py         # /accounts endpoints
├── tests/
│   └── test_api.py             # pytest test suite
├── demo/
│   ├── run.sh                  # One-command startup
│   ├── sample-requests.http    # VS Code REST Client requests
│   └── sample-data.json        # Sample payloads
├── docs/
│   └── screenshots/
├── requirements.txt
└── HOWTORUN.md
```

---

## AI Tools Used

**Tool:** Claude Code (claude-sonnet-4-6)

**Workflow:**
1. Planning conversation: Claude explored the homework spec, compared Flask vs FastAPI, recommended FastAPI for its built-in Swagger UI
2. Plan generation: Claude produced `PLAN-AI-DEVELOPER.md` and `PLAN-USER.md` before writing any code
3. Implementation: Claude generated all source files following the approved plan

---

## Challenges

1. At first, the Swagger UI was created without samples for input. This makes quick testing inconvenient. Fixed by asking AI to put pre-filled data.
2. Many actions required manual operations (like taking screenshots, testing, etc). Ideally this would be automated using additional AI tools, but that is out of scope for this task.
3. I was using Claude code CLI for the first time, just to get some fresh experience. Usually I use Coursor application for working tasks. It was pretty difficult to adapt to the CLI UX.
4. Because of low experience with CLI, I lost my first session (the one when plan and implementation were done), and in the 2nd session the meta-reviewer started to imagine requirements that didn't exist (like adding screenshots for all existing API while the tasks don't insist on the full coverage).

