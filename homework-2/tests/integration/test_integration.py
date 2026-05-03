"""End-to-end integration tests — Task 5.

Five workflow tests covering:
1. Complete ticket lifecycle (create → read → update → classify → read log → delete → 404)
2. Bulk CSV import followed by auto-classification on every imported ticket
3. 20 concurrent creates (ThreadPoolExecutor, sync TestClient)
4. Combined category+priority filter intersection correctness
5. Import from multiple formats then status filter workflow
"""
from __future__ import annotations

import io
import json
import pathlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from fastapi.testclient import TestClient

FIXTURES = pathlib.Path(__file__).parent.parent / "fixtures"

VALID_TICKET = {
    "customer_id": "cust-001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Test subject",
    "description": "This description is long enough to pass validation rules.",
}


# ---------------------------------------------------------------------------
# Test 1: Complete ticket lifecycle
# ---------------------------------------------------------------------------

def test_complete_ticket_lifecycle(client: TestClient):
    """Complete ticket lifecycle: create → read → update → auto-classify →
    read classifications → delete → confirm gone.

    Ref: task1-design.md §1.2–1.6; task2-design.md §2.3–2.4.
    """
    # --- CREATE ---
    r = client.post("/tickets", json=VALID_TICKET)
    assert r.status_code == 201
    body = r.json()
    ticket_id = body["id"]
    created_at = body["created_at"]
    assert body["customer_id"] == VALID_TICKET["customer_id"]
    assert body["status"] == "new"

    # --- READ ---
    r = client.get(f"/tickets/{ticket_id}")
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["id"] == ticket_id
    assert fetched["customer_email"] == VALID_TICKET["customer_email"]
    assert fetched["customer_name"] == VALID_TICKET["customer_name"]
    assert fetched["subject"] == VALID_TICKET["subject"]

    # --- UPDATE ---
    r = client.put(f"/tickets/{ticket_id}", json={"status": "in_progress"})
    assert r.status_code == 200
    updated = r.json()
    assert updated["status"] == "in_progress"
    # updated_at must be >= created_at (may be equal if clock resolution is coarse,
    # but it must never be earlier)
    assert updated["updated_at"] >= created_at

    # --- AUTO-CLASSIFY ---
    r = client.post(f"/tickets/{ticket_id}/auto-classify")
    assert r.status_code == 200
    result = r.json()
    assert "ticket_id" in result
    assert "category" in result
    assert "priority" in result
    assert "confidence" in result
    assert "reasoning" in result
    assert "keywords_found" in result
    assert 0.0 <= result["confidence"] <= 1.0

    # --- READ CLASSIFICATIONS ---
    r = client.get(f"/tickets/{ticket_id}/classifications")
    assert r.status_code == 200
    classifications = r.json()
    assert len(classifications) == 1
    assert classifications[0]["ticket_id"] == ticket_id

    # --- DELETE ---
    r = client.delete(f"/tickets/{ticket_id}")
    assert r.status_code == 204

    # --- CONFIRM GONE ---
    r = client.get(f"/tickets/{ticket_id}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Test 2: Bulk CSV import with auto-classification
# ---------------------------------------------------------------------------

def test_bulk_import_with_auto_classification(client: TestClient):
    """Bulk CSV import followed by auto-classification on all imported tickets.

    - Import 3-row inline CSV → successful == 3
    - GET /tickets → 3 tickets present
    - POST auto-classify on each → 200
    - GET /tickets → all have non-None category and priority
    - GET classifications for first ticket → exactly 1 entry

    Ref: task1-design.md §2 (import); task2-design.md §2.3.
    """
    csv_bytes = (
        b"customer_id,customer_email,customer_name,subject,description\n"
        b"bulk-001,bulk1@example.com,Bulk One,Critical login failure,"
        b"Cannot access my account and production is completely down.\n"
        b"bulk-002,bulk2@example.com,Bulk Two,Invoice payment issue,"
        b"I need a refund for a double charge on my billing subscription.\n"
        b"bulk-003,bulk3@example.com,Bulk Three,Feature suggestion,"
        b"Would like to add dark mode as a minor cosmetic enhancement please.\n"
    )

    r = client.post(
        "/tickets/import",
        files={"file": ("bulk.csv", csv_bytes, "text/csv")},
    )
    assert r.status_code == 200
    summary = r.json()
    assert summary["successful"] == 3

    # All 3 tickets must appear in the listing
    r = client.get("/tickets")
    assert r.status_code == 200
    all_tickets = r.json()
    assert len(all_tickets) == 3

    # Auto-classify every imported ticket
    for ticket in all_tickets:
        tid = ticket["id"]
        r = client.post(f"/tickets/{tid}/auto-classify")
        assert r.status_code == 200

    # After classification every ticket must have category and priority populated
    r = client.get("/tickets")
    assert r.status_code == 200
    classified = r.json()
    for ticket in classified:
        assert ticket["category"] is not None, f"ticket {ticket['id']} missing category"
        assert ticket["priority"] is not None, f"ticket {ticket['id']} missing priority"

    # Classification log for the first ticket must have exactly one entry
    first_id = all_tickets[0]["id"]
    r = client.get(f"/tickets/{first_id}/classifications")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1


# ---------------------------------------------------------------------------
# Test 3: 20 concurrent creates
# ---------------------------------------------------------------------------

def test_concurrent_creates(client: TestClient):
    """20 simultaneous ticket creates must all succeed with 201.

    Uses ThreadPoolExecutor — TestClient is sync so asyncio is not needed.
    After all creates, exactly 20 tickets must be in the store.

    Ref: TASKS.md Task 5 — Concurrent operations (20+ simultaneous requests).
    """
    def create_one(i: int) -> int:
        payload = {
            "customer_id": f"cust-{i:04d}",
            "customer_email": f"user{i}@example.com",
            "customer_name": f"User {i}",
            "subject": f"Concurrent ticket {i}",
            "description": f"This is concurrent test ticket number {i} for load testing.",
        }
        r = client.post("/tickets", json=payload)
        return r.status_code

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(create_one, i) for i in range(20)]
        results = [f.result() for f in as_completed(futures)]

    assert all(s == 201 for s in results), f"Some creates failed: {results}"

    all_tickets = client.get("/tickets").json()
    assert len(all_tickets) == 20


