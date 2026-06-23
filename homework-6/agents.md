# agents.md — Project Context for AI Assistants

This file gives Claude Code (and any AI assistant) the project-specific context needed to
work on the **multi-agent banking transaction pipeline** in `homework-6`.

## What this project is

A **multi-agent pipeline** that processes raw bank transactions from `sample-transactions.json`
through cooperating agents. Each agent runs as its **own REST service** (FastAPI); a **master
agent** (the orchestrator) drives transactions through the chain over HTTP and exposes an **API
gateway** for submitting transactions and retrieving results. Business rules live in a
**configurable rule engine** (`config/rules.json`), not in code.

Each worker agent is still a pure `process_message(message: dict) -> dict` function, so it stays
fully unit-testable; the REST layer is a thin wrapper over it.

## The worker agents (pipeline)

| Order | Agent | Module | Port | Endpoint | Responsibility |
|------:|-------|--------|-----:|----------|----------------|
| 1 | Transaction Validator | `agents/transaction_validator.py` | 8001 | `POST /api/v1/validations` | Required fields, decimal amount, ISO 4217 currency. Rejects invalid. |
| 2 | Policy Agent **(new)** | `agents/policy_agent.py` | 8002 | `POST /api/v1/policy-checks` | Configurable business policy: allowed currencies, amount cap, blocked countries/types. |
| 3 | Fraud Detector | `agents/fraud_detector.py` | 8003 | `POST /api/v1/fraud-assessments` | Risk score + level from rule engine; flags high-risk. |
| 4 | Compliance Checker | `agents/compliance_checker.py` | 8004 | `POST /api/v1/compliance-checks` | Blocked accounts, wire limit, CTR threshold (all from config). |
| 5 | Settlement Processor | `agents/settlement_processor.py` | 8005 | `POST /api/v1/settlements` | Settles cleared transactions; fee rate from config; decimal + ROUND_HALF_UP. |
| 6 | Reporting Agent | `agents/reporting_agent.py` | 8006 | `POST /api/v1/reports` · `/reports/summary` | Aggregates results into the summary. |

Chain: `transaction_validator → policy_agent → fraud_detector → compliance_checker →
settlement_processor → reporting_agent`. A rejection or hold sets `target_agent =
reporting_agent`, short-circuiting the rest.

## The master agent (orchestrator / gateway)

`agents/orchestrator.py` is the master agent — it knows the pipeline shape and drives each
transaction over HTTP, then persists results. It is exposed as a REST service on **:8000** via
`agents/rest.py::create_orchestrator_app`:

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/pipeline/runs` | Submit a batch (or the bundled samples) → run summary |
| POST | `/api/v1/transactions` | Submit one transaction → final result (`201` + `Location`) |
| GET | `/api/v1/transactions/{id}` | Retrieve a stored result (`404` if unknown) |
| GET | `/api/v1/pipeline/summary` | Retrieve the latest run summary |

`integrator.py` is a thin CLI that drives the master agent. `run_services.py` launches the whole
fleet; `demo.py` / `demo.sh` run the full end-to-end demo with zero manual steps.

## Configurable rule engine

`config/rules.json` holds one section per rule-driven agent (`policy`, `fraud`, `compliance`,
`settlement`). `agents/rule_engine.py` loads it (cached) and serves slices via
`rule_engine.section(name)`. Editing the JSON changes behaviour without code changes. The shipped
config reproduces the original hard-coded behaviour. Governing rules: `rules/policy.md` and
`rules/orchestrator.md`.

## Communication protocol

Agents exchange the standard message envelope as HTTP JSON bodies:

```json
{
  "message_id": "uuid4-string",
  "timestamp": "2026-03-16T10:00:00Z",
  "source_agent": "transaction_validator",
  "target_agent": "policy_agent",
  "message_type": "transaction",
  "data": { "transaction_id": "TXN001", "amount": "1500.00", "currency": "USD", "status": "validated" }
}
```

Each worker implements `process_message(message: dict) -> dict`, returning a new message
re-stamped (`common.relabel`) for the next hop. The orchestrator POSTs along the chain and writes
the final message to `shared/results/<transaction_id>.json`.

## Non-negotiable rules

- **Money:** always `decimal.Decimal` built from strings; round with `ROUND_HALF_UP`. Never `float`.
- **Currency:** ISO 4217 codes only (validator); allow-list is policy-configurable.
- **Rules as data:** thresholds/limits/block-lists live in `config/rules.json`, not in code.
- **PII:** account numbers and names must never appear in the audit log or other logs in
  plaintext. Use `common.mask_account` if a reference is unavoidable.
- **Audit:** every agent hop appends `{timestamp, agent, transaction_id, outcome}` to
  `shared/results/audit-log.jsonl` with ISO 8601 timestamps.
- **Orchestrator:** transport-only — no banking logic (see `rules/orchestrator.md`).
- **Tests:** behaviour over implementation; isolate from the real `shared/` via `tmp_path`; REST
  is tested in-process via Starlette `TestClient`. Keep coverage ≥ 90% (push hook blocks < 80%).

## Conventions

- Python 3.10+, type hints, `from __future__ import annotations`.
- Agent modules expose an `AGENT_NAME` constant and `process_message`.
- New shared helpers go in `agents/common.py`; new rule values go in `config/rules.json`.
