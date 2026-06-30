# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`homework-1` is one assignment in a university course ("GenAI and Agentic AI for Software Engineering"). The parent repo (`../`) is a homework template with one directory per assignment (`homework-1` … `homework-6`). This directory is currently **unimplemented scaffolding** — `src/` holds only a `.gitkeep`, and there is no package manifest yet. The work is to build the application described in `TASKS.md` from scratch.

## The assignment (see `TASKS.md` for the full spec)

Build a minimal in-memory REST API for banking transactions. No database — store transactions in an in-memory array/object. Tech stack is the implementer's choice (Node.js or Python suggested); the sample requests in `TASKS.md` assume the server listens on **port 3000**.

Required endpoints:
- `POST /transactions`, `GET /transactions`, `GET /transactions/:id`
- `GET /accounts/:accountId/balance`
- `GET /transactions` must support filters: `?accountId=`, `?type=`, `?from=&to=` (date range), combinable

Domain rules that are easy to get wrong (enforce these in validation):
- Amount: positive, **max 2 decimal places**
- Account number format: **`ACC-XXXXX`** (alphanumeric)
- Currency: valid ISO 4217 code (USD, EUR, GBP, JPY, …)
- Validation errors return `400` with `{ "error": "Validation failed", "details": [{ "field", "message" }] }`
- Transaction `type` is one of `deposit | withdrawal | transfer`; `status` is `pending | completed | failed`

## Resolved domain contract (decisions that close gaps in `TASKS.md`)

`TASKS.md` leaves several rules underspecified/contradictory. These decisions are **binding** for the implementation — keep code consistent with them:

1. **Accounts per type.** `deposit` → only `toAccount` (no `fromAccount`); `withdrawal` → only `fromAccount` (no `toAccount`); `transfer` → both, and they must differ. Validation enforces presence/absence per type.
2. **Status lifecycle.** New transactions default to `status: "completed"` (synchronous in-memory settlement). `status` may be supplied in the POST body; only `completed` transactions affect balances/summaries. `pending`/`failed` are stored but excluded from money math.
3. **Balance.** `balance(account) = Σ amount credited (toAccount == account) − Σ amount debited (fromAccount == account)`, over `completed` transactions only.
4. **`?accountId=` filter.** Matches a transaction if the account equals **either** `fromAccount` or `toAccount`.
5. **Summary = credits/debits, not type names.** `totalDeposits` = Σ credits to the account, `totalWithdrawals` = Σ debits — regardless of transaction `type`. This keeps `balance == totalDeposits − totalWithdrawals` (resolves the summary-vs-balance contradiction).
6. **Account regex.** `^ACC-[A-Za-z0-9]{5}$` (exactly 5 alphanumerics, per the `ACC-XXXXX` literal). Single source of truth in a validator constant — easy to widen later.
7. **Date filter.** `from`/`to` accept `YYYY-MM-DD` or full ISO 8601; both bounds **inclusive**; a date-only `to` covers through end-of-day (`23:59:59.999`). Compared against `timestamp`.
8. **Currency.** Validated against a curated ISO 4217 allowlist in `src/config/currencies.js` (documented as a subset, easy to extend).
9. **Interest (Task 4-B).** Simple interest = `balance × rate × (days / 365)`; `rate` is an annual decimal; `rate > 0`, integer `days > 0`.
10. **Port.** `PORT` env var, default **3000**.
11. **Single currency.** `TASKS.md` never defines multi-currency balances, so money math (balance/summary/interest) assumes one currency context and does **no** FX conversion — amounts are summed as plain numbers. Mixing currencies on one account is out of scope.

Task 4: implementing **all four** optional features (A summary, B interest, C CSV export, D rate limiting).

## Required deliverables (grading depends on these)

Per the parent `../README.md`, a submission is incomplete without all of:
- `README.md` — fill in the student/author, overview, and AI-tools-used sections (currently placeholder template)
- `HOWTORUN.md` — step-by-step run instructions (currently a stub)
- `docs/screenshots/` — screenshots of AI interactions, the API running, and sample requests/responses
- `demo/` — `run.sh`/`run.bat` launcher, `sample-requests.http` (or `.sh`), and `sample-data.json`

## Submission workflow

Work happens on a fork. Each assignment is submitted as its own branch + **detailed** pull request:
- Branch name: `homework-1-submission`
- The PR body is the primary submission narrative — must include a thorough summary, how AI was used, how to verify, and embedded screenshots. Bare/one-line PRs are rejected.
- PRs target the **student's own fork** (`main`), never the upstream course repo. Reviewer: `Alexey-Popov`.

When scaffolding the project, keep the structure self-contained inside `homework-1/` and add a `.gitignore` for the chosen stack (e.g. `node_modules/`, `.env`).
