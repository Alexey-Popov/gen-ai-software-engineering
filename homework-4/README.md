# Homework 4 — 4-Agent Pipeline

> Work in progress. See the **Progress** section below for current status.

## Author
Anastasia Kopiika

## Overview
4-agent pipeline (Research Verifier → Bug Fixer → Security Verifier → Unit Test Generator)
operating on a small sample application with seeded bugs and a security issue.

## Pipeline
```
Bug Researcher → Research Verifier → Bug Planner → Bug Fixer
                                                 ├─→ Security Verifier
                                                 └─→ Unit Test Generator
```

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
- [ ] **Stage 3** — Agents review & finalize
  - [x] `agents/research-verifier.agent.md` (draft)
  - [x] `agents/bug-fixer.agent.md` (draft)
  - [x] `agents/security-verifier.agent.md` (draft)
  - [x] `agents/unit-test-generator.agent.md` (draft)
  - [ ] Add Bug Researcher + Bug Planner agents (pipeline prerequisites)
  - [ ] Justify model choice per agent in this README
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
