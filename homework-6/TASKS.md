# 🏦 Homework 6: Final Capstone — AI-Powered Multi-Agent Banking Pipeline

## Overview

This is your final capstone. You will build **four meta-agents** (AI/automation workflows) that **create** a **transaction processing system** from scratch. Each agent has a distinct role: one produces the specification, one the code, one the tests, and one the documentation. The **output** of these agents is a working transaction processing pipeline (e.g. validator, fraud detection, settlement); the **deliverable** is both the four meta-agents and the resulting system. No starter code is provided.

**This assignment is language-agnostic.** Implement the pipeline in the language and framework of your choice (e.g. Python, Node.js, Java, Go). Examples in this document may use one stack; equivalent commands and patterns in your chosen stack are acceptable.

---

## Four agents (your deliverables)

| Agent | Role | Plus (skill / MCP / hook / requirement) |
|-------|------|----------------------------------------|
| **Agent 1 — Specification** | Creates detailed technical specification for the transaction processing system | **Skill**: A slash command that produces a specification following the given template (e.g. `.../commands/write-spec.md`). |
| **Agent 2 — Code generation** | Generates the transaction processing pipeline code (validator, fraud detector, etc.) | **MCP context7**: Used during code generation to look up a **specific framework**; document 2+ context7 queries in `research-notes.md`. |
| **Agent 3 — Unit tests** | Creates unit tests with the required coverage | **Hook**: Verifies unit test coverage and **blocks push** if coverage is **below 80%**. |
| **Agent 4 — Documentation** | Generates README and project documentation | **Requirement**: README (and/or docs) must **include the student's name** (e.g. author or "Created by"). |

---

## Tasks

---

### Task 1 ⭐⭐ — Agent 1: Write the Specification (Required)

**Agent 1** produces the detailed technical specification. Before writing any code, write a complete project specification. Use the template in `specification-TEMPLATE-hint.md` (this folder) and the full template from Homework 3 as reference.

#### Required files
- `specification.md` — Full project spec (see structure below)
- `agents.md` — Extend the provided starter `agents.md` with your project-specific context
- **Skill**: A slash command (e.g. `.../commands/write-spec.md`) that generates a specification following the template when invoked.

#### `specification.md` must include

**1. High-Level Objective**
One sentence describing what your pipeline does.

**2. Mid-Level Objectives** (4–5 items)
Concrete, testable requirements. Example:
- Transactions above $10,000 are flagged for fraud review with a risk score
- Rejected transactions are written to `shared/results/` with a reason field
- All agent operations are logged with ISO 8601 timestamps

**3. Implementation Notes**
- Monetary values: use precise decimal/numeric types for amounts (e.g. `decimal.Decimal` in Python — never `float`)
- Currency codes: ISO 4217 (USD, EUR, GBP, JPY…)
- Logging: audit trail with timestamp, agent name, transaction ID, and outcome
- PII: treat account numbers and names as sensitive — no plaintext logging

**4. Context**
- Beginning state: a `sample-transactions.json` file with raw transaction records
- Ending state: processed results in `shared/results/`, a pipeline summary report, test coverage ≥ 90%

**5. Low-Level Tasks**
One entry per agent. Each entry must follow this format:
```
Task: [Agent Name]
Prompt: "[Exact prompt you will give Claude Code or Copilot]"
File to CREATE: e.g. agents/[agent_name].py (or equivalent in your language)
Function to CREATE: e.g. process_message(message: dict) -> dict
Details: [What the agent checks, transforms, or decides]
```

---

### Task 2 ⭐⭐⭐ — Agent 2: Build the Multi-Agent Pipeline (Required)

**Agent 2** (code-generation agent) implements the pipeline you specified in Task 1. Build **at least 3 cooperating agents**. Use **MCP context7** during code generation to look up your chosen framework (e.g. libraries, APIs); document at least 2 context7 queries in `research-notes.md` (see Task 4).

#### Required agents (minimum)
1. **Transaction Validator** — checks required fields, valid amounts, ISO 4217 currency
2. **Fraud Detector** — scores transactions for risk (high-value, unusual timing, cross-border)
3. **At least one of**: Compliance Checker, Settlement Processor, or Reporting Agent

#### File-based communication protocol
Agents pass messages as JSON files through shared directories:
```
shared/
├── input/       ← integrator drops initial messages here
├── processing/  ← agent moves message here while working
├── output/      ← agent writes result here for next agent
└── results/     ← final outcomes land here
```

