---
name: research-quality-measurement
description: Defines quality levels for bug-research artifacts and the criteria to assign each level. Use when verifying a codebase-research document.
---

# Research Quality Measurement

Use this scale when rating the Bug Researcher's output in `verified-research.md`.

## Levels

| Level | Label | Criteria |
|-------|-------|----------|
| 4 | **HIGH** | 100% of file:line refs valid; all snippets match source verbatim; root cause clearly localized for every finding; no missing context. |
| 3 | **MEDIUM** | >= 80% refs valid; minor snippet drift (whitespace/formatting only); root cause identified but with small context gaps. |
| 2 | **LOW** | 50–79% refs valid; multiple snippet mismatches; root cause hypothesized but not confirmed. |
| 1 | **INSUFFICIENT** | < 50% refs valid OR a core claim is contradicted by source. |

### Root cause "clearly localized" means
One sentence containing **all** of: file path, function name, line range, mechanism (e.g. "`src/notes.js:18`, `listNotes` — `start` is `page * perPage` instead of `(page - 1) * perPage`, so page 1 returns the second batch").

### Aggregation rule (multiple findings)
**Overall level = the lowest level across all findings.** One broken finding sinks the whole rating. Rationale: the Planner/Fixer downstream cannot pick-and-choose; if one finding is unverifiable, the plan is unsafe to execute end-to-end.

### Action per level (decision rule for the pipeline)
| Level | Pipeline action |
|-------|-----------------|
| HIGH    | Proceed to Bug Planner. |
| MEDIUM  | Proceed to Bug Planner. Flag context gaps in `verified-research.md`. |
| LOW     | Proceed only if every individual finding is at least MEDIUM after re-scoring per finding. Otherwise STOP. Always flag in the summary. |
| INSUFFICIENT | **STOP.** Do not pass to Planner. Verifier must list what is missing so the Researcher can re-run. |

## Required usage in verified-research.md

In the **Verification Summary** section include:
```
Research Quality: <LEVEL> (<n>/4)
Pipeline action: <PROCEED | PROCEED-WITH-FLAGS | STOP>
```

In the **Research Quality Assessment** section include:
- Selected level + label
- Counts: refs checked / valid / invalid
- Snippet mismatches: count and short list (file:line — expected vs actual)
- Per-finding levels (if more than one finding)
- Reasoning paragraph (1–3 sentences)

## Example verdicts

**HIGH** — "All 6 file:line refs verified against current source; both findings have full root-cause sentences; no snippet drift. Pipeline action: PROCEED."

**INSUFFICIENT** — "3 of 7 refs point to lines that do not contain the quoted code (drift > formatting). Bug B's root cause claims a missing `await` but the function is synchronous. Pipeline action: STOP — researcher must re-scan."
