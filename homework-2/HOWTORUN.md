# How to Run the Application

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — install with:
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
  After install, restart your shell or run `source ~/.zshrc` (or your shell's rc file) so `uv` is on `PATH`. Verify with `uv --version`.

## Quick Start

```bash
cd homework-2
bash demo/run.sh
```

The server starts at **http://localhost:3000**. Interactive API docs at **http://localhost:3000/docs**.

## Manual Start

```bash
cd homework-2
uv sync                   # install dependencies into .venv
PYTHONPATH=src uv run uvicorn app.main:app --port 3000 --reload
```

The server runs at **http://localhost:3000** with auto-reload enabled for development.

## Running Tests

```bash
cd homework-2
uv run pytest -v                              # all tests
uv run pytest tests/unit -v                   # unit tests only
uv run pytest tests/integration -v            # integration tests only
uv run pytest --cov=app --cov-report=term-missing   # with coverage summary
```

Expected: **100 passed**, 0 failed — **98% line coverage** (460 statements, 11 missed).  
Coverage screenshot: `docs/screenshots/test_coverage.png`.

### Troubleshooting: readline segfault on macOS

On some macOS builds of Python 3.11 the system `readline` module (backed by Apple's
`libedit`) crashes at import time, which kills pytest at startup with exit code 139.
This is a Python environment issue unrelated to the project's test code. Try these in
order until one works:

```bash
# Option A — suppress terminal readline initialisation
TERM=dumb uv run pytest -p no:terminal -q --tb=short

# Option B — run via the module path (skips the pytest entry-point wrapper)
TERM=dumb uv run python -m pytest -q --tb=short

# Option C — Docker (fully isolated, guaranteed clean Python)
docker build -t hw2-tests .
docker run --rm hw2-tests
```

The screenshot at `docs/screenshots/test_coverage.png` shows the 98% HTML report from
a successful run on the author's machine (macOS, Python 3.11.4, uv 0.6.x).

## Running Tests with HTML Coverage Report

```bash
cd homework-2
uv run pytest --cov=app --cov-report=html
open htmlcov/index.html
```

This generates an interactive HTML coverage report in `htmlcov/index.html` showing line-by-line coverage per module.

## Sample Requests

Keep the server running in the first terminal (Manual Start above), then open a **second terminal** for the requests below. The curl commands hit `http://localhost:3000` directly and work from any directory.

Open `demo/sample-requests.http` in VS Code (REST Client extension) or JetBrains IDE.

Or use curl:

```bash
# 1. Create a support ticket
curl -s -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_id": "CUST-1001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since yesterday morning.",
    "category": "account_access",
    "priority": "high",
    "tags": ["login", "urgent"],
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 120",
      "device_type": "desktop"
    }
  }' | python3 -m json.tool

# 2. List all tickets
curl -s http://localhost:3000/tickets | python3 -m json.tool

# 3. List tickets with filters (category + priority, AND semantics)
curl -s 'http://localhost:3000/tickets?category=account_access&priority=high' | python3 -m json.tool

# 4. List tickets filtered by status
curl -s 'http://localhost:3000/tickets?status=new' | python3 -m json.tool

# 5. Get a specific ticket by ID (replace the UUID with a real one from step 2)
curl -s http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  | python3 -m json.tool

# 6. Partial update — resolve a ticket (resolved_at is set automatically)
curl -s -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Content-Type: application/json' \
  -d '{"status": "resolved"}' | python3 -m json.tool

# 7. Partial update — change priority and assign an agent
curl -s -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Content-Type: application/json' \
  -d '{"priority": "urgent", "assigned_to": "agent-5"}' | python3 -m json.tool

# 8. Delete a ticket (returns 204 No Content with empty body)
curl -s -X DELETE http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000

# 9. Bulk import from CSV (format detected from filename suffix)
curl -s -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.csv" | python3 -m json.tool

# 10. Bulk import from JSON with explicit format override
curl -s -X POST 'http://localhost:3000/tickets/import?format=json' \
  -F "file=@demo/sample_tickets.json" | python3 -m json.tool

# 11. Bulk import from XML (format detected from filename suffix)
curl -s -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.xml" | python3 -m json.tool
```

For complete request/response schemas, error handling, and detailed examples, see **[API_REFERENCE.md](./API_REFERENCE.md)**.

## Environment

No environment variables or external services required. Storage is in-memory and resets on server restart.

The `PYTHONPATH=src` environment variable is set automatically by `pyproject.toml` for pytest; when running `uv run`, it is already available in the virtual environment context.
