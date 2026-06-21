# agents.md — Project Context for AI Assistants

This file gives Claude Code (and any AI assistant) the project-specific context needed to
work on the **multi-agent banking transaction pipeline** in `homework-6`.

## What this project is

A file-based, multi-agent pipeline that processes raw bank transactions from
`sample-transactions.json` through five cooperating agents and records the outcome of each
one. It is intentionally a **modular set of pure functions** orchestrated by an integrator —
not a network of long-running services — so it stays simple and fully testable.

## The five agents (pipeline output)

| Order | Agent | Module | Responsibility |
|------:|-------|--------|----------------|
| 1 | Transaction Validator | `agents/transaction_validator.py` | Required fields, decimal amount, ISO 4217 currency. Rejects invalid. |
| 2 | Fraud Detector | `agents/fraud_detector.py` | Risk score + level; flags high-value / suspicious. |
| 3 | Compliance Checker | `agents/compliance_checker.py` | Blocked accounts, wire limit, CTR reporting threshold. |
| 4 | Settlement Processor | `agents/settlement_processor.py` | Settles cleared transactions with decimal + ROUND_HALF_UP. |
| 5 | Reporting Agent | `agents/reporting_agent.py` | Aggregates results into `pipeline-summary.json`. |

`integrator.py` orchestrates the chain; `agents/common.py` holds the shared message, IO, and
audit helpers.

## The four meta-agents (deliverables that *create* the system)

| Meta-agent | Realized as |
|-----------|-------------|
| Agent 1 — Specification | `/write-spec` slash command → `specification.md` |
| Agent 2 — Code generation | the pipeline code; context7 lookups in `research-notes.md` |
| Agent 3 — Unit tests | `/run-pipeline` + `/validate-transactions` skills; coverage-gate hook |
| Agent 4 — Documentation | `README.md` (with author) + `HOWTORUN.md` |

## Communication protocol

Agents exchange standard JSON messages through `shared/{input,processing,output,results}`:

```json
{
  "message_id": "uuid4-string",
  "timestamp": "2026-03-16T10:00:00Z",
  "source_agent": "transaction_validator",
  "target_agent": "fraud_detector",
  "message_type": "transaction",
  "data": { "transaction_id": "TXN001", "amount": "1500.00", "currency": "USD", "status": "validated" }
}
```

Each agent implements a pure `process_message(message: dict) -> dict` that returns a new
message re-stamped for the next hop. The integrator performs the file movement and writes the
final message to `shared/results/<transaction_id>.json`.

## Non-negotiable rules

- **Money:** always `decimal.Decimal` built from strings; round with `ROUND_HALF_UP`. Never `float`.
- **Currency:** ISO 4217 codes only.
- **PII:** account numbers and names must never appear in the audit log or other logs in
  plaintext. Use `common.mask_account` if a reference is unavoidable.
- **Audit:** every agent appends `{timestamp, agent, transaction_id, outcome}` to
  `shared/results/audit-log.jsonl` with ISO 8601 timestamps.
- **Tests:** behaviour over implementation; isolate from the real `shared/` via `tmp_path`.
  Keep coverage ≥ 90% (the push hook blocks below 80%).

## Conventions

- Python 3.10+, type hints, `from __future__ import annotations`.
- Agent modules expose an `AGENT_NAME` constant and `process_message`.
- New shared helpers go in `agents/common.py`, not duplicated per agent.
