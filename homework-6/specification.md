# Multi-Agent Banking Transaction Pipeline — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the
> code that will satisfy the High and Mid-Level Objectives.
>
> **Author:** Dmitry Upatov · **Produced by:** Agent 1 (Specification) via `/write-spec`.

---

## High-Level Objective

- Build a multi-agent pipeline that takes raw bank transactions and runs each one through
  validation, policy, fraud scoring, compliance review, settlement, and reporting — with each
  agent exposed as a REST service, a master agent (orchestrator) driving the chain over HTTP and
  exposing an API gateway, all rules read from a configurable JSON engine, and every step
  recorded in an audit trail.

## Mid-Level Objectives

- **Validation gate:** every transaction is checked for required fields, a well-formed
  `decimal` amount, and a valid ISO 4217 currency; invalid ones are **rejected** and written
  to `shared/results/` with a `reason` field, never reaching downstream agents.
- **Fraud scoring:** transactions are scored for risk; any at or above **$10,000** are
  **flagged** for review with a numeric `risk_score` and a `risk_level` of low/medium/high.
- **Compliance:** transactions touching a blocked account or exceeding the wire auto-clear
  limit are placed on `compliance_hold`; amounts ≥ $10,000 are marked as requiring reporting.
- **Settlement:** only fully-cleared transactions are settled, using `decimal.Decimal` with
  `ROUND_HALF_UP` so fees and settled amounts are exact to the cent.
- **Auditability:** every agent operation is logged with an ISO 8601 timestamp, the agent
  name, the transaction id, and the outcome — with **no** account numbers or names (PII) in
  the log; a final summary report aggregates all outcomes and test coverage is ≥ 90%.

## Implementation Notes

- **Monetary values:** parse and compute with `decimal.Decimal` built from strings — never
  `float`. Round with `quantize(Decimal("0.01"), ROUND_HALF_UP)`.
- **Currency codes:** validate against an ISO 4217 set (USD, EUR, GBP, JPY, …).
- **Logging / audit:** append-only `shared/results/audit-log.jsonl`; each record is
  `{timestamp, agent, transaction_id, outcome}`.
- **PII:** account numbers and names are sensitive — keep them inside the transaction message
  flowing between agents, but never write them to the audit log or other logs in plaintext
  (a `mask_account` helper exists for the rare diagnostic that needs a reference).
- **Communication protocol:** agents pass standard messages
  (`message_id`, `timestamp`, `source_agent`, `target_agent`, `message_type`, `data`) as HTTP
  JSON bodies between REST services; the orchestrator persists the final message to
  `shared/results/<id>.json`.
- **Rule engine:** thresholds, limits and block-lists live in `config/rules.json` (sections:
  `policy`, `fraud`, `compliance`, `settlement`) and are read via `agents/rule_engine.py`. No
  business values are hard-coded in agents.
- **Coding standards:** Python 3.10+, type hints, pure `process_message(message) -> message`
  functions for unit-testability; pytest + pytest-cov; coverage gate at 80% (target ≥ 90%).

## Context

### Beginning context
- `sample-transactions.json` — eight raw transaction records.
- An empty project (no pipeline code yet).
- Claude Code with the `context7` and custom `pipeline-status` MCP servers configured.

### Ending context
- `agents/` — six agent modules (incl. the new `policy_agent.py`) plus `common.py`,
  `rule_engine.py`, `rest.py`, `client.py`, `orchestrator.py`.
- `config/rules.json` — the configurable rule engine values.
- `run_services.py` — launches the agent fleet; `integrator.py` — thin CLI.
- `demo.sh` / `demo.py` — one-command end-to-end demo.
- `shared/results/` — one JSON result per transaction, `pipeline-summary.json`, and
  `audit-log.jsonl`.
- `mcp/server.py` — custom FastMCP server exposing pipeline status.
- `rules/` — governance rules (`orchestrator.md`, `policy.md`).
- `tests/` — unit + integration + REST tests with coverage ≥ 90%.
- Documentation (`README.md`, `HOWTORUN.md`, `agents.md`) and screenshots.

## Low-Level Tasks