# ---------------------------------------------------------------------------
# Test 4: Combined category + priority filter
# ---------------------------------------------------------------------------

def test_combined_category_priority_filter(client: TestClient):
    """Combined filtering by category AND priority returns correct intersection.

    Creates 4 tickets with distinct (category, priority) pairs via POST + PUT,
    then verifies the three filter combinations return the expected counts.

    Ref: task1-design.md §1.3 — filters compose with AND semantics.
    """
    def make_ticket(i: int, customer_email: str) -> str:
        payload = {
            "customer_id": f"cust-{i:03d}",
            "customer_email": customer_email,
            "customer_name": f"Customer {i}",
            "subject": f"Subject for ticket {i}",
            "description": f"This is a sufficiently long description for ticket number {i}.",
        }
        r = client.post("/tickets", json=payload)
        assert r.status_code == 201
        return r.json()["id"]

    # ticket A: account_access + high
    tid_a = make_ticket(1, "a@example.com")
    client.put(f"/tickets/{tid_a}", json={"category": "account_access", "priority": "high"})

    # ticket B: account_access + low
    tid_b = make_ticket(2, "b@example.com")
    client.put(f"/tickets/{tid_b}", json={"category": "account_access", "priority": "low"})

    # ticket C: billing_question + high
    tid_c = make_ticket(3, "c@example.com")
    client.put(f"/tickets/{tid_c}", json={"category": "billing_question", "priority": "high"})

    # ticket D: billing_question + low
    tid_d = make_ticket(4, "d@example.com")
    client.put(f"/tickets/{tid_d}", json={"category": "billing_question", "priority": "low"})

    # category=account_access AND priority=high → exactly 1 ticket (A)
    r = client.get("/tickets", params={"category": "account_access", "priority": "high"})
    assert r.status_code == 200
    hits = r.json()
    assert len(hits) == 1
    assert hits[0]["id"] == tid_a

    # category=billing_question → exactly 2 tickets (C and D)
    r = client.get("/tickets", params={"category": "billing_question"})
    assert r.status_code == 200
    hits = r.json()
    assert len(hits) == 2
    ids = {t["id"] for t in hits}
    assert ids == {tid_c, tid_d}

    # priority=low → exactly 2 tickets (B and D)
    r = client.get("/tickets", params={"priority": "low"})
    assert r.status_code == 200
    hits = r.json()
    assert len(hits) == 2
    ids = {t["id"] for t in hits}
    assert ids == {tid_b, tid_d}


# ---------------------------------------------------------------------------
# Test 5: Import from multiple formats, then filter by status
# ---------------------------------------------------------------------------

def test_import_and_filter_workflow(client: TestClient):
    """Import from CSV, JSON, and XML fixtures; then filter by status.

    - Import valid_tickets.csv (2 rows) → successful=2
    - Import valid_tickets.json (2 rows) → successful=2
    - Import valid_tickets.xml (2 rows) → successful=2
    - GET /tickets → 6 total
    - PUT first 2 tickets (from CSV) to status=resolved
    - GET /tickets?status=resolved → exactly 2
    - GET /tickets?status=new → exactly 4

    Ref: task1-design.md §2, §1.3; fixture files in tests/fixtures/.
    """
    # --- Import CSV ---
    with open(FIXTURES / "valid_tickets.csv", "rb") as f:
        r = client.post(
            "/tickets/import",
            files={"file": ("valid_tickets.csv", f, "text/csv")},
        )
    assert r.status_code == 200
    assert r.json()["successful"] == 2

    # --- Import JSON ---
    with open(FIXTURES / "valid_tickets.json", "rb") as f:
        r = client.post(
            "/tickets/import",
            files={"file": ("valid_tickets.json", f, "application/json")},
        )
    assert r.status_code == 200
    assert r.json()["successful"] == 2

    # --- Import XML ---
    with open(FIXTURES / "valid_tickets.xml", "rb") as f:
        r = client.post(
            "/tickets/import",
            files={"file": ("valid_tickets.xml", f, "application/xml")},
        )
    assert r.status_code == 200
    assert r.json()["successful"] == 2

    # --- Verify total ---
    r = client.get("/tickets")
    assert r.status_code == 200
    all_tickets = r.json()
    assert len(all_tickets) == 6

    # --- Resolve the first 2 tickets (those imported from CSV, insertion order) ---
    first_two_ids = [all_tickets[0]["id"], all_tickets[1]["id"]]
    for tid in first_two_ids:
        r = client.put(f"/tickets/{tid}", json={"status": "resolved"})
        assert r.status_code == 200

    # --- Filter: status=resolved → exactly 2 ---
    r = client.get("/tickets", params={"status": "resolved"})
    assert r.status_code == 200
    resolved = r.json()
    assert len(resolved) == 2
    assert {t["id"] for t in resolved} == set(first_two_ids)

    # --- Filter: status=new → exactly 4 ---
    r = client.get("/tickets", params={"status": "new"})
    assert r.status_code == 200
    new_tickets = r.json()
    assert len(new_tickets) == 4
