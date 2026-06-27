# How to Run

## Prerequisites

- Python 3.11 or newer — check with `python3 --version`
- pip — check with `pip --version`

---

## 1. Install dependencies

```bash
cd homework-1
pip install -r requirements.txt
```

---

## 2. Start the server

```bash
python3 -m uvicorn src.app:app --reload
```

The API runs at **http://localhost:8000**

---

## 3. Explore the API in your browser

Open **http://localhost:8000/docs**

The Swagger UI lists all endpoints. Use **"Try it out"** on any endpoint to send requests and see responses directly in the browser — no extra tools needed.

---

## 4. Run the automated tests

In a separate terminal (while the server is stopped or running — tests use the app directly):

```bash
pytest tests/
```

All tests should pass.

---

## 5. Use sample requests (optional)

The file `demo/sample-requests.http` contains ready-made requests for every endpoint and filter combination. Open it in VS Code with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension installed, then click "Send Request" above any block.

---

## One-command startup (alternative)

```bash
bash demo/run.sh
```

This installs dependencies and starts the server in one step.

---

## Available endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/transactions` | Create a transaction |
| `GET` | `/transactions` | List transactions (with optional filters) |
| `GET` | `/transactions/{id}` | Get transaction by ID |
| `GET` | `/accounts/{id}/balance` | Get account balance |
| `GET` | `/accounts/{id}/summary` | Get account summary |

### Filter parameters for `GET /transactions`

| Parameter | Example | Description |
|-----------|---------|-------------|
| `accountId` | `ACC-12345` | Match fromAccount or toAccount |
| `type` | `deposit` | One of: deposit, withdrawal, transfer |
| `from` | `2024-01-01` | Start date (inclusive) |
| `to` | `2024-12-31` | End date (inclusive) |

Filters can be combined: `?accountId=ACC-12345&type=transfer&from=2024-01-01`
