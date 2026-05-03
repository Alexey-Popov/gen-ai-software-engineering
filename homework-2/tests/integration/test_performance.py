"""Performance benchmark tests — Task 5.

Five benchmarks measured with time.perf_counter():
1. Import 50-row CSV from demo/sample_tickets.csv < 500ms
2. List 1000 tickets inserted directly into the store < 200ms
3. Classify a single ticket < 50ms
4. 20 concurrent creates complete in < 2s total
5. Import 30-row XML from demo/sample_tickets.xml < 750ms
"""
from __future__ import annotations

import pathlib
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

FIXTURES = pathlib.Path(__file__).parent.parent / "fixtures"
DEMO = pathlib.Path(__file__).parent.parent.parent / "demo"


# ---------------------------------------------------------------------------
# Benchmark 1: Import 50-row CSV < 500ms
# ---------------------------------------------------------------------------

def test_import_50_csv_rows_under_500ms(client: TestClient):
    """POST /tickets/import with the 50-row demo CSV must complete in < 500ms.

    Ref: TASKS.md Task 5 performance benchmarks; demo/sample_tickets.csv (50 rows).
    """
    csv_path = DEMO / "sample_tickets.csv"
    with open(csv_path, "rb") as f:
        data = f.read()

    start = time.perf_counter()
    r = client.post(
        "/tickets/import",
        files={"file": ("sample_tickets.csv", data, "text/csv")},
    )
    elapsed = time.perf_counter() - start

    assert r.status_code == 200
    assert r.json()["successful"] == 50
    assert elapsed < 0.5, f"CSV import took {elapsed:.3f}s, expected < 0.5s"


# ---------------------------------------------------------------------------
# Benchmark 2: List 1000 tickets < 200ms
# ---------------------------------------------------------------------------

def test_list_1000_tickets_under_200ms(client: TestClient, fresh_store):
    """GET /tickets with 1000 tickets pre-loaded via store.insert() must return in < 200ms.

    Tickets are inserted directly into the store (bypassing HTTP) to keep
    setup time out of the benchmark window.

    Ref: TASKS.md Task 5 performance benchmarks.
    """
    from app.domain.models import Ticket

    for i in range(1000):
        t = Ticket(
            customer_id=f"cust-{i}",
            customer_email=f"u{i}@example.com",
            customer_name=f"User {i}",
            subject=f"Subject {i}",
            description=f"Description number {i} is long enough",
        )
        fresh_store.insert(t)

    start = time.perf_counter()
    r = client.get("/tickets")
    elapsed = time.perf_counter() - start

    assert r.status_code == 200
    assert len(r.json()) == 1000
    assert elapsed < 0.2, f"List 1000 tickets took {elapsed:.3f}s, expected < 0.2s"


# ---------------------------------------------------------------------------
# Benchmark 3: Classify single ticket < 50ms
# ---------------------------------------------------------------------------

def test_classify_single_ticket_under_50ms(client: TestClient):
    """POST /tickets/{id}/auto-classify must complete in < 50ms.

    Uses a subject/description with clear urgent + account_access keywords
    so the rule engine has something concrete to match.

    Ref: TASKS.md Task 5 performance benchmarks; task2-design.md §1 (pure function).
    """
    payload = {
        "customer_id": "cust-perf",
        "customer_email": "perf@example.com",
        "customer_name": "Perf Test",
        "subject": "Critical login failure blocking production",
        "description": "Cannot access account, security issue, production down.",
    }
    tid = client.post("/tickets", json=payload).json()["id"]

    start = time.perf_counter()
    r = client.post(f"/tickets/{tid}/auto-classify")
    elapsed = time.perf_counter() - start

    assert r.status_code == 200
    assert elapsed < 0.05, f"Classify took {elapsed:.3f}s, expected < 0.05s"


# ---------------------------------------------------------------------------
# Benchmark 4: 20 concurrent creates < 2s total
# ---------------------------------------------------------------------------

def test_concurrent_20_creates_under_2s(client: TestClient):
    """20 simultaneous POST /tickets requests must all return 201 within 2s wall time.

    ThreadPoolExecutor is used because TestClient is synchronous.

    Ref: TASKS.md Task 5 performance benchmarks.
    """
    def create_one(i: int) -> int:
        return client.post("/tickets", json={
            "customer_id": f"cust-{i}",
            "customer_email": f"u{i}@perf.com",
            "customer_name": f"User {i}",
            "subject": f"Performance ticket {i}",
            "description": f"This is performance test ticket number {i} for concurrency testing.",
        }).status_code

    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=20) as ex:
        results = list(ex.map(create_one, range(20)))
    elapsed = time.perf_counter() - start

    assert all(s == 201 for s in results), f"Some creates failed: {results}"
    assert elapsed < 2.0, f"20 concurrent creates took {elapsed:.3f}s, expected < 2.0s"


# ---------------------------------------------------------------------------
# Benchmark 5: Import 30-row XML < 750ms
# ---------------------------------------------------------------------------

def test_import_30_xml_rows_under_750ms(client: TestClient):
    """POST /tickets/import with the 30-ticket demo XML must complete in < 750ms.

    Ref: TASKS.md Task 5 performance benchmarks; demo/sample_tickets.xml (30 tickets).
    """
    xml_path = DEMO / "sample_tickets.xml"
    with open(xml_path, "rb") as f:
        data = f.read()

    start = time.perf_counter()
    r = client.post(
        "/tickets/import",
        files={"file": ("sample_tickets.xml", data, "application/xml")},
    )
    elapsed = time.perf_counter() - start

    assert r.status_code == 200
    assert r.json()["successful"] == 30
    assert elapsed < 0.75, f"XML import took {elapsed:.3f}s, expected < 0.75s"
