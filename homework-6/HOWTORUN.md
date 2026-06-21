# HOWTORUN — Homework 6: Multi-Agent Banking Pipeline

Step-by-step from setup to demo. All commands are run from the `homework-6` directory.

---

## 1. Prerequisites

| Tool | Used by | Check |
|------|---------|-------|
| Python 3.10+ | pipeline, tests, MCP server | `python --version` |
| Node.js + `npx` | context7 MCP (via Claude Code) | `npx --version` |
| Claude Code | slash commands, hooks, MCP | — |

## 2. Install dependencies

```bash
cd homework-6
python -m pip install -r requirements.txt
```

`requirements.txt` pins `fastmcp>=2.0`, `pytest>=8.0`, `pytest-cov>=5.0`
(verified on `fastmcp 3.4.2`, `pytest 9.x`).

## 3. Run the pipeline

```bash
python integrator.py
```

This clears `shared/`, loads `sample-transactions.json`, runs all five agents, writes one
result per transaction to `shared/results/`, and prints a summary. Expected: 8 total,
1 rejected (TXN006), 3 flagged, 2 on hold, 4 settled.

## 4. Validate only (dry run)

```bash
python agents/transaction_validator.py --dry-run
```

Prints total / valid / invalid counts and a table with the rejection reason for TXN006.
No files are written.

## 5. Run the tests with coverage

```bash
python -m pytest
```

63 tests, ~99% coverage (gate requires ≥ 80%, target ≥ 90%). Coverage is written to
`coverage.json` and printed with missing lines.

## 6. Custom MCP server

```bash
# direct run (stdio transport)
python mcp/server.py
```

Or quick self-test without an MCP client:

```bash
python -c "import sys; sys.path.insert(0,'mcp'); import server; print(server.get_transaction_status('TXN005')); print(server.list_pipeline_results()); print(server.pipeline_summary())"
```

The server exposes:
- Tool `get_transaction_status(transaction_id)` — status of one transaction.
- Tool `list_pipeline_results()` — one line per processed transaction.
- Resource `pipeline://summary` — the latest run summary.

## 7. Connect MCP servers in Claude Code

`mcp.json` (and `.mcp.json`, which Claude Code auto-loads from the project root) register both
servers:

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"] },
    "pipeline-status": { "command": "python", "args": ["mcp/server.py"] }
  }
}
```

Run **`/mcp`** in Claude Code to approve them, then try:
- *"Use context7 to look up the Python decimal module."* (context7)
- *"Use get_transaction_status for TXN005."* (custom server)

## 8. Slash commands (skills)

In Claude Code, from this folder:
- **`/run-pipeline`** — runs the pipeline end-to-end and summarizes results.
- **`/validate-transactions`** — dry-run validation with a results table.
- **`/write-spec`** — regenerates `specification.md` from the template.

## 9. Coverage-gate hook

Configured in `.claude/settings.json` as a `PreToolUse` hook on `Bash`. Before any
`git push`, it runs the tests and **blocks the push** if coverage < 80%.

- Manual check (allowed, push proceeds):
  ```bash
  echo '{"tool_name":"Bash","tool_input":{"command":"git push"}}' | python .claude/hooks/coverage_gate.py
  ```
- To **demo a block** for the screenshot, temporarily raise the threshold in
  `.claude/hooks/coverage_gate.py` (e.g. `THRESHOLD = 100.0`) and run the command above — it
  exits with code 2 and a "BLOCKED push" message. Revert the threshold afterwards.

## 10. Screenshots

Capture these into `docs/screenshots/`: `pipeline-run-py.png`, `test-coverage.png`,
`skill-run-pipeline.png`, `hook-trigger.png`, `mcp-interaction.png`.
