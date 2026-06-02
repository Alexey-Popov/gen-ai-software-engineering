# Bug Context — SECURITY-001: Write Path Traversal

| Field | Detail |
|-------|--------|
| **Type** | Security — Path Traversal / Arbitrary File Write (CWE-22) |
| **Severity** | CRITICAL |
| **File** | `src/app/storage.py` line 12, `src/app/main.py` line 20 |

## Description

The `name` field from the POST body is joined directly onto `BASE_DIR` without verifying
that the resolved path stays inside the vault directory. An attacker can write files
anywhere the process has write permission.

## Root Cause

```python
# src/app/storage.py
def write_holocron(name: str, body: str) -> None:
    path = BASE_DIR / name   # name is attacker-controlled; no confinement to BASE_DIR
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)    # writes to arbitrary path on disk
```

## Expected Behaviour

Names containing `..` or absolute paths are rejected with `400 Bad Request`.

## Actual Behaviour

`POST /holocron` with `name: "../pwned.txt"` creates a file **outside** the vault directory.

## Repro

```bash
curl -X POST http://localhost:8000/holocron \
  -H 'Content-Type: application/json' \
  -d '{"name": "../pwned.txt", "body": "I escaped the vault! Palpatine was right."}'
# 201 Created

ls -la pwned.txt   # file exists OUTSIDE vault/, in the working directory
cat pwned.txt      # I escaped the vault! Palpatine was right.
```

## Fix Direction

In `storage.py`, resolve both `BASE_DIR` and the joined path and assert the result is
still under the vault:

```python
resolved = (BASE_DIR / name).resolve()
if not resolved.is_relative_to(BASE_DIR.resolve()):
    raise ValueError("Path escapes vault")
```

Raise `HTTPException(status_code=400)` in the route handler when `ValueError` is caught.
