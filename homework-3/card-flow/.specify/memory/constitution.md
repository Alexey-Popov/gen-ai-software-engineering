<!--
SYNC IMPACT REPORT
==================
Version change: (blank template) → 1.0.0
Bump rationale: MAJOR — first population from a blank template; all five principles are new,
two additional sections (Quality Gates, Development Workflow) added, and full governance
established from scratch.

Added principles:
  - I. Code Quality Standards (new)
  - II. Test-First Development (new)
  - III. Testing Standards (new)
  - IV. User Experience Consistency (new)
  - V. Performance Requirements (new)

Added sections:
  - Quality Gates
  - Development Workflow

Removed sections: none

Template alignment:
  ✅ .specify/templates/plan-template.md — Constitution Check section already reads
     "Gates determined based on constitution file"; no structural change needed.
  ✅ .specify/templates/spec-template.md — User Scenarios, Requirements, and Success
     Criteria sections align with all five principles; no structural change needed.
  ✅ .specify/templates/tasks-template.md — Contract tests, performance optimization,
     and security hardening already present as task categories; no structural change needed.

Deferred TODOs: none — all placeholders resolved.
-->

# CardFlow Constitution

## Core Principles

### I. Code Quality Standards

All code MUST be clean, readable, and maintainable at the point it is merged.

- Functions and methods MUST have a single, clear responsibility (SRP).
- Dead code, unused imports, and commented-out blocks MUST NOT be merged.
- Code MUST pass linting and static analysis with zero errors or warnings.
- All pull requests MUST be reviewed by at least one peer before merging.
- Complexity MUST be justified; simpler alternatives MUST be considered and explicitly
  rejected before introducing an abstraction.

**Rationale**: Unmanaged complexity compounds over time. Enforcing quality at merge time
prevents technical debt from accumulating and keeps the codebase navigable.

### II. Test-First Development (NON-NEGOTIABLE)

Tests MUST be written before implementation code. The Red-Green-Refactor cycle is strictly
enforced on all feature work.

- Acceptance scenarios from `spec.md` MUST be encoded as failing tests before any
  implementation begins.
- Tests MUST cover the happy path and at least two failure or edge cases per feature.
- No new feature code MUST be merged without corresponding, passing tests.
- The sequence is: write tests → get approval → confirm tests fail → implement → refactor.

**Rationale**: Tests written after the fact verify what was built, not what was required.
Writing them first drives correct design and provides a living specification.

### III. Testing Standards

Multiple layers of testing MUST be present for every feature.

- Unit tests MUST cover all business logic functions in isolation.
- Integration tests MUST verify component interactions and data-persistence paths.
- Contract tests MUST be written for all API endpoints and shared interfaces.
- E2E tests MUST cover all P1 user stories end-to-end.
- Tests MUST be deterministic, isolated, and runnable without external network access
  (integration tests excepted, with explicit environment gating).
- Code coverage MUST remain at or above 80% for all modules; drops below this threshold
  block merging.

**Rationale**: Each test layer catches a distinct class of defect. Omitting a layer leaves
a blind spot that only surfaces in production.

### IV. User Experience Consistency

The user interface MUST feel coherent and predictable across all features.

- All interactive elements MUST follow the established design system
  (spacing, color, typography, iconography).
- Error messages MUST be human-readable and guide the user toward a resolution.
- All user-facing flows MUST support keyboard navigation and screen-reader accessibility,
  meeting WCAG 2.1 AA as the minimum bar.
- UI component reuse MUST be preferred over one-off implementations.
- A UX consistency review MUST be completed for all P1 and P2 user stories before they
  are considered done.

**Rationale**: Inconsistent UX erodes user trust and increases support burden.
Consistency must be a gate, not an afterthought.

### V. Performance Requirements

Application performance MUST meet defined budgets; exceeding them blocks shipping.

- Page initial load MUST complete within 3 seconds on a standard broadband connection
  (≥ 25 Mbps).
- Core Web Vitals MUST meet "Good" thresholds: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- API read operations MUST respond in < 200 ms at p95; write operations in < 500 ms
  at p95 under normal load.
- Performance regression tests MUST run against any change touching the critical
  rendering path or data-access layer.
- Memory leaks MUST be investigated and resolved before a feature is considered complete.

**Rationale**: Performance is a feature. Budgets degrade silently without hard gates;
shipping regressions are far more costly than catching them pre-merge.

## Quality Gates

Any pull request MUST pass all of the following gates before merging:

- Linting and type checking pass with zero errors or warnings.
- All test suites (unit, integration, contract) pass.
- Code coverage does not drop below the 80% module threshold.
- Performance budgets are not exceeded, verified by automated performance tests.
- UX consistency review is complete for all user-facing changes.
- Security scan passes for any change touching authentication, authorization, or
  data handling.

No exception to a quality gate is permitted without explicit sign-off from the project
lead and a corresponding entry in the Complexity Tracking table of the implementation
plan.

## Development Workflow

The workflow enforces incremental, independently testable delivery per the Spec Kit
methodology:

- Features MUST be developed on dedicated feature branches created by
  `/speckit-git-feature`.
- Implementation MUST follow the task order defined in `tasks.md`, respecting phase
  dependencies.
- Each user story MUST be independently testable and demonstrable before proceeding to
  the next priority level.
- Commits MUST be atomic and reference a task ID
  (e.g., `feat: T012 implement card creation service`).
- The Definition of Done for any task requires: implementation complete, all tests
  passing, code reviewed, and documentation updated.

## Governance

This constitution supersedes all other development guidelines and team conventions.
Amendments require:

1. A written proposal describing the change, motivation, and impact on existing artifacts.
2. Review by at least two team members.
3. A migration plan for any affected features or templates.
4. An update to this file with an incremented version number and amended date.

All pull requests and code reviews MUST verify compliance with this constitution.
Violations MUST be flagged and resolved before merging. Refer to
`.specify/memory/constitution.md` as the authoritative runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-02 | **Last Amended**: 2026-06-02