### 1. Transaction Validator
```
Task: Transaction Validator
Prompt: "Create a validator agent that checks required fields, a valid decimal amount
         (refunds may be negative, others must be > 0), and an ISO 4217 currency.
         Mark valid transactions 'validated' and route them to the fraud detector;
         mark invalid ones 'rejected' with a reason and route them to reporting.
         Add a --dry-run CLI that validates sample-transactions.json without writing files."
File to CREATE: agents/transaction_validator.py
Function to CREATE: process_message(message: dict) -> dict
Details: Required fields, decimal parsing, ISO 4217 check; TXN006 (XYZ) is rejected.
```

### 2. Fraud Detector
```
Task: Fraud Detector
Prompt: "Create a fraud detector that scores each validated transaction: high value
         (>= $10k), very high (>= $50k), possible structuring (just under $10k), unusual
         timing (00:00–05:59), cross-border (country != US), suspicious destination
         account, and wire transfers. Assign risk_score, risk_level and flag the high ones."
File to CREATE: agents/fraud_detector.py
Function to CREATE: process_message(message: dict) -> dict
Details: TXN002/003/005 -> high/flagged; TXN004 -> medium; others low.
```

### 3. Compliance Checker
```
Task: Compliance Checker
Prompt: "Create a compliance agent that holds transactions on a blocked account or over the
         wire auto-clear limit, and marks amounts >= $10k as requiring reporting (CTR).
         Set compliance_status to 'compliant' or 'compliance_hold'."
File to CREATE: agents/compliance_checker.py
Function to CREATE: process_message(message: dict) -> dict
Details: ACC-9999 blocked; wire >= $50k held; >= $10k requires_reporting.
```

### 4. Settlement Processor
```
Task: Settlement Processor
Prompt: "Create a settlement agent that settles only validated, non-flagged, compliant
         transactions. Compute a 0.1% fee and the net settled amount with decimal.Decimal
         and ROUND_HALF_UP, preserving the original sign for refunds."
File to CREATE: agents/settlement_processor.py
Function to CREATE: process_message(message: dict) -> dict
Details: Sets status 'settled', settlement_fee and settled_amount.
```

### 5. Reporting Agent
```
Task: Reporting Agent
Prompt: "Create a reporting agent that aggregates all final transaction messages into a
         summary: counts by outcome, list of rejected transactions with reasons, and the
         risk-level distribution. Write shared/results/pipeline-summary.json."
File to CREATE: agents/reporting_agent.py
Function to CREATE: build_summary(results: list[dict]) -> dict
Details: Feeds the custom MCP pipeline://summary resource.
```

### 6. Master Agent (Orchestrator / Gateway)
```
Task: Orchestrator
Prompt: "Create the master agent that drives each transaction through the agent chain over
         HTTP (following the reply's target_agent), writes the final result to
         shared/results/<id>.json, appends the audit trail, and asks the reporting service for
         the summary. Expose it as a REST API gateway: POST /api/v1/pipeline/runs (batch),
         POST /api/v1/transactions (one, 201 + Location), GET /api/v1/transactions/{id} and
         GET /api/v1/pipeline/summary (retrieve). Contain no banking logic."
Files to CREATE: agents/orchestrator.py, agents/rest.py, agents/client.py, run_services.py
Function to CREATE: orchestrator.run_pipeline(client, transactions, shared_root) -> dict
Details: All eight transactions appear in shared/results/; integrator.py is a thin CLI.
```

### 7. Policy Agent + Configurable Rule Engine
```
Task: Policy Agent & Rule Engine
Prompt: "Create a rule engine that loads config/rules.json and a new policy agent that enforces
         the 'policy' section (allowed currencies, max amount, blocked countries/types),
         rejecting violations and routing them to reporting. Refactor fraud, compliance and
         settlement to read their thresholds from the engine. Place the policy agent between
         the validator and the fraud detector."
Files to CREATE: config/rules.json, agents/rule_engine.py, agents/policy_agent.py
Function to CREATE: policy_agent.process_message(message: dict) -> dict
Details: Shipped config reproduces the original outcomes (7 validated, 1 rejected, 3 flagged,
         2 on hold, 4 settled).
```

### 8. One-command Demo
```
Task: Demo
Prompt: "Create demo.sh (+ demo.py) that starts every service, submits transactions through
         the REST gateway, retrieves and displays the results, and tears everything down with
         zero manual steps."
Files to CREATE: demo.sh, demo.py
Details: Single command; no manual steps.
```
