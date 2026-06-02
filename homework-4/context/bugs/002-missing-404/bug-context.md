# Bug Context — BUG-001: Missing Holocron Returns 500 Instead of 404

| Field | Detail |
|-------|--------|
| **Type** | Error handling bug |
| **Severity** | HIGH |
| **File** | `src/app/storage.py` line 8, `src/app/main.py` line 27 |

## Description

When a client requests a holocron that does not exist, the API crashes with a 500
Internal Server Error instead of returning a proper 404 Not Found response.

## Root Cause

```python
# src/app/storage.py
def read_holocron(name: str) -> str:
    path = BASE_DIR / name
    return path.read_text()   # raises FileNotFoundError if absent — unhandled
```

`FileNotFoundError` propagates through FastAPI as an unhandled exception → HTTP 500.

## Expected Behaviour

`GET /holocron/obi-wan-notes` for a non-existent holocron → `404 Not Found`.

## Actual Behaviour

Returns `500 Internal Server Error` with a stack trace in server logs.

## Repro

```bash
curl -i http://localhost:8000/holocron/obi-wan-notes
# HTTP/1.1 500 Internal Server Error
```

## Fix Direction

Catch `FileNotFoundError` in the route handler and raise a proper HTTP exception:

```python
from fastapi import HTTPException

@app.get("/holocron/{name}")
def read(name: str):
    try:
        return {"name": name, "body": storage.read_holocron(name)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Holocron not found")
```
