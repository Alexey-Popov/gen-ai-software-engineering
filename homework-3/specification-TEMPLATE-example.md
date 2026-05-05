# Specification Templates for AI-Assisted Development

## Basic Specification Template

```markdown
# [Feature Name] Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective
- [Clear, single sentence describing what you want to build]

## Mid-Level Objectives
- [List of 3-5 concrete, measurable objectives]
- [Each objective should be specific enough to be testable]
- [Focus on what the system should do, not how]

## Implementation Notes
- [Important technical details and constraints]
- [Dependencies and requirements]
- [Coding standards to follow]
- [Performance requirements]
- [Security considerations]

## Context

### Beginning context
- [List of files that exist at start]
- [Current system state]
- [Available resources]

### Ending context
- [List of files that will exist at end]
- [Expected system state]
- [Deliverables]

## Low-Level Tasks

### 1. [First task name]

What prompt would you run to complete this task?
[Specific prompt for AI]

What file do you want to CREATE or UPDATE?
[File path]

What function do you want to CREATE or UPDATE?
[Function/class name]

What are details you want to add to drive the code changes?
[Specific requirements and constraints]

### 2. [Second task name]

What prompt would you run to complete this task?
[Specific prompt for AI]

What file do you want to CREATE or UPDATE?
[File path]

What function do you want to CREATE or UPDATE?
[Function/class name]

What are details you want to add to drive the code changes?
[Specific requirements and constraints]

### 3. [Third task name]

What prompt would you run to complete this task?
[Specific prompt for AI]

What file do you want to CREATE or UPDATE?
[File path]

What function do you want to CREATE or UPDATE?
[Function/class name]

What are details you want to add to drive the code changes?
[Specific requirements and constraints]

## Banking-Specific Specification Template

# [Feature] Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective
- [Clear description of the banking feature]

## Mid-Level Objectives
- [Compliance and regulatory requirements]
- [Security and data protection measures]
- [Audit and logging requirements]
- [Performance and scalability needs]
- [Integration requirements]

## Implementation Notes
- [Data privacy requirements (GDPR, CCPA)]
- [Audit trail requirements]
- [Error handling and logging]
- [Input validation and sanitization]
- [Use Decimal for all monetary calculations]
- [Include comprehensive testing]

## Context

### Beginning context
- [Existing banking systems]
- [Current data models]
- [Available APIs and services]

### Ending context
- [New banking components]
- [Updated data models]
- [Integration points]
- [Compliance documentation]

## Low-Level Tasks

### 1. [Compliance task]

What prompt would you run to complete this task?
[Specific compliance requirement]

What file do you want to CREATE or UPDATE?
[Compliance-related file]

What function do you want to CREATE or UPDATE?
[Compliance function]

What are details you want to add to drive the code changes?
[Specific compliance requirements]


### 2. [Security task]

What prompt would you run to complete this task?
[Security implementation]

What file do you want to CREATE or UPDATE?
[Security-related file]

What function do you want to CREATE or UPDATE?
[Security function]

What are details you want to add to drive the code changes?
[Security requirements]

### 3. [Business logic task]

What prompt would you run to complete this task?
[Business logic implementation]

What file do you want to CREATE or UPDATE?
[Business logic file]

What function do you want to CREATE or UPDATE?
[Business function]

What are details you want to add to drive the code changes?
[Business requirements]

## API Development Specification Template

```markdown
# [API Name] Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective
- [Build a RESTful API for specific functionality]

## Mid-Level Objectives
- [Define API endpoints and data models]
- [Implement authentication and authorization]
- [Add input validation and error handling]
- [Include comprehensive testing]
- [Add API documentation]

## Implementation Notes
- [Use FastAPI for Python APIs]
- [Include OpenAPI/Swagger documentation]
- [Implement proper HTTP status codes]
- [Add rate limiting and throttling]
- [Include comprehensive logging]
- [Follow RESTful design principles]

## Context

