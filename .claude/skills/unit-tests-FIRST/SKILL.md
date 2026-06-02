---
name: unit-tests-FIRST
description: Use when generating or reviewing unit tests to ensure they satisfy the FIRST principles (Fast, Independent, Repeatable, Self-validating, Timely). Required before writing test-report.md.
---

# Unit Tests — FIRST Principles

## Purpose

Apply this skill every time the **Unit Test Generator** writes tests for changed code.
Each generated test must satisfy all five FIRST criteria before it is included in the
test suite and referenced in `test-report.md`.

## Bug ID and File Paths

The pipeline runner passes a `<bug-id>` in the task prompt (e.g. `001-security-path-traversal`).
All paths are relative to the `homework-4/` project root.

| Role | Path |
|------|------|
| **Input — fix summary** | `context/bugs/<bug-id>/fix-summary.md` |
| **Input — changed source** | files listed in `fix-summary.md` |
| **Output — test file** | `tests/test_<bug_id>.py` (hyphens replaced with underscores) |
| **Output — report** | `context/bugs/<bug-id>/test-report.md` |

Example: for `<bug-id>` = `001-security-path-traversal`, the test file is
`tests/test_001_security_path_traversal.py`.

## Project Setup — `tests/conftest.py`

Create or update `tests/conftest.py` with the following content before writing any tests.
It handles both the import path and the per-test vault isolation in one place:

```python
# tests/conftest.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest
from fastapi.testclient import TestClient
from app import storage
from app.main import app

_ORIGINAL_BASE_DIR = storage.BASE_DIR

@pytest.fixture
def client(tmp_path):
    storage.BASE_DIR = tmp_path / "vault"
    storage.BASE_DIR.mkdir()
    yield TestClient(app)
    storage.BASE_DIR = _ORIGINAL_BASE_DIR  # restore after each test
```

Every test file that needs a client simply declares `def test_foo(client):` — pytest
injects this fixture automatically.

## The Five Principles

### F — Fast

Tests must run in milliseconds. Slow tests are skipped under time pressure, defeating the
purpose.

**For this app (FastAPI + pytest):**
- Use `fastapi.testclient.TestClient` — it runs the app in-process with no real network I/O.
- No `time.sleep()` or polling loops in tests.
- No real file-system writes to slow paths; the `client` fixture from `conftest.py` handles
  isolation via `tmp_path`.

```python
# DO
def test_read_missing(client):
    response = client.get("/holocron/does-not-exist")
    assert response.status_code == 404

# DON'T
import time, requests
time.sleep(1)
response = requests.get("http://localhost:8000/holocron/does-not-exist")
```

### I — Independent

Every test must set up its own state and leave no side effects. Tests must be runnable
in any order and individually.

**For this app:**
- Each test gets a fresh, empty vault via the `client` fixture — never rely on a holocron
  written by a previous test.
- No shared module-level state that one test mutates and another reads.

```python
# DO — each test gets its own tmp vault via the fixture
def test_read_missing(client):
    response = client.get("/holocron/does-not-exist")
    assert response.status_code == 404

# DON'T — assumes a previous test created "yoda-wisdom"
def test_read_existing():
    response = client.get("/holocron/yoda-wisdom")
    assert response.status_code == 200
```

### R — Repeatable

Tests must produce the same result on every run, on any machine, in any order.

**For this app (filesystem-backed vault):**
The `client` fixture in `conftest.py` overrides `storage.BASE_DIR` with a fresh `tmp_path`
directory for each test and restores the original value afterward. This guarantees a clean
slate every run without relying on any pre-existing file system state.

- Never hardcode paths like `/tmp/vault` or `./vault` in tests.
- Do not depend on environment variables or external services.

### S — Self-validating

Each test must have an explicit assertion that unambiguously determines pass or fail.
A test that prints output but has no assert is not a test.

**For this app:**
- Assert both the HTTP status code **and** the response body for every test.
- Use specific `==` comparisons, not just `assert response`.

```python
# DO
def test_store_returns_201(client):
    response = client.post("/holocron", json={"name": "obi-wan", "body": "These are not the droids."})
    assert response.status_code == 201
    assert response.json()["status"] == "stored"

# DON'T
def test_store(client):
    response = client.post("/holocron", json={"name": "obi-wan", "body": "..."})
    print(response.json())  # no assertion — always passes
```

### T — Timely

The standard meaning of Timely is "written alongside the code" (TDD style). In this
pipeline context, the Unit Test Generator runs *after* the Bug Fixer, so tests are written
immediately after each fix is applied — as close to TDD as the pipeline allows.

**Adapted rule:** Tests must target the **changed** code identified in `fix-summary.md`.
Do not write tests for code that was not touched by the pipeline fixes; focus on the three
fixed defects:

1. **Path traversal fix** — test that a `name` with `../` is rejected with 400.
2. **Missing-404 fix** — test that `GET /holocron/{missing}` returns 404, not 500.
3. **Silent-overwrite fix** — test that a second `POST` with the same name returns 409.

Generate at least one happy-path and one error-path test per fix.

## Pre-submission Checklist

Before writing `context/bugs/<bug-id>/test-report.md`, tick every item:

- [ ] `tests/conftest.py` exists with both the `sys.path` fix and the `client` fixture.
- [ ] Test file written to `tests/test_<bug_id>.py` (hyphens → underscores).
- [ ] All tests use the `client` fixture (no live server, no `requests`).
- [ ] No test depends on state created by another test.
- [ ] Every test has at least one `assert` on `status_code` and one on the response body.
- [ ] Tests cover all three fixes from `fix-summary.md` (path traversal, 404, 409).
- [ ] `uv run pytest` passes with exit code 0.
- [ ] Test names describe the scenario, e.g. `test_traversal_name_rejected_with_400`.
