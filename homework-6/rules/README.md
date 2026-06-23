# Rules

Governance rules for the pipeline's coordinating and configurable parts. These
are written rules (the *why* and *must*); the machine-readable rule **values**
live in [`../config/rules.json`](../config/rules.json).

| File | Covers |
|------|--------|
| [orchestrator.md](./orchestrator.md) | The master agent / API gateway — transport-only orchestration, routing, error shape. |
| [policy.md](./policy.md) | The policy agent and the configurable rule engine — business policy as JSON, not code. |
