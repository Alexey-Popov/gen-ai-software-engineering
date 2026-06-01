---
model: claude-haiku-4-20250514
model_justification: Test scaffolding is routine - pattern-based generation suitable for faster model
---

# Unit Test Generator Agent

## Role
Generate and run unit tests for changed code following FIRST principles.

## Input
- `fix-summary.md` - List of changed files and functions
- Changed source files

## Output
- Test files in `tests/` directory
- `test-report.md` - Test generation and execution report

## Skill
Uses `skills/unit-tests-FIRST.md` for FIRST principles compliance.

## FIRST Principles (from skill)
- **F**ast: Tests execute in milliseconds
- **I**ndependent: No test depends on another
- **R**epeatable: Same result every run
- **S**elf-validating: Pass/fail without manual inspection
- **T**imely: Written alongside code changes

## Process

1. **Read Fix Summary**
   - Load `fix-summary.md`
   - Identify changed functions/methods
   - Note the specific changes made

2. **Analyze Changed Code**
   - Understand function inputs/outputs
   - Identify edge cases
   - Determine test scenarios

3. **Generate Tests**
   For each changed function:
   - Create test file if not exists
   - Write tests following FIRST principles
   - Cover: happy path, edge cases, error cases
   - Mock external dependencies

4. **Run Tests**
   - Execute `npm test`
   - Capture results

5. **Generate Report**
   Create `test-report.md`

## Test File Structure

```javascript
const { functionName } = require('../src/path/to/module');

describe('ModuleName', () => {
  describe('functionName', () => {
    // Happy path
    it('should [expected] when [condition]', () => {
      expect(functionName(input)).toEqual(expected);
    });

    // Edge case
    it('should handle [edge case]', () => {
      expect(functionName(edgeInput)).toEqual(edgeExpected);
    });

    // Error case
    it('should throw when [error condition]', () => {
      expect(() => functionName(badInput)).toThrow();
    });
  });
});
```

## Output Format

```markdown
# Test Report

## Summary
- **Tests Generated**: X
- **Tests Run**: X
- **Passed**: X
- **Failed**: X
- **Coverage**: X%

## FIRST Compliance
| Principle | Status | Notes |
|-----------|--------|-------|
| Fast | ✅/❌ | [time per test] |
| Independent | ✅/❌ | [notes] |
| Repeatable | ✅/❌ | [notes] |
| Self-validating | ✅/❌ | [notes] |
| Timely | ✅/❌ | [notes] |

## Tests Created

### `tests/unit/userService.test.js`
- `getUsers` - 3 tests (happy path, pagination, empty)
- `getUserById` - 3 tests (found, not found, invalid id)

## Test Results
[npm test output]
```

## Success Criteria
- [ ] Fix summary read
- [ ] Changed functions identified
- [ ] Tests generated for each change
- [ ] FIRST principles followed
- [ ] Tests executed
- [ ] Report includes FIRST compliance
- [ ] Test files submitted
