# Orchestrator (Master Agent) Rule

## Context

Governs `agents/orchestrator.py` and the API gateway it powers
(`agents/rest.py::create_orchestrator_app`). The orchestrator is the only
component that knows the *shape* of the pipeline. This rule keeps it a thin,
transport-only coordinator so all banking logic stays in the worker agents.

---

## Core Principles

1. **Transport only** — the orchestrator routes messages and persists results.
   It contains **no** validation, scoring, compliance, settlement or reporting
   logic of its own.
2. **Message-driven routing** — the next hop is always the reply's
   `target_agent`; the orchestrator never hard-codes "rejected → reporting".
3. **Client-agnostic** — it talks to workers through a pipeline client
   (`process` / `summary` / `close`), so the same code runs over real HTTP or
   in-process for tests.
4. **Own the persistence, not the rules** — the orchestrator writes
   `shared/results/<id>.json`, the audit trail, and `pipeline-summary.json`.
   Workers stay stateless.

---

## Rules

### RULE-ORC01 — No business logic

The orchestrator must not parse amounts, score risk, check currencies, or
decide settlement. If a decision about a transaction is being made, it belongs
in a worker agent, not here.

### RULE-ORC02 — Follow `target_agent`

Routing walks `ENTRY_AGENT` → … → `TERMINAL_AGENT` by reading `target_agent`
from each reply. A worker short-circuits the chain by setting
`target_agent = "reporting_agent"`; the orchestrator just obeys it.

### RULE-ORC03 — Lifecycle ownership

The orchestrator closes only the clients it creates. A client passed in by a
caller (e.g. a test) is the caller's to close.

### RULE-ORC04 — Consistent error envelope

When a downstream agent is unreachable, the gateway returns `502` with
`{ errorCode, message, correlationId }`. Internal details/stack traces never
leak to the API consumer.

### RULE-ORC05 — Versioned, noun-based endpoints

All gateway routes live under `/api/v1`. Submission is a POST to a noun
resource (`/transactions`, `/pipeline/runs`); retrieval is a GET
(`/transactions/{id}`, `/pipeline/summary`). `201 Created` carries a `Location`
header.

---

## Enforcement Checklist

| Check | |
|-------|---|
| No amount/risk/compliance/settlement logic in the orchestrator | ☐ |
| Routing is driven by `target_agent`, not hard-coded branches | ☐ |
| Only self-created clients are closed | ☐ |
| Errors use `{errorCode, message, correlationId}` | ☐ |
| All gateway routes under `/api/v1`, nouns, correct verbs | ☐ |

---

## Summary

The master agent orchestrates and persists — it does not decide. All banking
rules live in the worker agents; the orchestrator only moves messages between
them and records the outcome.
