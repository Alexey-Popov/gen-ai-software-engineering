# 🐍 Banking API — Python + FastAPI (alternative backend)

A third implementation of the Banking Transactions API, in **Python + FastAPI**, built from the
same plan as the Java/Go versions and exposing the **same HTTP contract on port 3000** — so the
Angular frontend works against it unchanged.

> Java (primary) is in [`../backend/`](../backend); Go is in [`../backend-go/`](../backend-go).

## Prerequisites

- **Python 3.10+**

## Setup & run

```bash
cd homework-1/backend-fastapi
python3 -m venv .venv && source .venv/bin/activate   # recommended
pip install -r requirements.txt
uvicorn app.main:app --port 3000 --reload            # API on http://localhost:3000
```

## Test

```bash
pytest -q        # 32 tests
```

## Health & API reference (native)

FastAPI generates interactive docs automatically — no extra tooling needed:

- **Swagger UI:** http://localhost:3000/docs
- **ReDoc:** http://localhost:3000/redoc
- **OpenAPI spec:** http://localhost:3000/openapi.json
- **Health:** http://localhost:3000/actuator/health → `{"status":"UP"}`

## Design notes

- **Framework:** FastAPI (+ Starlette); Pydantic v2 models drive validation and the auto OpenAPI.
- **Money:** `decimal.Decimal` internally (never float); serialized to JSON numbers via a Pydantic
  `PlainSerializer`.
- **Validation:** Pydantic constraints (account pattern, positive amount ≤2 decimals, ISO 4217
  currency set, type enum); a `RequestValidationError` handler maps failures to the shared
  `400 {error:"Validation failed", details:[{field,message}]}` shape.
- **Storage:** in-memory `dict` guarded by a `threading.Lock` (no database).
- **Rate limiting:** per-IP fixed-window `BaseHTTPMiddleware` → `429`.
- **Tests:** `pytest` + FastAPI `TestClient`, added across the same 9 feature areas as the other
  backends (transactions, validation, accounts, filtering, export, rate limit, integration, meta).

## Endpoints

Same contract as the other backends: `POST/GET /transactions`, `GET /transactions/{id}`,
`GET /transactions/export?format=csv`, `GET /accounts/{id}/balance|summary|interest`,
`GET /actuator/health`.
