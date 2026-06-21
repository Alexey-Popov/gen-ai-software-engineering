# 🏦 Homework 6: AI-Powered Multi-Agent Banking Pipeline

> **Created by**: Dmitry Upatov
> **Date Submitted**: 2026-06-21
> **AI Tools Used**: Claude Code (Opus 4.8)

## 📋 Project Overview

This is the final capstone: **four meta-agents** (AI workflows — slash commands plus a
coverage-gate hook) that *create* a working **transaction processing system**, plus the
system itself. The system is a file-based **multi-agent pipeline** that takes raw bank
transactions from `sample-transactions.json` and runs each one through validation, fraud
scoring, compliance review, settlement, and reporting.

Agents communicate by passing standard JSON messages through shared directories
(`shared/{input,processing,output,results}`). Every operation is recorded in a PII-safe audit
trail, all money math uses `decimal.Decimal` with `ROUND_HALF_UP`, and the final outcomes —
plus a run summary — land in `shared/results/`, queryable through a custom FastMCP server.

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
- **Fraud Detector** — scores risk (high value, structuring, unusual timing, cross-border,
  suspicious account, wire) and flags high-risk transactions.
- **Compliance Checker** — holds blocked accounts and over-limit wires; marks ≥ $10k as
  reportable (CTR).
- **Settlement Processor** — settles cleared transactions, computing a 0.1% fee and net amount
  with `decimal.Decimal` + `ROUND_HALF_UP`.
- **Reporting Agent** — aggregates everything into `shared/results/pipeline-summary.json`.

## 🗺️ Architecture

```
                         sample-transactions.json
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │     integrator      │  loads txns, drives the chain,
                        │   (orchestrator)    │  moves JSON through shared/ dirs
                        └─────────┬───────────┘
                                  │  shared/input  →  processing  →  output  →  results
                                  ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Transaction│ → │   Fraud    │ → │ Compliance │ → │ Settlement │ → │ Reporting  │
   │  Validator │   │  Detector  │   │  Checker   │   │ Processor  │   │   Agent    │
   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
         │ reject         │ flag           │ hold           │ settle         │
         └────────────────┴────────────────┴────────────────┴───────────────┘
                                  │
                                  ▼
                    shared/results/  ── <TXN>.json
                                     ── pipeline-summary.json
                                     ── audit-log.jsonl  (ISO 8601, no PII)
                                  │
                                  ▼
                 mcp/server.py (FastMCP "pipeline-status")
        get_transaction_status · list_pipeline_results · pipeline://summary
```

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
| Money | `decimal.Decimal`, `ROUND_HALF_UP` |
| Tests | pytest + pytest-cov (~99% coverage) |
| MCP | context7 (lookup) + custom FastMCP `pipeline-status` |
| Automation | Claude Code slash commands + PreToolUse coverage-gate hook |

## 📁 Structure

```
homework-6/
├── specification.md          # Agent 1 output
├── agents.md                 # project context for AI assistants
├── research-notes.md         # context7 queries (Agent 2)
├── integrator.py             # orchestrator
├── agents/                   # common.py + 5 agents
├── mcp/server.py             # custom FastMCP server
├── tests/                    # unit + integration tests
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

See [`HOWTORUN.md`](./HOWTORUN.md) — install dependencies, run the pipeline, validate, run the
tests, start the MCP server, and trigger the skills/hook.