Standard message format:
```json
{
  "message_id": "uuid4-string",
  "timestamp": "2026-03-16T10:00:00Z",
  "source_agent": "transaction_validator",
  "target_agent": "fraud_detector",
  "message_type": "transaction",
  "data": {
    "transaction_id": "TXN001",
    "amount": "1500.00",
    "currency": "USD",
    "status": "validated"
  }
}
```

#### Required files
- Integrator/orchestrator (e.g. `integrator.py`, `main.js`) — sets up directories, loads `sample-transactions.json`, starts agents in order, monitors results
- Agent modules (e.g. `agents/transaction_validator.py`, `agents/fraud_detector.py`, `agents/[your_third_agent].py`)
- `research-notes.md` — document at least 2 context7 queries you made while building (see Task 4)

#### Deliverable check
Run the pipeline (e.g. `python integrator.py` or `npm run pipeline`). All transactions from `sample-transactions.json` should appear in `shared/results/`.

---

### Task 3 ⭐⭐ — Agent 3: Skills & Hooks (Required)

**Agent 3** (unit-test agent) is supported by skills and a coverage gate. Turn your workflow into first-class Claude Code commands and add automation hooks.

#### Required: 2 custom skills

Create these files in `.../commands/`:

**`.../commands/run-pipeline.md`**
A slash command that runs the full pipeline:
```markdown
Run the multi-agent banking pipeline end-to-end.

Steps:
1. Check that sample-transactions.json exists
2. Clear shared/ directories
3. Run the pipeline (e.g. python integrator.py or npm run pipeline)
4. Show a summary of results from shared/results/
5. Report any transactions that were rejected and why
```

**`.../commands/validate-transactions.md`**
A slash command that validates transactions without running the full pipeline:
```markdown
Validate all transactions in sample-transactions.json without processing them.

Steps:
1. Run the validator in dry-run mode (e.g. python agents/transaction_validator.py --dry-run)
2. Report: total count, valid count, invalid count, reasons for rejection
3. Show a table of results
```

#### Required: coverage gate hook (mandatory)

Add a hook that **verifies unit test coverage and blocks push** (or fails the action) if coverage is **below 80%**. 

Use the equivalent for your stack. You may also add optional hooks (audit log, pipeline reminder).

#### Deliverables
- `.../commands/run-pipeline.md`
- `.../commands/validate-transactions.md`
- Configuration with **coverage gate hook** (blocks push if coverage < 80%)
- `docs/screenshots/skill-run-pipeline.png` — screenshot of `/run-pipeline` executing
- `docs/screenshots/hook-trigger.png` — screenshot of your hook firing

---

### Task 4 ⭐⭐ — MCP Integration (Required)

Integrate **two** MCP servers into your project. Both are required. **Agent 2** (code generation) must use context7 to look up your chosen framework.

---

#### 1. Use context7 during code generation

Configure context7 in your `mcp.json` and **use it while building your pipeline** (e.g., looking up libraries, patterns, or APIs for your chosen language/framework).

**Requirement**: Document at least **2 context7 queries** in `research-notes.md`:
- What you searched for (e.g., "Python decimal module" or "Node.js decimal handling")
- The library ID context7 returned
- A key insight or code pattern you applied from the result

Example entry:
```markdown
## Query 1: decimal/monetary arithmetic for your stack
- Search: e.g. "Python decimal module" or "decimal handling in Node"
- context7 library ID: (e.g. /python/decimal)
- Applied: e.g. Used ROUND_HALF_UP for consistent rounding in settlement calculations
```

---

#### 2. Build a custom FastMCP server

Build a server that makes your pipeline queryable.

`mcp/server.py` must expose:
- **Tool `get_transaction_status`**: accepts `transaction_id: str`, returns current status from `shared/results/`
- **Tool `list_pipeline_results`**: returns a summary of all processed transactions
- **Resource `pipeline://summary`**: returns the latest pipeline run summary as text

---

#### Combined `mcp.json`

Configure **both** servers in a single `mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "pipeline-status": {
      "command": "python",
      "args": ["mcp/server.py"]
    }
  }
}
```

Use your runtime if not Python (e.g. `node mcp/server.js` for Node).

#### Deliverables (Task 4)
- `mcp.json` — both context7 and pipeline-status configured
- `mcp/server.py` — custom FastMCP server with the required tools and resource
- `research-notes.md` — at least 2 context7 queries documented (see Task 2)
- Screenshot in `docs/screenshots/`: context7 query result **and** a custom MCP tool call (e.g. `get_transaction_status` or `list_pipeline_results`)

---

### Task 5 ⭐⭐ — Agent 4: Testing & Documentation (Required)