### Beginning context
- [Empty project directory]
- [Programming language environment]
- [ CLI tool available]

### Ending context
- [Complete API implementation]
- [Test suite]
- [API documentation]
- [Deployment configuration]

## Low-Level Tasks

### 1. [Data model task]

What prompt would you run to complete this task?
[Create data models]

What file do you want to CREATE or UPDATE?
[models]

What function do you want to CREATE or UPDATE?
[Data model classes]

What are details you want to add to drive the code changes?
[Specific data model requirements]

### 2. [API endpoint task]

What prompt would you run to complete this task?
[Create API endpoints]

What file do you want to CREATE or UPDATE?
[main or api]

What function do you want to CREATE or UPDATE?
[API route functions]

What are details you want to add to drive the code changes?
[Specific endpoint requirements]

### 3. [Testing task]

What prompt would you run to complete this task?
[Create test suite]

What file do you want to CREATE or UPDATE?
[test_api]

What function do you want to CREATE or UPDATE?
[Test functions]

What are details you want to add to drive the code changes?
[Specific testing requirements]

## Testing Specification Template

```markdown
# [Feature Name] Testing Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective
- [Create comprehensive test suite for the feature]

## Mid-Level Objectives
- [Unit tests for all functions and methods]
- [Integration tests for component interactions]
- [Edge case and error condition testing]
- [Performance and load testing]
- [Security and compliance testing]

## Implementation Notes
- [Use pytest for Python testing]
- [Include test fixtures and mock data]
- [Test both happy path and error conditions]
- [Include performance benchmarks]
- [Test security vulnerabilities]
- [Include compliance validation tests]

## Context

### Beginning context
- [Existing codebase]
- [Test framework setup]
- [Mock data available]

### Ending context
- [Complete test suite]
- [Test documentation]
- [CI/CD integration]
- [Coverage reports]

## Low-Level Tasks

### 1. [Unit test task]

What prompt would you run to complete this task?
[Create unit tests]

What file do you want to CREATE or UPDATE?
[test_[module]]

What function do you want to CREATE or UPDATE?
[Test functions]

What are details you want to add to drive the code changes?
[Specific testing requirements]

### 2. [Integration test task]

What prompt would you run to complete this task?
[Create integration tests]

What file do you want to CREATE or UPDATE?
[test_integration]

What function do you want to CREATE or UPDATE?
[Integration test functions]

What are details you want to add to drive the code changes?
[Specific integration requirements]


### 3. [Performance test task]
What prompt would you run to complete this task?
[Create performance tests]

What file do you want to CREATE or UPDATE?
[test_performance]

What function do you want to CREATE or UPDATE?
[Performance test functions]

What are details you want to add to drive the code changes?
[Specific performance requirements]


## Prompt Engineering Best Practices

### Effective Prompt Structure
1. **Context**: Provide relevant background information
2. **Task**: Clearly describe what you want the AI to do
3. **Constraints**: Specify any limitations or requirements
4. **Examples**: Include examples when helpful
5. **Output Format**: Specify the desired output format

### Specific Prompt Guidelines
- Always mention compliance requirements
- Include security considerations
- Specify data privacy requirements
- Mention audit trail needs
- Include error handling requirements
- Specify testing requirements

### Common Prompt Patterns

#### Code Generation
```
Create a [function/class] that [specific functionality] with the following requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Include proper error handling, logging, and tests.
```

#### Refactoring
```
Refactor the following code to [specific improvement] while maintaining the same functionality:
- [Current code]

Requirements:
- [Requirement 1]
- [Requirement 2]
```

#### Testing
```
Create comprehensive tests for the following [function/class]:
- [Code to test]

Test cases should include:
- [Test case 1]
- [Test case 2]
- [Edge cases]
- [Error conditions]
```

#### Documentation
```
Generate documentation for the following [function/class]:
- [Code to document]

Include:
- [Documentation requirement 1]
- [Documentation requirement 2]
- [Examples]
- [Usage instructions]
```
