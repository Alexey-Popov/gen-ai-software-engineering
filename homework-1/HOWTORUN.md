# ▶️ How to Run the application

## Requirements

- Python 3.9+

## 1. Set up and start the API

```bash
cd homework-1
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 3000
```

Or simply run the demo script, which does all of the above:

```bash
./demo/run.sh
```

The API is now available at `http://localhost:3000`, with interactive docs at `http://localhost:3000/docs`.

## 2. Try it out

```bash
./demo/sample-requests.sh          # curl walkthrough of every endpoint
# or, with a REST client (VS Code REST Client, JetBrains HTTP client, etc.)
# open demo/sample-requests.http and run requests individually
```

Load the bundled sample dataset into a running server:

```bash
./demo/load-sample-data.sh
```

## 3. Run the test suite

```bash
source .venv/bin/activate
pytest -v
```

32 tests should pass, covering the core endpoints, validation rules, filtering, balance/summary calculations, and rate limiting.
