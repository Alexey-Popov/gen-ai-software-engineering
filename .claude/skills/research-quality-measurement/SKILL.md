---
name: research-quality-measurement
description: Use when verifying bug research output to assign a standardised research-quality level (EXCELLENT / GOOD / FAIR / POOR) based on verifiable claims, file:line accuracy, and snippet fidelity. Required before writing verified-research.md.
---

# Research Quality Measurement

## Purpose

Apply this skill every time the **Research Verifier** evaluates `codebase-research.md`.
It gives a deterministic, threshold-driven quality rating that the Bug Planner can use to
decide whether research is trustworthy enough to base an implementation plan on.

## Bug ID and File Paths

The pipeline runner passes a `<bug-id>` in the task prompt (e.g. `001-security-path-traversal`).
All paths are relative to the `homework-4/` project root.

| Role | Path |
|------|------|
| **Input** | `context/bugs/<bug-id>/research/codebase-research.md` |
| **Output** | `context/bugs/<bug-id>/research/verified-research.md` |

Create the `research/` subdirectory if it does not exist before writing the output file.

## Definitions

| Term | Meaning |
|------|---------|
| **Claim** | Any checkable assertion in the research document — a `file:line` reference, a quoted code snippet, a stated cause-effect relationship tied to a specific location. Pure narrative without a file/line anchor is not a claim. |
| **Verified claim** | The claim's file exists, the line number is correct (±2 lines is acceptable), and the quoted snippet matches the actual source character-for-character (modulo leading whitespace). |
| **Critical discrepancy** | A `file:line` that does not exist, or a snippet that contradicts what is actually at that location. Signals the researcher looked at the wrong code or fabricated evidence. |
| **Minor discrepancy** | Line number off by more than 2, a paraphrase rather than a direct quote, or a stale reference that is close but not exact. The underlying bug identification is still correct. |
| **Verification rate** | `(number of verified claims) / (total number of verifiable claims) × 100 %` |

## Quality Levels

Apply the **highest** level whose criteria are fully satisfied. Minor discrepancies do not
lower the level — only the verification rate and critical discrepancies determine it.

| Level | Verdict | Verification Rate | Critical Discrepancies |
|-------|---------|------------------|------------------------|
| **EXCELLENT** | PASS | ≥ 95 % | 0 |
| **GOOD** | PASS | ≥ 80 % | 0 |
| **FAIR** | PASS | ≥ 60 % and < 80 % | 0 |
| **POOR** | FAIL | < 60 % | 0 |
| **POOR** | FAIL | any rate | ≥ 1 |

> **Override rule:** If any critical discrepancy is found, the rating is **POOR / FAIL** —
> even if the verification rate would otherwise qualify for a higher level.

> **PASS/FAIL mapping:** EXCELLENT, GOOD, and FAIR all yield a **PASS** verdict in the
> Verification Summary. Only **POOR** yields **FAIL**. A FAIR document is sufficient for
> planning but should note the lower confidence. A POOR document must be re-researched
> before an implementation plan is produced.

## How to Compute the Rating

1. Read `context/bugs/<bug-id>/research/codebase-research.md` and list every verifiable claim.
   - **If there are zero verifiable claims:** rate = 0 %, level = **POOR / FAIL**. Note in the
     Verification Summary that the research contained no checkable references and cannot be
     trusted as evidence for an implementation plan.
2. For each claim, open the referenced file and check the referenced line(s).
   - Mark **verified** if the file, line, and snippet all match.
   - Mark **critical discrepancy** if the file or content is wrong.
   - Mark **minor discrepancy** if the line is slightly off or the snippet is paraphrased.
3. Count: `total`, `verified`, `critical`, `minor`.
4. Compute `verification_rate = verified / total * 100`.
5. Apply the override: if `critical ≥ 1`, level = **POOR / FAIL**.
6. Otherwise pick the level from the table above.

## Required Sections in `verified-research.md`

The output file **must** contain all five sections:

| Section | Content |
|---------|---------|
| **Verification Summary** | Overall pass/fail verdict + Research Quality level (one of EXCELLENT / GOOD / FAIR / POOR) |
| **Verified Claims** | Bulleted list of every claim that passed, with `file:line` and confirmation note |
| **Discrepancies Found** | Each discrepancy: type (critical / minor), original claim, actual content found, impact on reliability |
| **Research Quality Assessment** | The level assigned, the numbers used to reach it (rate, counts), and a one-paragraph reasoning |
| **References** | All source files consulted, with paths relative to project root |

## Worked Example

Suppose `codebase-research.md` makes 10 verifiable claims:
- 9 are verified exactly.
- 1 is off by 3 lines (minor discrepancy).
- 0 critical discrepancies.

Computation:
```
verified = 9, total = 10
verification_rate = 90 %
critical = 0  → override does NOT trigger
90 % ≥ 80 % AND critical = 0  → level = GOOD / PASS
```

Result in `verified-research.md`:
> **Verification Summary:** PASS — Research Quality: **GOOD**
> **Research Quality Assessment:** 9/10 claims verified (90%). One minor discrepancy
> (line number off by 3). No critical discrepancies. Sufficient for planning.
