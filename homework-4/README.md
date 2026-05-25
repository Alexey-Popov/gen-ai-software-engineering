# Homework 4 — 4-Agent Pipeline

> Work in progress. See the **Progress** section below for current status.

## Author
Anastasia Kopiika

## Overview
4-agent pipeline (Research Verifier → Bug Fixer → Security Verifier → Unit Test Generator)
operating on a small sample application with seeded bugs and a security issue.

## Pipeline (6 agents)
```
Bug Researcher → Research Verifier → Bug Planner → Bug Fixer
                                                 ├─→ Security Verifier
                                                 └─→ Unit Test Generator
```

| # | Agent | File | Model | Why this model |
|---|-------|------|-------|----------------|
| 1 | Bug Researcher       | `agents/bug-researcher.agent.md`        | `claude-opus-4-7`   | Root-cause analysis across multiple files; mistakes here cascade. |
| 2 | Research Verifier    | `agents/research-verifier.agent.md`     | `claude-opus-4-7`   | Trust boundary of the pipeline; over-leniency lets bad research through. |
| 3 | Bug Planner          | `agents/bug-planner.agent.md`           | `claude-sonnet-4-6` | Structured transformation from verified research to plan. |
| 4 | Bug Fixer            | `agents/bug-fixer.agent.md`             | `claude-haiku-4-5`  | Mechanical edits per plan; speed and cost matter. |
| 5 | Security Verifier    | `agents/security-verifier.agent.md`     | `claude-opus-4-7`   | Broad knowledge (OWASP/CWE) + reasoning about untrusted input flow. |
| 6 | Unit Test Generator  | `agents/unit-test-generator.agent.md`   | `claude-sonnet-4-6` | Idiomatic vitest tests + edge-case reasoning; Sonnet balances quality and cost. |

## Conventions
- **`{id}`** in agent files is the bug-bundle id under `context/bugs/`. The orchestrator (Stage 5) passes it via the `BUG_ID` env var; for this homework `BUG_ID=001`.
- Each agent file declares `model:` in its frontmatter — this is the explicit model selection required by the assignment.
- All agents are designed as **Claude Code subagents** invoked by the orchestrator via the Agent tool. Verifiers (Research Verifier, Security Verifier) have read-only tools by construction.

## Sample application — `notes-api`
A minimal Express REST API for user notes with in-memory storage.

- Source: `src/index.js`, `src/notes.js`, `src/auth.js`
- Tests: `tests/notes.test.js` (vitest + supertest)
- Endpoints: list with pagination, search by title/tag, delete (admin-only)
- Seeded with **2 intentional bugs** and **1 intentional security issue**

Bugs (input for the Bug Researcher) are documented in
[`context/bugs/001/bug-context.md`](context/bugs/001/bug-context.md).
The security issue is **not** pre-listed there — Security Verifier discovers it independently.

### Baseline (before pipeline)
```
Test Files  1 failed (1)
     Tests  4 failed | 1 passed (5)
```
See `docs/screenshots/01-baseline-failures.png`.

## Sections (TODO)
- Agents and chosen models (with justification)
- Skills (research-quality-measurement, unit-tests-FIRST)
- Pipeline runner (single command)
- How AI was used
- Challenges
- Screenshots #2–#8

See `HOWTORUN.md` for run instructions.

---

## Progress

### Stages
- [x] **Stage 0** — Repo scaffold (branch `homework-4-submission`, folder skeleton, deliverable files)
- [x] **Stage 1** — Sample mini application (`notes-api`, seeded bugs, baseline tests failing)
- [x] **Stage 2** — Skills review & finalize
  - [x] `skills/research-quality-measurement.md` (aggregation rule, action-per-level, verdict examples)
  - [x] `skills/unit-tests-FIRST.md` (vitest/supertest stack, coverage minimum, reference example)
- [x] **Stage 3** — Agents review & finalize
  - [x] `agents/research-verifier.agent.md` (Pipeline action, INSUFFICIENT stop, fail-fast on missing files)
  - [x] `agents/bug-fixer.agent.md` (Edit preference, npm test, stop-on-failure)
  - [x] `agents/security-verifier.agent.md` (broadened scope: changed + imported + endpoint-reachable, output template)
  - [x] `agents/unit-test-generator.agent.md` (vitest discovery, naming convention, 1 retry max)
  - [x] `agents/bug-researcher.agent.md` (new — produces codebase-research.md)
  - [x] `agents/bug-planner.agent.md` (new — produces implementation-plan.md)
  - [x] Model justification per agent (see table above)
- [ ] **Stage 4** — Preparatory artifacts (Researcher + Planner outputs)
  - [ ] `context/bugs/001/research/codebase-research.md`
  - [ ] `context/bugs/001/implementation-plan.md`
- [ ] **Stage 5** — Orchestration (single command runner)
  - [ ] `run-pipeline.sh` or `npm run pipeline`
  - [ ] Wires all agents in order, loads their skills
- [ ] **Stage 6** — Run pipeline on the app, collect agent artifacts
  - [ ] `context/bugs/001/research/verified-research.md`
  - [ ] `context/bugs/001/fix-summary.md`
  - [ ] `context/bugs/001/security-report.md`
  - [ ] `context/bugs/001/test-report.md`
- [ ] **Stage 7** — After-state verification (`npm test` green, app works)
- [ ] **Stage 8** — Documentation pass (README final, HOWTORUN final, models justified)
- [ ] **Stage 9** — Open PR (branch → fork; embed screenshots, `### Status` checkboxes, instructor as reviewer)

### Screenshots
- [x] **#1** Baseline: bugs reproduce — `docs/screenshots/01-baseline-failures.png`
- [ ] **#2** Pipeline run in terminal (agents in order)
- [ ] **#3** `verified-research.md` with Research Quality level
- [ ] **#4** `fix-summary.md` before/after
- [ ] **#5** `security-report.md` with severity + remediation
- [ ] **#6** `test-report.md` + generated test files
- [ ] **#7** `npm test` all green after fix
- [ ] **#8** App works correctly (after-state)
