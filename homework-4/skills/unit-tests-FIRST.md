# FIRST Principles for Unit Testing

## The FIRST Acronym

| Principle | Description | How to Achieve |
|-----------|-------------|----------------|
| **F**ast | Tests execute in milliseconds | Mock external dependencies, avoid I/O |
| **I**ndependent | No test depends on another | Each test sets up its own state |
| **R**epeatable | Same result every run | No randomness, no external state |
| **S**elf-validating | Pass/fail without manual inspection | Clear assertions, no console checking |
| **T**imely | Written alongside code changes | Test during development, not after |

## Implementation Guidelines

### Fast
- Mock database calls
- Mock external API calls
- Avoid file system operations
- Target: <100ms per test

### Independent
- Use `beforeEach` for setup
- Clean up in `afterEach`
- No shared mutable state between tests
- Tests can run in any order

### Repeatable
- No `Math.random()` without seeding
- No `Date.now()` without mocking
- No network calls to real services
- Same input = same output, always

### Self-validating
- Use explicit assertions (`expect`, `assert`)
- No manual log inspection required
- Clear pass/fail status
- Descriptive failure messages

### Timely
- Write test before or with the fix
- Don't defer testing
- Test covers the specific change made

## Test Structure Template

```javascript
describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // Setup - Independent
    });

    afterEach(() => {
      // Cleanup - Independent
    });

    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionName(input);

      // Assert - Self-validating
      expect(result).toEqual(expected);
    });
  });
});
```
