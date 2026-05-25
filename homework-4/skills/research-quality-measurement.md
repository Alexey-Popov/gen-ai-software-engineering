---
name: research-quality-measurement
description: Defines quality levels for bug-research artifacts and the criteria to assign each level. Use when verifying a codebase-research document.
---

# Research Quality Measurement

Use this scale when rating the Bug Researcher's output in `verified-research.md`.

## Levels

| Level | Label | Criteria |
|-------|-------|----------|
| 4 | **HIGH** | 100% of file:line refs valid; all snippets match source verbatim; root cause clearly localized; no missing context. |
| 3 | **MEDIUM** | >= 80% refs valid; minor snippet drift (formatting); root cause identified but some context gaps. |
| 2 | **LOW** | 50–79% refs valid; multiple snippet mismatches; root cause hypothesized but not confirmed. |
| 1 | **INSUFFICIENT** | < 50% refs valid OR core claim contradicted by source. Re-run research before fixing. |

## Required usage in verified-research.md

In the `Verification Summary` section include:
```
Research Quality: <LEVEL> (<n>/4)
```

In the `Research Quality Assessment` section include:
- Selected level
- Counts: refs checked / valid / invalid
- Snippet mismatches: count and short list
- Reasoning paragraph
