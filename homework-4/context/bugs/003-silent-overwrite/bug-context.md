# Bug Context — BUG-002: Silent Overwrite of Existing Holocron (No 409)

| Field | Detail |
|-------|--------|
| **Type** | Data integrity bug |
| **Severity** | MEDIUM |
| **File** | `src/app/main.py` lines 17-21, `src/app/storage.py` line 12 |

## Description

Creating a holocron with a name that already exists silently overwrites the existing
content instead of rejecting the request. Sacred Jedi knowledge can be lost without
any warning.

## Root Cause

```python
# src/app/main.py — no existence check before writing
storage.write_holocron(holocron.name, holocron.body)
```

`write_text()` unconditionally overwrites any existing file.

## Expected Behaviour

`POST /holocron` when a holocron with that name already exists →
`409 Conflict` with an explanatory message.

## Actual Behaviour

Second POST returns `201 Created` and silently overwrites the holocron.

## Repro

```bash
curl -X POST http://localhost:8000/holocron \
  -H 'Content-Type: application/json' \
  -d '{"name": "yoda-wisdom", "body": "Do or do not."}'
# 201 Created

curl -X POST http://localhost:8000/holocron \
  -H 'Content-Type: application/json' \
  -d '{"name": "yoda-wisdom", "body": "There is no try."}'
# 201 Created  <-- should be 409 Conflict; original wisdom is gone
```

## Fix Direction

Check existence before writing and return 409 if the holocron already exists:

```python
if storage.holocron_exists(holocron.name):
    raise HTTPException(
        status_code=409,
        detail="Holocron already exists. The Force does not allow overwriting."
    )
storage.write_holocron(holocron.name, holocron.body)
```
