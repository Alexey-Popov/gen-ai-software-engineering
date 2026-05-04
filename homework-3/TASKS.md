# Homework 3: Specification-Driven Design

## Overview

Design a **specification package** for a finance-oriented application. You produce only documents: a layered specification, agent rules, and a README that explains your choices and industry practices. **No implementation required.**

The graded artifact is the **specification itself**: how clearly you decompose the problem, how traceable requirements are from goals down to tasks, and how well you anticipate failure modes, verification, and non-functional expectations.

---

## Learning Objectives

By completing this homework, you will:

- Structure **multiple levels** of intent: vision / high-level objective → mid-level objectives → implementation notes → explicit beginning/ending context → low-level, implementable tasks
- Define agent configuration (`agents.md`) so an AI coding partner behaves consistently in your domain
- Capture project conventions in Copilot rules, Claude Code `.md`, or Cursor rules
- Reflect FinTech/banking best practices in your spec (compliance, security, audit, data handling)
- Encode **edge cases**, **verification** expectations, and **performance** (or other SLO-style) targets as first-class parts of the spec—not as afterthoughts

---

## Task

### Project requirements (high-level only)

You choose scope and depth; the bullets below are intentionally broad so you **refine and tighten** them in your specification.

- **Domain**: A finance-related application—for example **virtual card** lifecycle (create, freeze/unfreeze, set limits, view transactions) or another small finance feature you prefer (spending caps, card replacement, notifications, dispute intake, etc.).
- **Stakeholders**: Assume at least **end-users** and an **internal ops/compliance** view. You may add others (support, fraud, finance) if it increases realism.
- **Constraints**: The system should be suitable for a **regulated** environment: auditability, security, and clear boundaries for sensitive data. You decide how strict and **where** each concern appears in the spec (objectives vs. implementation notes vs. per-task acceptance criteria).
- **Out of scope for this homework**: Actual code, APIs, or UI. Only written specification and supporting docs (`agents.md`, rules, `README.md`) are required.

Use these points as the **seed requirements**; your job is to turn them into a **concrete, multi-level, implementable** specification and to justify your choices in the README.

---

### What “in depth” means for `specification.md`

Your `specification.md` must read like something an engineering team (and an AI agent) could execute **without guessing**. Aim for **rich layering**, not long prose for its own sake.

| Layer | Purpose | What to include (minimum bar) |
|--------|---------|-------------------------------|
| **High-level objective** | North star | One crisp statement of user/business outcome; scope boundary in one sentence |
| **Mid-level objectives** | Testable “what” | Several objectives that are **observable** (what changes in the world when this succeeds?) |
| **Non-functional & policy** | How well / how safely | Security, privacy, audit/logging expectations, **reliability**, and **performance or latency budgets** where relevant—stated as targets or ranges, not vague “should be fast” |
| **Implementation notes** | Guardrails for builders | Data handling rules, idempotency, error semantics, formatting of money/IDs, conventions an agent must not violate |
| **Context (beginning / ending)** | Agent workspace | What exists before work starts vs. what artifacts/state exist after—files, services, data stores **as hypothetical** if you prefer, but be specific enough to avoid ambiguity |
| **Low-level tasks** | Executable slices | Enough tasks to show **real decomposition** (typically **many** small tasks, not three generic bullets). Each task should tie back to which mid-level objective it serves |

**Cross-cutting requirements (must appear somewhere in the spec, not only in README):**

1. **Edge cases and failure modes**  
   - Explicit list or table: empty states, partial failures, concurrent actions, invalid limits, stale data, permission boundaries, fraud-ish patterns, etc.—**scoped to your chosen feature**, not a generic security essay.  
   - For important flows, state **expected behavior** (user-visible outcome + audit/compliance implication where relevant).

2. **Verification**  
   - How you would **know** each mid-level objective is met: review checkpoints, test categories (unit/integration/e2e where applicable **as documentation**), data fixtures, reconciliation checks, or manual compliance review steps.  
   - At least several low-level tasks should end with **acceptance criteria** or **definition of done** phrased so an implementer could check them off.

3. **Expected performance**  
   - Define **measurable** expectations appropriate to your feature: e.g. API latency percentiles, batch size limits, pagination rules, rate limits, time-to-consistency for reads after writes, or throughput for a background job.  
   - If numbers are hypothetical, label them as **assumed targets** and explain **why** they are reasonable for FinTech UX or ops.

---

## Deliverables

Your submission must include the following files in `homework-3/`:

### 1. `specification.md`

Full product/feature spec following a **layered** structure (see table above). You may use `specification-TEMPLATE-example.md` as a starting shape, but you are expected to **go beyond** the minimal template: more objectives, richer implementation notes, fuller context, and a **substantial** low-level task list with acceptance-style detail, **edge cases**, **verification**, and **performance** expectations integrated—not relegated to a single vague bullet.

### 2. `agents.md`

Agent/AI guidelines: tech stack assumptions, domain rules (e.g. banking), code style, **testing and verification expectations**, security and compliance constraints, and **how the agent should treat edge cases** (e.g. never log PAN, always prefer idempotent writes).

### 3. Editor / AI rules

One set of editor/AI rules (e.g. `.github/copilot-instructions.md`, `.claude/` file, or `.cursor/rules/*.md`) that steer how AI should work in this project (naming, patterns, what to avoid, FinTech-sensitive defaults).

### 4. `README.md`

| Section | Content |
|---------|---------|
| Student & task summary | Your name and brief summary of the homework |
| Rationale | Why this specification was written this way (including how you chose performance targets and verification depth) |
| Industry best practices | Which practices you added and **where they appear** in the spec (file/section references) |

---

<div align="center">

**Good luck. No coding required—depth of the specification, traceability from goals to tasks, and clarity of rationale and best practices are what matter.**

</div>
