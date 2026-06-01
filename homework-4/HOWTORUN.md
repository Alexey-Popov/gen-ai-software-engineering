# How to Run

## Prerequisites

- Node.js 18+
- npm
- Claude Code CLI (for pipeline)

## Installation

```bash
cd homework-4
npm install
```

## Run Application

```bash
npm start
```

Server starts on http://localhost:3000

## Test Endpoints

```bash
# List users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/1

# Search users
curl http://localhost:3000/users/search?name=Alice

# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# Health check
curl http://localhost:3000/health
```

## Run Tests

```bash
npm test
```

## Run Pipeline

```bash
npm run pipeline
# or
./run-pipeline.sh
```

## Verify Bugs (Before Fix)

### Bug 1: Off-by-one
```bash
curl "http://localhost:3000/users?page=1&limit=2"
# Should show users 3,4 instead of 1,2 (BUG)
```

### Bug 2: Null handling
```bash
curl http://localhost:3000/users/999
# Should return 500 error instead of 404 (BUG)
```

### Security: SQL Injection
```bash
curl "http://localhost:3000/users/search?name='; DROP TABLE users; --"
# Vulnerable to injection (SECURITY ISSUE)
```

## Pipeline Execution Order

1. **Research Verifier** → `verified-research.md`
2. **Bug Fixer** → `fix-summary.md` + code changes
3. **Security Verifier** → `security-report.md`
4. **Unit Test Generator** → `test-report.md` + test files