**Agent 4** produces tests and documentation. Write a test suite and generate README/docs (see below).

#### Tests
Write a test suite in `tests/` (or your stack's test directory) covering each agent and the integration path.

Requirements:
- Coverage **gate**: hook blocks push if below 80% (see Task 3). Aim for ≥ 90% where possible.
- At minimum: unit tests for each agent + 1 integration test for the full pipeline
- Isolate tests from real `shared/` (e.g. use `tmp_path` or equivalent)

#### Documentation (Agent 4)
- `README.md` — must include:
  - **Your name** (e.g. in author line or "Created by [Your Name]")
  - What the system does (1–2 paragraphs)
  - Agent responsibilities (one bullet per agent)
  - ASCII architecture diagram showing the pipeline flow
  - Tech stack table
- `HOWTORUN.md` — step-by-step


#### Screenshots (save in `docs/screenshots/`)
| Screenshot | What to capture |
|---|---|
| `pipeline-run.png` | Full terminal output of running the pipeline (e.g. `python integrator.py`) |
| `test-coverage.png` | Coverage report showing ≥ 80% (gate) and ideally ≥ 90% |
| `skill-run-pipeline.png` | `/run-pipeline` skill executing |
| `hook-trigger.png` | Your coverage gate hook firing (or blocking push) |
| `mcp-interaction.png` | context7 query result **and** custom MCP tool call (e.g. get_transaction_status) |

---

## Submission: screenshots and PR description

**Screenshot every major step** and include them in your pull request:

- Save all screenshots in `docs/screenshots/` (see table above).
- **Include the same screenshots in your PR description** (embedded or linked) so reviewers can see each step without opening the repo.

PR description should include screenshots for: spec produced, pipeline run, tests/coverage, skill/hook in action, MCP usage, and README (with your name).

---

## Deliverables Checklist

### You create
**Specification (Task 1 / Agent 1)**
- [ ] `specification.md`
- [ ] `agents.md` (updated with your project context)
- [ ] Skill that generates specification from the template (e.g. `.../commands/write-spec.md`)

**Pipeline (Task 2 / Agent 2)**
- [ ] Integrator/orchestrator and agent modules (e.g. `integrator.py`, `agents/transaction_validator.py`, etc.)
- [ ] `research-notes.md` (2+ context7 queries documented)

**Skills & Hooks (Task 3 / Agent 3)**
- [ ] `.../commands/run-pipeline.md`
- [ ] `.../commands/validate-transactions.md`
- [ ] `.../settings.json` with **coverage gate hook** (blocks push if coverage < 80%)

**MCP (Task 4)**
- [ ] `mcp.json` (context7 + pipeline-status)
- [ ] `mcp/server.py`

**Tests & Docs (Task 5 / Agent 4)**
- [ ] `tests/` directory with test files
- [ ] `README.md` (must include **your name**)
- [ ] `HOWTORUN.md`
- [ ] `docs/screenshots/` (5 screenshots)
- [ ] **PR description** includes screenshots for every step

---

## Success Criteria

Use this to self-check before submitting:

| Criterion | Check |
|---|---|
| `specification.md` has all 5 sections and Low-Level Tasks per agent | ✅ / ❌ |
| Skill that generates spec from template is present | ✅ / ❌ |
| Pipeline runs to completion (e.g. `python integrator.py`) with no errors | ✅ / ❌ |
| All agents write valid JSON messages to `shared/` directories | ✅ / ❌ |
| `/run-pipeline` skill executes the pipeline via AI | ✅ / ❌ |
| Coverage gate hook is configured and blocks push if coverage < 80% | ✅ / ❌ |
| `mcp.json` has context7 and custom MCP; both respond | ✅ / ❌ |
| Test coverage meets gate (≥ 80%); aim for ≥ 90% | ✅ / ❌ |
| `README.md` includes **your name** and ASCII pipeline diagram | ✅ / ❌ |
| `HOWTORUN.md` has numbered steps from setup to demo | ✅ / ❌ |
| 5 screenshots in `docs/screenshots/` and **in PR description** | ✅ / ❌ |

---

## Tips for Success

- **Spec first, code second.** Students who skip Task 1 spend twice as long debugging in Task 2.
- **One agent at a time.** Finish and test one agent before starting the next.
- **Use context7** to look up library docs for your chosen framework.
- **Your skills save time.** Once `/run-pipeline` is set up, you can trigger the whole demo in one command.
- **Screenshot every step and add them to your PR description.** Capture screenshots during development and include them in the PR so reviewers can see each step.
- **Read the sample transactions.** Understanding the input data shapes every agent decision.
