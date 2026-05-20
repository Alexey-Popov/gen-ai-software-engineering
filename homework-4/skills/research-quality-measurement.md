# Research Quality Measurement Skill

## Quality Levels

| Level | Score | Description |
|-------|-------|-------------|
| EXCELLENT | 90-100% | All references verified, code snippets match exactly |
| GOOD | 70-89% | Minor discrepancies, references mostly accurate |
| FAIR | 50-69% | Several inaccuracies, some references outdated |
| POOR | <50% | Major discrepancies, unreliable research |

## Scoring Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| File References | 40% | All file paths exist and are correct |
| Line Numbers | 30% | Line numbers point to actual code locations |
| Code Snippets | 20% | Snippets match source code exactly |
| Technical Analysis | 10% | Analysis is technically sound and accurate |

## Verification Process

1. **File Existence**: Check every referenced file path exists
2. **Line Accuracy**: Verify line numbers point to correct locations
3. **Snippet Match**: Compare code snippets with actual source
4. **Logic Check**: Validate technical analysis is correct

## Output Format

```markdown
## Verification Summary

- **Status**: PASS / FAIL
- **Quality Level**: EXCELLENT / GOOD / FAIR / POOR
- **Score**: X%

## Verified Claims

| Claim | File:Line | Status | Notes |
|-------|-----------|--------|-------|
| ... | ... | ✅/❌ | ... |

## Discrepancies Found

1. [Description of discrepancy]
   - Expected: ...
   - Actual: ...

## Quality Assessment

**Level**: [LEVEL]
**Reasoning**: [Why this level was assigned]
```
