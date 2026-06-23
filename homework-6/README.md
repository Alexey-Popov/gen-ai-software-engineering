# 🏦 Homework 6: AI-Powered Multi-Agent Banking Pipeline

> **Created by**: Dmitry Upatov
> **Date Submitted**: 2026-06-21
> **AI Tools Used**: Claude Code (Opus 4.8)

## 📋 Project Overview

This is the final capstone: **four meta-agents** (AI workflows — slash commands plus a
coverage-gate hook) that *create* a working **transaction processing system**, plus the
system itself. The system is a **multi-agent pipeline** that takes raw bank transactions from
`sample-transactions.json` and runs each one through validation, fraud scoring, compliance
review, settlement, and reporting.

Each agent runs as its **own REST service** (FastAPI) on its own port. A **master agent**
(the orchestrator) drives a transaction through the chain — POSTing the message to each agent
and following the `target_agent` field in the reply to the next hop — and exposes an **API
gateway** for submitting transactions and retrieving results. Every operation is recorded in a
PII-safe audit trail, all money math uses `decimal.Decimal` with `ROUND_HALF_UP`, and the final
outcomes — plus a run summary — are persisted to `shared/results/`, queryable through a custom
FastMCP server.

### Homework 7 additions

Three capabilities built on top of the homework-6 pipeline:

1. **A new agent + configurable rule engine** — a new **Policy Agent** plus a rule engine that
   reads all thresholds, limits and block-lists from [`config/rules.json`](./config/rules.json).
   Change the JSON, change the behaviour — no code edits. (Governing rules in [`rules/`](./rules/).)
2. **A REST API gateway** — the whole pipeline behind versioned HTTP endpoints: submit a
   transaction (or a batch) and retrieve results via API calls.
3. **A one-command demo** — [`demo.sh`](./demo.sh) starts every service, submits transactions
   through the API, displays the results, and tears everything down with zero manual steps.

## 🤖 The four meta-agents (deliverables)

- **Agent 1 — Specification**: the `/write-spec` slash command generates
  [`specification.md`](./specification.md) from the standard template.
- **Agent 2 — Code generation**: builds the pipeline; framework lookups via **context7** MCP
  are documented in [`research-notes.md`](./research-notes.md).
- **Agent 3 — Unit tests**: the `/run-pipeline` and `/validate-transactions` skills, plus a
  **coverage-gate hook** that blocks `git push` when coverage < 80%.
- **Agent 4 — Documentation**: this README (with author) and [`HOWTORUN.md`](./HOWTORUN.md).

## 🧩 The pipeline agents (system output)

- **Transaction Validator** — checks required fields, a valid `decimal` amount (refunds may be
  negative), and an ISO 4217 currency; rejects the rest with a reason.
- **Policy Agent** *(new)* — enforces configurable business policy from the rule engine:
  allowed currencies, max amount, blocked countries and transaction types; rejects violations.
- **Fraud Detector** — scores risk (high value, structuring, unusual timing, cross-border,
  suspicious account, wire) and flags high-risk transactions. Thresholds from the rule engine.
- **Compliance Checker** — holds blocked accounts and over-limit wires; marks ≥ $10k as
  reportable (CTR). Limits and block-lists from the rule engine.
- **Settlement Processor** — settles cleared transactions, computing the fee (rate from the rule
  engine) and net amount with `decimal.Decimal` + `ROUND_HALF_UP`.
- **Reporting Agent** — aggregates everything into `shared/results/pipeline-summary.json`.

The **Orchestrator** (master agent) coordinates the above and exposes the API gateway.

## 🗺️ Architecture

```
        client / demo.sh / integrator.py
                    │  submit + retrieve (REST)
                    ▼
        ┌───────────────────────────┐
        │   Orchestrator / Gateway  │  master agent (:8000)
        │   agents/orchestrator.py  │  drives the chain, persists results
        └────────────┬──────────────┘
                     │  POST /api/v1/...  (httpx), follows target_agent
                     ▼
  ┌──────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │Validator │→ │ Policy │→ │ Fraud  │→ │Compliance│→ │Settlement│→ │Reporting │
  │  :8001   │  │ :8002  │  │ :8003  │  │  :8004   │  │  :8005   │  │  :8006   │
  └────┬─────┘  └───┬────┘  └───┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │reject      │reject     │flag        │hold         │settle       │
       └────────────┴───────────┴────────────┴─────────────┴────────────┘
            each agent = a FastAPI service (agents/rest.py)
            rule-driven agents read config/rules.json (rule engine)
                                  │
                                  ▼
                    shared/results/  ── <TXN>.json   (written by the orchestrator)
                                     ── pipeline-summary.json
                                     ── audit-log.jsonl  (ISO 8601, no PII)
                                  │
                                  ▼
                 mcp/server.py (FastMCP "pipeline-status")
        get_transaction_status · list_pipeline_results · pipeline://summary
```

