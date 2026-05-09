# How to Read This Homework

This homework produces a **specification package** — no runnable service is implemented. The graded artifact is the documentation itself.

## Artifacts (open in this order)

| Step | File | What to look for |
|---|---|---|
| 1 | `specification.md` | Full feature spec: HLO, 6 MLOs, NFR table, implementation notes, CDE scope, 29 edge cases, 35 tasks, verification table |
| 2 | `agents.md` | AI-agent invariants: domain rules, stack conventions, security constraints, test categories |
| 3 | `.cursor/rules/security.mdc` | Security workflow triggers: JWT validation, webhook replay, SSRF guard, Redis hardening |
| 4 | `.cursor/rules/fintech.mdc` | FinTech patterns: money types, idempotency, audit-on-mutation, reveal-handle locking |
| 5 | `.cursor/rules/testing.mdc` | Test category requirements and mandatory assertions |
| 6 | `.cursor/rules/general.mdc` | File structure and naming conventions |
| 7 | `.claude/CLAUDE.md` | Claude Code workflow rules |
| 8 | `docs/test-strategy.md` | Test-category matrix, fixture catalogue, security grep harness |
| 9 | `docs/load-test-plan.md` | Workload model, SLO targets, k6 ramp profile |
| 10 | `README.md` | Rationale, best-practice traceability map, AI tools used |

## Verification

No server to start. The following commands verify specification hygiene:

```bash
# 1. Confirm no PAN-length numeric strings leaked into the spec
grep -rE '\b[0-9]{12,19}\b' specification.md && echo "FOUND — investigate" || echo "CLEAN"

# 2. Confirm no CVV-shaped strings in a card-data context
grep -rE 'cvv\s*[:=]\s*[0-9]{3,4}' specification.md agents.md && echo "FOUND" || echo "CLEAN"

# 3. Word / task count spot-check
grep -c "^#### Task" specification.md   # expected: 35
grep -c "^| E[0-9]" specification.md    # expected: 29

# 4. Optional: Markdown lint (requires markdownlint-cli)
# npm install -g markdownlint-cli
markdownlint specification.md agents.md README.md
```

## Key Design Decisions

- **No implementation code** — all tasks in `specification.md §7` describe what to build, not the build itself.
- **Regulatory citations** — every NFR row in `specification.md §3` cites a public standard; numbers marked `[ASSUMED]` include a one-sentence justification.
- **CDE scope** — `specification.md §5.1` classifies each component as IN CDE / connected-to / out of CDE per PCI SSC Scoping Guidance.
- **Edge cases** — `specification.md §6.1` summarises 29 cases by category; `§6.2` gives per-flow detail tables.
