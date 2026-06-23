# Policy Agent & Rule Engine Rule

## Context

Governs the new `agents/policy_agent.py` and the configurable rule engine
(`agents/rule_engine.py` + `config/rules.json`). The goal: business policy is
**data, not code** — a bank tunes thresholds and block-lists by editing JSON,
never by changing Python.

---

## Core Principles

1. **Rules live in `config/rules.json`** — one section per rule-driven agent
   (`policy`, `fraud`, `compliance`, `settlement`). No thresholds, limits or
   block-lists are hard-coded in agent modules.
2. **The engine is the single source** — agents read their slice via
   `rule_engine.section(name)`. They accept an optional override argument so
   tests can supply rules without touching the file.
3. **Policy is a gate, not a scorer** — the policy agent makes a binary
   allow/reject decision; risk *scoring* stays in the fraud detector.
4. **Money stays `Decimal`** — amounts and limits are parsed with
   `common.parse_amount` (string → `Decimal`), never `float`.

---

## Rules

### RULE-POL01 — No hard-coded rule values

Any number or list that a business owner might want to change (currencies,
amount caps, sanctioned countries, blocked types, fraud thresholds, fee rate)
must come from `config/rules.json` through the engine.

### RULE-POL02 — Policy checks

The policy agent enforces, from the `policy` section:
`allowed_currencies` (empty = allow any), `max_transaction_amount`,
`blocked_countries`, `blocked_transaction_types`. Any breach → `status:
rejected` with a human-readable `reason`, routed to `reporting_agent`.

### RULE-POL03 — Pipeline position

The policy agent runs **after** the validator and **before** the fraud
detector: `transaction_validator → policy_agent → fraud_detector → …`. It only
sees structurally valid transactions.

### RULE-POL04 — Backward-compatible defaults

The shipped `config/rules.json` reproduces the original hard-coded behaviour, so
the eight sample transactions yield the same outcomes (7 validated, 1 rejected,
3 flagged, 2 on hold, 4 settled). Changing the file is the supported way to
change behaviour.

---

## Enforcement Checklist

| Check | |
|-------|---|
| No business thresholds/lists hard-coded in agents | ☐ |
| Agents read rules via `rule_engine.section(...)` | ☐ |
| Policy agent rejects with a reason and routes to reporting | ☐ |
| Policy runs between validator and fraud detector | ☐ |
| Amounts/limits use `Decimal`, never `float` | ☐ |

---

## Summary

Business policy is configuration. The policy agent applies the `policy` section
as an allow/reject gate; fraud, compliance and settlement read their own
sections. Edit `config/rules.json` to change the bank's behaviour — no code
change required.