### REST endpoints — worker agents

| Agent | Port | Endpoint |
|-------|-----:|----------|
| Transaction Validator | 8001 | `POST /api/v1/validations` |
| Policy Agent | 8002 | `POST /api/v1/policy-checks` |
| Fraud Detector | 8003 | `POST /api/v1/fraud-assessments` |
| Compliance Checker | 8004 | `POST /api/v1/compliance-checks` |
| Settlement Processor | 8005 | `POST /api/v1/settlements` |
| Reporting Agent | 8006 | `POST /api/v1/reports` · `POST /api/v1/reports/summary` |

### REST endpoints — API gateway (master agent, :8000)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/pipeline/runs` | Submit a batch (or the bundled samples) → run summary |
| `POST` | `/api/v1/transactions` | Submit one transaction → result (`201` + `Location`) |
| `GET` | `/api/v1/transactions/{id}` | Retrieve a stored result (`404` if unknown) |
| `GET` | `/api/v1/pipeline/summary` | Retrieve the latest run summary |

Every service also exposes `GET /health/live` and `GET /health/ready`. Worker request/response
bodies are the standard message envelope; agents return `200` with the business outcome in
`data.status` (`validated` / `rejected` / `flagged` / `compliance_hold` / `settled`).

## 🧪 Results of a run (the 8 samples)

| Outcome | Count | Transactions |
|---------|------:|--------------|
| Rejected | 1 | TXN006 (currency `XYZ` not ISO 4217) |
| Flagged (high risk) | 3 | TXN002, TXN003, TXN005 |
| On compliance hold | 2 | TXN003 (blocked acct), TXN005 (wire > $50k) |
| Settled | 4 | TXN001, TXN004, TXN007, TXN008 |

## 🛠 Tech stack

| Area | Choice |
|------|--------|
| Language | Python 3.10+ |
| Agent transport | REST — FastAPI + Uvicorn, `httpx` client |
| Rule engine | JSON config (`config/rules.json`) loaded by `agents/rule_engine.py` |
| Money | `decimal.Decimal`, `ROUND_HALF_UP` |
| Tests | pytest + pytest-cov (~99% coverage; REST tested via Starlette `TestClient`) |
| MCP | context7 (lookup) + custom FastMCP `pipeline-status` |
| Automation | Claude Code slash commands + PreToolUse coverage-gate hook |

## 📁 Structure

```
homework-6/
├── specification.md          # Agent 1 output
├── agents.md                 # project context for AI assistants
├── research-notes.md         # context7 queries (Agent 2)
├── demo.sh / demo.py         # one-command end-to-end demo (zero manual steps)
├── run_services.py           # launches the whole agent fleet
├── integrator.py             # CLI entry point (drives the master agent)
├── config/rules.json         # configurable rule engine values
├── agents/                   # common.py + 6 agents + REST/orchestration
│   ├── transaction_validator.py · policy_agent.py (new) · fraud_detector.py
│   ├── compliance_checker.py · settlement_processor.py · reporting_agent.py
│   ├── rule_engine.py        # loads config/rules.json
│   ├── rest.py               # FastAPI app factory + orchestrator/gateway app
│   ├── client.py             # httpx / in-process pipeline clients
│   └── orchestrator.py       # master agent (drives the chain over HTTP)
├── rules/                    # governance rules (orchestrator.md, policy.md)
├── mcp/server.py             # custom FastMCP server
├── tests/                    # unit + integration + REST tests (~99% cov)
├── mcp.json / .mcp.json      # context7 + pipeline-status
├── pytest.ini                # coverage config
├── .claude/
│   ├── settings.json         # coverage-gate hook
│   ├── settings.local.json   # permissions + enabled MCP servers
│   ├── hooks/coverage_gate.py
│   └── commands/             # write-spec, run-pipeline, validate-transactions
└── docs/screenshots/         # evidence
```

## 📸 Screenshots

See [`docs/screenshots/`](./docs/screenshots/):

| File | Demonstrates |
|------|--------------|
| `pipeline-run-py.png` | `python integrator.py` full output |
| `test-coverage.png` | pytest coverage ≥ 90% |
| `skill-run-pipeline.png` | `/run-pipeline` executing |
| `hook-trigger.png` | coverage-gate hook firing on push |
| `mcp-interaction.png` | context7 query + custom MCP tool call |

## ▶️ How to run

Fastest path — the whole thing, end to end:

```bash
cd homework-6
python -m pip install -r requirements.txt
./demo.sh            # starts all services, submits via API, shows results, tears down
```

See [`HOWTORUN.md`](./HOWTORUN.md) for the full launch plan: the demo, running services
manually, calling the gateway with `curl`, editing the rule engine, the tests, the MCP server,
and the skills/hook.
