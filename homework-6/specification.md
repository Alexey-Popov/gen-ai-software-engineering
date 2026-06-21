# Multi-Agent Banking Transaction Pipeline — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the
> code that will satisfy the High and Mid-Level Objectives.
>
> **Author:** Dmitry Upatov · **Produced by:** Agent 1 (Specification) via `/write-spec`.

---

## High-Level Objective

- Build a multi-agent pipeline that takes raw bank transactions and runs each one through
  validation, fraud scoring, compliance review, settlement, and reporting — with every step
  communicating through JSON files in shared directories and recorded in an audit trail.

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
  (`message_id`, `timestamp`, `source_agent`, `target_agent`, `message_type`, `data`) as JSON
  files through `shared/{input,processing,output,results}`.
- **Coding standards:** Python 3.10+, type hints, pure `process_message(message) -> message`
  functions for unit-testability; pytest + pytest-cov; coverage gate at 80% (target ≥ 90%).

## Context

### Beginning context
- `sample-transactions.json` — eight raw transaction records.
- An empty project (no pipeline code yet).
- Claude Code with the `context7` and custom `pipeline-status` MCP servers configured.

### Ending context
- `agents/` — five agent modules plus a shared `common.py`.
- `integrator.py` — orchestrator that drives the chain and writes results.
- `shared/results/` — one JSON result per transaction, `pipeline-summary.json`, and
  `audit-log.jsonl`.
- `mcp/server.py` — custom FastMCP server exposing pipeline status.
- `tests/` — unit + integration tests with coverage ≥ 90%.
- Documentation (`README.md`, `HOWTORUN.md`) and screenshots.

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

### 6. Integrator / Orchestrator
```
Task: Integrator
Prompt: "Create the orchestrator that sets up shared/ directories, loads
         sample-transactions.json, wraps each record in a message, drives it through the
         agent chain (moving the JSON file input -> processing -> output), writes the final
         result to shared/results/<id>.json, and runs the reporting agent."
File to CREATE: integrator.py
Function to CREATE: run_pipeline(shared_root, transactions_path) -> dict
Details: All eight transactions must appear in shared/results/.
```
