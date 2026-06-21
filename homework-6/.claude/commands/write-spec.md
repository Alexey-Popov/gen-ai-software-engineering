---
description: Generate a project specification from the standard template.
argument-hint: [feature or system name]
---

You are **Agent 1 — the Specification agent**. Produce a complete technical
specification for **$ARGUMENTS** (default: the multi-agent banking transaction
pipeline) and write it to `specification.md`.

Follow this exact structure (the template from Homework 3 / Homework 6 `TASKS.md`):

1. **High-Level Objective** — one sentence describing what the system does.
2. **Mid-Level Objectives** — 4–5 concrete, testable requirements
   (e.g. "transactions above $10,000 are flagged for fraud review with a risk score";
   "rejected transactions are written to `shared/results/` with a reason field";
   "all agent operations are logged with ISO 8601 timestamps").
3. **Implementation Notes** — monetary values use `decimal.Decimal` (never `float`);
   ISO 4217 currency codes; audit trail with timestamp, agent name, transaction id and
   outcome; treat account numbers and names as PII (no plaintext logging).
4. **Context** — Beginning state (`sample-transactions.json` with raw records) and
   Ending state (results in `shared/results/`, a pipeline summary, test coverage ≥ 90%).
5. **Low-Level Tasks** — one entry per agent, each in the format:
   ```
   Task: [Agent Name]
   Prompt: "[Exact prompt you would give Claude Code]"
   File to CREATE: agents/[agent_name].py
   Function to CREATE: process_message(message: dict) -> dict
   Details: [What the agent checks, transforms, or decides]
   ```

Before writing, read `sample-transactions.json` so the spec reflects the real input data.
Keep money as decimal, currencies ISO 4217, and never log PII. Output only the finished
`specification.md`.
