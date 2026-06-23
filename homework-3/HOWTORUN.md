# How to Use This Specification Package

This homework contains **no runnable code**. The deliverable is a specification package — a set of documents that define what to build, how to build it safely, and how to verify it was built correctly.

---

## What Is in This Package

```
homework-3/
├── specification.md                    # Full layered product specification
├── agents.md                           # AI agent guidelines for this project
├── .cursor/rules/fintech-virtual-card.md  # Cursor IDE rules for code generation
├── README.md                           # Rationale, author, best practices reference
└── HOWTORUN.md                         # This file
```

---

## How to Read the Specification

The `specification.md` is structured top-down. Read it in this order:

1. **High-Level Objective** — understand the north star and scope boundary before reading anything else.
2. **Mid-Level Objectives (MO-1 through MO-6)** — each is an observable, testable outcome. Note the MO codes — they are referenced throughout the rest of the document.
3. **Non-Functional Requirements (NFR-1 through NFR-5)** — read the performance table and the Sensitive Data rules carefully. These are constraints, not suggestions.
4. **Implementation Notes** — the guardrails. Any implementation decision not covered here is a free choice; anything listed here is mandatory.
5. **Context** — understand what infrastructure is assumed to exist (Identity Provider, Core Banking System, Card Network Adapter) before reading the tasks.
6. **Low-Level Tasks (TASK-01 through TASK-16)** — each task is self-contained with a prompt, target artifacts, details, and acceptance criteria. They are ordered to minimize dependencies: data models first, then endpoints, then cross-cutting concerns, then tests.
7. **Edge Cases & Failure Modes** — read these after the tasks to understand what boundary conditions each task must handle.
8. **Verification Plan** — maps each MO to specific tests and reconciliation checks.

---

## How to Use This Spec with an AI Agent

If you are using an AI coding agent (e.g. Cursor, GitHub Copilot, Claude) to implement this feature:

1. **Load `agents.md` first** — paste it into the agent's context or reference it as a system prompt. This sets domain rules and hard constraints before any code is generated.

2. **Enable Cursor rules** — the `.cursor/rules/fintech-virtual-card.md` file is automatically picked up by Cursor IDE when working in this project directory. No manual setup required.

3. **Execute tasks sequentially** — start with TASK-01 and proceed in order. Data models must exist before endpoints; endpoints must exist before integration tests.

4. **Verify acceptance criteria after each task** — each task's `Acceptance Criteria` section contains checkable items. Do not proceed to the next task until all criteria are met.

5. **Use the prompt field** — each Low-Level Task contains a `Prompt:` field. This is a ready-to-use instruction for the AI agent describing exactly what to build.

---

## How to Verify the Specification Quality

To review this specification as a grader or peer reviewer:

| Check | What to Look For |
|---|---|
| **Traceability** | Every Low-Level Task has a `Serves: MO-X` reference. Follow the chain: task → MO → high-level objective. |
| **Acceptance Criteria** | Each task ends with `[ ]` checkboxes. Verify they are specific and independently verifiable. |
| **Edge Cases** | Five edge-case tables covering provisioning, freeze/unfreeze, limits, transaction history, authorization, and security. |
| **Performance targets** | NFR-1 table with p50/p95/p99 values and a rationale note explaining why the numbers are reasonable. |
| **Sensitive data rules** | Search for `PAN`, `CVV`, `Never` in the spec — verify hard constraints are stated as absolutes, not recommendations. |
| **Audit log completeness** | Verify that every state-changing task (TASK-05 through TASK-10, TASK-12) includes an audit log entry in its acceptance criteria. |

---

## No Code to Run

This submission is a documentation-only deliverable per the homework requirements:

> *"Out of scope for this homework: Actual code, APIs, or UI. Only written specification and supporting docs (agents.md, rules, README.md) are required."*
> — `TASKS.md`

To run an actual implementation based on this spec, follow TASK-01 through TASK-16 in `specification.md`.

---
