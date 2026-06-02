# Skill: Research Quality Measurement

This skill defines the quality levels used by the Research Verifier when evaluating `codebase-research.md`. The verifier must select **exactly one level** and justify it in the Research Quality Assessment section of `verified-research.md`.

---

## Quality Levels

| Level | Criteria |
|-------|----------|
| **Excellent** | ≥ 90% of claims verified, no critical discrepancies |
| **Adequate** | 70–89% of claims verified, only minor discrepancies |
| **Insufficient** | 50–69% of claims verified, or any claim with a wrong file path |
| **Rejected** | < 50% of claims verified, or fabricated snippets found |

---

## Definitions

**Verified claim** — A claim where the cited file exists, the line number matches the quoted snippet exactly, and the described issue is present in the source.

**Minor discrepancy** — A claim where the file path is correct but the line number is off by ≤ 3 lines, or the snippet is paraphrased rather than quoted verbatim, but the issue is real.

**Critical discrepancy** — A claim where the file path is wrong, the quoted snippet does not appear in the file, or the described issue does not exist in the source.

**Fabricated snippet** — A quoted code block that does not appear anywhere in the codebase.

---

## How to Apply

1. Count total claims in `codebase-research.md`.
2. For each claim, open the cited file and check the line number and snippet.
3. Mark each claim: **Verified**, **Minor Discrepancy**, or **Critical Discrepancy**.
4. Calculate the verified percentage: `(Verified claims / Total claims) × 100`.
5. Check whether any fabricated snippets or wrong file paths exist.
6. Select the single matching level from the table above.
7. Write the level label and a one-paragraph justification in the **Research Quality Assessment** section.
