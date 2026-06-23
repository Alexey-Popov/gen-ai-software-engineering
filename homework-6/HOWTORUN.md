# HOWTORUN — Multi-Agent Banking Pipeline (REST)

Step-by-step from setup to demo. All commands run from the `homework-6` directory.

---

## 1. Prerequisites

| Tool | Used by | Check |
|------|---------|-------|
| Python 3.10+ | pipeline, services, tests, MCP server | `python --version` |
| Node.js + `npx` | context7 MCP (via Claude Code) | `npx --version` |
| Claude Code | slash commands, hooks, MCP | — |

## 2. Install dependencies

```bash
cd homework-6
python -m pip install -r requirements.txt
```

`requirements.txt` pins `fastmcp`, `fastapi`, `uvicorn`, `httpx`, `pytest`, `pytest-cov`.

## 3. One-command demo (recommended)

```bash
./demo.sh
```

Starts all seven services (validator, policy, fraud, compliance, settlement, reporting, and the
orchestrator gateway), submits the bundled samples **and** one extra transaction through the REST
API, prints the results, then shuts everything down — zero manual steps. To install deps first in
the same step: `DEMO_INSTALL=1 ./demo.sh`. (Equivalent: `python demo.py`.)

Expected: 8 total, 1 rejected (TXN006), 3 flagged, 2 on hold, 4 settled; the extra `TXN-DEMO`
settles (fee 4.20, net 4195.80).

## 4. Run the services, then call the gateway yourself

Terminal 1 — start the fleet (keeps running until Ctrl+C):

```bash
python run_services.py
```

Terminal 2 — use the API gateway on `http://127.0.0.1:8000`:

```bash
# Submit one transaction (201 Created + Location header)
curl -i -X POST http://127.0.0.1:8000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"TXN-A1","timestamp":"2026-03-16T12:00:00Z",
       "source_account":"ACC-1","destination_account":"ACC-2","amount":"1500.00",
       "currency":"USD","transaction_type":"transfer","metadata":{"country":"US"}}'

# Retrieve that result
curl http://127.0.0.1:8000/api/v1/transactions/TXN-A1

# Run the whole sample batch, then read the summary
curl -X POST http://127.0.0.1:8000/api/v1/pipeline/runs -H "Content-Type: application/json" -d '{}'
curl http://127.0.0.1:8000/api/v1/pipeline/summary
```

Each worker also serves `GET /health/live` and `GET /health/ready`, and its OpenAPI docs at
`/docs` (e.g. the policy agent at `http://127.0.0.1:8002/docs`).

## 5. CLI entry point

With the services running (`python run_services.py`), the CLI drives the batch:

```bash
python integrator.py
```

It loads `sample-transactions.json`, runs every transaction through the master agent over HTTP,
writes one result per transaction to `shared/results/`, and prints a summary.

## 6. The configurable rule engine

All thresholds, limits and block-lists live in `config/rules.json` — edit it to change behaviour
without touching code. For example, to block GBP and lower the fraud "high value" threshold:

```jsonc
"policy":  { "allowed_currencies": ["USD", "EUR"], ... },   // drop GBP
"fraud":   { "high_value": "5000", ... }
```

Restart the services (or re-run `demo.sh`) and the new rules apply. Governing rules:
`rules/policy.md` and `rules/orchestrator.md`.

## 7. Validate only (dry run, no services needed)

```bash
python agents/transaction_validator.py --dry-run
```

Prints total / valid / invalid counts and a table with the rejection reason for TXN006.

## 8. Run the tests with coverage

```bash
python -m pytest
```

~99% coverage (gate requires ≥ 80%, target ≥ 90%). REST endpoints are tested in-process via
Starlette's `TestClient`, so no sockets are bound. Coverage is written to `coverage.json`.

## 9. Custom MCP server

```bash
python mcp/server.py            # stdio transport
```

Exposes `get_transaction_status(transaction_id)`, `list_pipeline_results()`, and the
`pipeline://summary` resource — all reading from `shared/results/`.

## 10. Connect MCP servers in Claude Code

`.mcp.json` registers `context7` and `pipeline-status`. Run **`/mcp`** to approve them, then try
*"Use get_transaction_status for TXN005."*

## 11. Slash commands (skills)

- **`/run-pipeline`** — runs the pipeline end-to-end and summarizes results.
- **`/validate-transactions`** — dry-run validation with a results table.
- **`/write-spec`** — regenerates `specification.md` from the template.

## 12. Coverage-gate hook

Configured in `.claude/settings.json` as a `PreToolUse` hook on `Bash`. Before any `git push` it
runs the tests and **blocks** the push if coverage < 80%.

## 13. Screenshots

Capture into `docs/screenshots/`: `demo-run.png`, `gateway-curl.png`, `test-coverage.png`,
`skill-run-pipeline.png`, `hook-trigger.png`, `mcp-interaction.png`.
