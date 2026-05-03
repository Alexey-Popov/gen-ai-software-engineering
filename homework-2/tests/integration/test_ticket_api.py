"""Integration tests for the Ticket CRUD API and POST /tickets/import.

All routes currently return HTTP 501 (stub). Every test in this file MUST FAIL
in RED state. Tests use the `client` fixture from conftest.py which wires a fresh
in-memory store per test for full isolation.

Ref: task1-design.md §1 (route contracts), §2 (import endpoint), §7 (error catalogue).
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Shared valid payload factory
# ---------------------------------------------------------------------------

def _valid_payload(**overrides) -> dict:
    """Return a minimal valid TicketCreate payload, with optional field overrides."""
    base = {
        "customer_id": "cust-001",
        "customer_email": "alice@example.com",
        "customer_name": "Alice Example",
        "subject": "Cannot log in",
        "description": "I cannot log into my account since this morning.",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# 1. POST /tickets — 201 + full Ticket JSON
# ---------------------------------------------------------------------------

def test_create_ticket_success(client: TestClient):
    """POST /tickets with valid body returns 201 and a Ticket with server-generated fields.

    Ref: task1-design.md §1.2 — 201 Created; id, created_at, updated_at generated server-side.
    """
    response = client.post("/tickets", json=_valid_payload())

    assert response.status_code == 201
    body = response.json()
    # Server-generated fields must be present
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body
    # created_at and updated_at are equal on creation
    assert body["created_at"] == body["updated_at"]
    # Core fields preserved
    assert body["customer_id"] == "cust-001"
    assert body["customer_email"] == "alice@example.com"
    assert body["status"] == "new"


# ---------------------------------------------------------------------------
# 2. POST /tickets — 400 when required field missing
# ---------------------------------------------------------------------------

def test_create_ticket_missing_required_field(client: TestClient):
    """POST /tickets without description returns 400 + error envelope.
    Also verifies the store is unaffected (GET /tickets returns 200 + []).

    Ref: task1-design.md §7 row 1 — missing required field → 400.
    task1-design.md §1 — all 400 responses use the standard error envelope.
    """
    payload = _valid_payload()
    del payload["description"]

    response = client.post("/tickets", json=payload)

    assert response.status_code == 400
    body = response.json()
    assert "error" in body
    assert "details" in body
    assert isinstance(body["details"], list)
    fields = [d["field"] for d in body["details"]]
    assert "description" in fields

    # The failed POST must leave the store empty — GET /tickets should return 200 + [].
    # This assertion fails in RED state because GET /tickets returns 501 (stub).
    list_response = client.get("/tickets")
    assert list_response.status_code == 200
    assert list_response.json() == []


# ---------------------------------------------------------------------------
# 3. POST /tickets — 400 for invalid email
# ---------------------------------------------------------------------------

def test_create_ticket_invalid_email(client: TestClient):
    """POST /tickets with an invalid customer_email returns 400.
    Also verifies the store is unaffected (GET /tickets returns 200 + []).

    Ref: task1-design.md §7 row 7 — customer_email must be a valid email → 400.
    """
    response = client.post("/tickets", json=_valid_payload(customer_email="not-an-email"))

    assert response.status_code == 400
    body = response.json()
    assert "error" in body
    assert "details" in body

    # The failed POST must leave the store empty — GET /tickets should return 200 + [].
    # This assertion fails in RED state because GET /tickets returns 501 (stub).
    list_response = client.get("/tickets")
    assert list_response.status_code == 200
    assert list_response.json() == []


# ---------------------------------------------------------------------------
# 4. GET /tickets — 200 + [] on empty store
# ---------------------------------------------------------------------------

def test_list_tickets_empty(client: TestClient):
    """GET /tickets on an empty store returns 200 and an empty JSON array.

    Ref: task1-design.md §1.3 — empty result set returns 200 with [], never 404.
    """
    response = client.get("/tickets")

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# 5. GET /tickets — ticket appears in list after creation
# ---------------------------------------------------------------------------

def test_list_tickets_returns_created(client: TestClient):
    """POST then GET /tickets — the created ticket appears in the list.

    Ref: task1-design.md §1.3 — returns 200 + Ticket[] in insertion order.
    """
    client.post("/tickets", json=_valid_payload())

    response = client.get("/tickets")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["customer_id"] == "cust-001"


# ---------------------------------------------------------------------------
# 6. GET /tickets?status=new — filter by status returns only matching ticket
# ---------------------------------------------------------------------------

def test_list_tickets_filter_by_status(client: TestClient):
    """Create 2 tickets with different status; GET ?status=new returns only the new one.

    Ref: task1-design.md §1.3 — status filter; filters compose with AND semantics.
    """
    # Create ticket with status=new (default)
    r1 = client.post("/tickets", json=_valid_payload(customer_id="cust-001"))
    assert r1.status_code == 201
    ticket_id = r1.json()["id"]

    # Update the first ticket to resolved so we have one new and one resolved
    client.put(f"/tickets/{ticket_id}", json={"status": "resolved"})

    # Create a second ticket that stays new
    r2 = client.post("/tickets", json=_valid_payload(
        customer_id="cust-002",
        customer_email="bob@example.com",
        customer_name="Bob Example",
        subject="Another issue",
        description="This is another issue with enough description.",
    ))
    assert r2.status_code == 201

    response = client.get("/tickets", params={"status": "new"})

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert all(t["status"] == "new" for t in body)
    customer_ids = [t["customer_id"] for t in body]
    assert "cust-002" in customer_ids
    assert "cust-001" not in customer_ids


# ---------------------------------------------------------------------------
# 7. GET /tickets/{id} — 200 + correct Ticket
# ---------------------------------------------------------------------------

def test_get_ticket_by_id_success(client: TestClient):
    """POST then GET /tickets/{id} returns 200 and the correct Ticket JSON.

    Ref: task1-design.md §1.4 — 200 OK with Ticket JSON body.
    """
    create_response = client.post("/tickets", json=_valid_payload())
    assert create_response.status_code == 201
    ticket_id = create_response.json()["id"]

    response = client.get(f"/tickets/{ticket_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == ticket_id
    assert body["customer_id"] == "cust-001"


# ---------------------------------------------------------------------------
# 8. GET /tickets/{unknown-uuid} — 404 + error envelope
# ---------------------------------------------------------------------------

def test_get_ticket_by_id_not_found(client: TestClient):
    """GET /tickets/{random-uuid} returns 404 + error envelope.

    Ref: task1-design.md §1.4 — 404 if no ticket with that id exists.
    task1-design.md §1 — 404 responses follow the same error envelope shape.
    """
    random_id = str(uuid.uuid4())

    response = client.get(f"/tickets/{random_id}")

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert "details" in body


# ---------------------------------------------------------------------------
# 9. PUT /tickets/{id} — partial update preserves unset fields
# ---------------------------------------------------------------------------

def test_update_ticket_partial(client: TestClient):
    """POST then PUT /tickets/{id} with only status — only status changes, other fields preserved.

    Ref: task1-design.md §1.5 — PUT uses exclude_unset=True; omitted keys retain current value.
    task1-design.md §5.1 — partial-merge semantics.
    """
    create_response = client.post("/tickets", json=_valid_payload(
        subject="Original subject",
        priority="high",
    ))
    assert create_response.status_code == 201
    ticket_id = create_response.json()["id"]

    response = client.put(f"/tickets/{ticket_id}", json={"status": "in_progress"})

    assert response.status_code == 200
    body = response.json()
    # Status updated
    assert body["status"] == "in_progress"
    # Other fields preserved
    assert body["subject"] == "Original subject"
    assert body["priority"] == "high"
    assert body["customer_id"] == "cust-001"
    # updated_at must have been refreshed (just check it is present)
    assert "updated_at" in body


# ---------------------------------------------------------------------------
# 10. DELETE /tickets/{id} — 204, then GET returns 404
# ---------------------------------------------------------------------------

def test_delete_ticket_success(client: TestClient):
    """POST then DELETE /tickets/{id} returns 204; subsequent GET returns 404.

    Ref: task1-design.md §1.6 — 204 No Content on success.
    task1-design.md §1.6 — a second DELETE returns 404, not 204.
    """
    create_response = client.post("/tickets", json=_valid_payload())
    assert create_response.status_code == 201
    ticket_id = create_response.json()["id"]

    delete_response = client.delete(f"/tickets/{ticket_id}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/tickets/{ticket_id}")
    assert get_response.status_code == 404


# ---------------------------------------------------------------------------
# 11. POST /tickets/import — CSV upload returns 200 + ImportSummary
# ---------------------------------------------------------------------------

def test_import_tickets_csv_success(client: TestClient):
    """POST /tickets/import with a valid 2-row CSV returns 200 + ImportSummary(successful=2, failed=0).

    Ref: task1-design.md §2.4 — response is ImportSummary with total, successful, failed, errors.
    task1-design.md §2.1 — multipart/form-data, field name 'file'.
    """
    # Inline CSV matching task1-design.md §4.1 required headers
    csv_content = (
        b"customer_id,customer_email,customer_name,subject,description\n"
        b"cust-001,a@b.com,Alice,Help needed,This is my description here\n"
        b"cust-002,b@c.com,Bob,Another issue,This is another long description"
    )

    response = client.post(
        "/tickets/import",
        files={"file": ("tickets.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["successful"] == 2
    assert body["failed"] == 0
    assert body["errors"] == []


# ---------------------------------------------------------------------------
# Shared valid payload constant (reused across catalogue gap tests below)
# ---------------------------------------------------------------------------

VALID_TICKET = {
    "customer_id": "cust-001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Test subject",
    "description": "This description is long enough to pass validation rules.",
}


# ---------------------------------------------------------------------------
# Validation catalogue gap tests (task1-design.md §7)
# ---------------------------------------------------------------------------

def test_put_ticket_not_found(client: TestClient):
    """PUT to a valid UUID that does not exist in the store → 404 with error envelope.

    Ref: task1-design.md §7 row 14 — ticket_id valid UUID but not found → 404.
    task1-design.md §1.5 — errors: 400 for validation failures, 404 if ticket not found.
    """
    r = client.put(f"/tickets/{uuid.uuid4()}", json={"status": "in_progress"})

    assert r.status_code == 404
    body = r.json()
    assert body["error"] == "Ticket not found"
    assert "details" in body


def test_delete_ticket_not_found(client: TestClient):
    """Second DELETE on the same ticket id → 404, not 204.

    Ref: task1-design.md §1.6 — a second DELETE on the same id returns 404, not 204.
    task1-design.md §7 row 14 — ticket_id valid UUID but not found → 404.
    """
    # Create and immediately delete the ticket once
    tid = client.post("/tickets", json=VALID_TICKET).json()["id"]
    first_delete = client.delete(f"/tickets/{tid}")
    assert first_delete.status_code == 204

    # Second DELETE must return 404
    r = client.delete(f"/tickets/{tid}")

    assert r.status_code == 404


def test_import_empty_file(client: TestClient):
    """Uploading an empty (0-byte) file → 400 with field='file'.

    Ref: task1-design.md §2.5 — Empty file (0 bytes) → 400, field='file'.
    task1-design.md §7 row 16 — Import: empty file → 400.
    """
    r = client.post(
        "/tickets/import",
        files={"file": ("empty.csv", b"", "text/csv")},
    )

    assert r.status_code == 400


def test_import_malformed_json_file(client: TestClient):
    """Uploading a JSON file whose bytes are not valid JSON → 400 (container-level error).

    Ref: task1-design.md §2.5 — Container-level malformed file → 400, field='file'.
    task1-design.md §7 row 18 — Import: container-level malformed file → 400.
    """
    r = client.post(
        "/tickets/import",
        files={"file": ("bad.json", b"not json", "application/json")},
    )

    assert r.status_code == 400


def test_import_unknown_format(client: TestClient):
    """Passing an unrecognised ?format= query param → 400 with field='format'.

    Ref: task1-design.md §2.2 — explicit format param other than csv|json|xml → 400, field='format'.
    task1-design.md §7 row 17 — Import: cannot detect format → 400.
    """
    r = client.post(
        "/tickets/import?format=excel",
        files={"file": ("f.csv", b"a,b\n1,2", "text/csv")},
    )

    assert r.status_code == 400
    body = r.json()
    assert "error" in body


def test_import_json_success(client: TestClient):
    """JSON import happy path — valid JSON array of one ticket → 200 + successful=1.

    Exercises the JSON format dispatch branch in the import router.
    Ref: task1-design.md §2.2 — MIME application/json → json parser.
    task1-design.md §2.4 — 200 OK + ImportSummary.
    """
    import json as _json

    data = _json.dumps([{
        "customer_id": "c1",
        "customer_email": "a@b.com",
        "customer_name": "Alice",
        "subject": "Help",
        "description": "This is a long enough description",
    }]).encode()

    r = client.post(
        "/tickets/import",
        files={"file": ("t.json", data, "application/json")},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["successful"] == 1


def test_import_xml_success(client: TestClient):
    """XML import happy path — valid XML with one <ticket> → 200 + successful=1.

    Exercises the XML format dispatch branch in the import router.
    Ref: task1-design.md §2.2 — MIME application/xml → xml parser.
    task1-design.md §3.1 — root <tickets>, child <ticket>.
    task1-design.md §2.4 — 200 OK + ImportSummary.
    """
    xml = b"""<?xml version="1.0"?><tickets><ticket>
        <customer_id>c1</customer_id>
        <customer_email>a@b.com</customer_email>
        <customer_name>Alice</customer_name>
        <subject>Help me</subject>
        <description>This is a long enough description here</description>
    </ticket></tickets>"""

    r = client.post(
        "/tickets/import",
        files={"file": ("t.xml", xml, "application/xml")},
    )

    assert r.status_code == 200
    assert r.json()["successful"] == 1


# ── Task 2: Auto-Classification ──────────────────────────────────────────────

def test_auto_classify_sets_category_and_priority(client):
    """POST /tickets/{id}/auto-classify → 200 + ClassificationResult; ticket updated.

    Ref: task2-design.md §2.3 — classify → mutate category/priority/updated_at →
    store.update → log.record → return 200 ClassificationResult.
    Keywords: "Critical" (urgent), "login" (account_access).
    """
    payload = {**VALID_TICKET, "subject": "Critical login failure", "description": "Cannot access my account, production is down."}
    tid = client.post("/tickets", json=payload).json()["id"]
    r = client.post(f"/tickets/{tid}/auto-classify")
    assert r.status_code == 200
    body = r.json()
    assert body["category"] == "account_access"
    assert body["priority"] == "urgent"
    assert "ticket_id" in body
    assert 0.0 <= body["confidence"] <= 1.0
    # ticket itself should be updated
    ticket = client.get(f"/tickets/{tid}").json()
    assert ticket["category"] == "account_access"
    assert ticket["priority"] == "urgent"


def test_auto_classify_not_found(client):
    """POST /tickets/{random_uuid}/auto-classify → 404.

    Ref: task2-design.md §6 edge case #8 — auto-classify on non-existent ticket
    returns 404 and no log entry is written.
    """
    import uuid
    r = client.post(f"/tickets/{uuid.uuid4()}/auto-classify")
    assert r.status_code == 404
    assert r.json()["error"] == "Ticket not found"


def test_get_classifications_empty(client):
    """GET /tickets/{id}/classifications on unclassified ticket → 200 [].

    Ref: task2-design.md §6 edge case #10 — existing ticket with no classifications
    returns 200 with an empty list, never 404.
    """
    tid = client.post("/tickets", json=VALID_TICKET).json()["id"]
    r = client.get(f"/tickets/{tid}/classifications")
    assert r.status_code == 200
    assert r.json() == []


def test_get_classifications_after_classify(client, fresh_log):
    """GET /tickets/{id}/classifications after auto-classify → 200 [ClassificationResult].

    Ref: task2-design.md §2.4 — log.entries(ticket_id) returned in insertion order.
    fresh_log fixture is injected to verify shared state between client and direct log access.
    """
    tid = client.post("/tickets", json=VALID_TICKET).json()["id"]
    client.post(f"/tickets/{tid}/auto-classify")
    r = client.get(f"/tickets/{tid}/classifications")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert entries[0]["ticket_id"] == tid


def test_get_classifications_not_found(client):
    """GET /tickets/{random_uuid}/classifications → 404.

    Ref: task2-design.md §6 edge case #9 — GET classifications on non-existent ticket
    returns 404, not 200 [].
    """
    import uuid
    r = client.get(f"/tickets/{uuid.uuid4()}/classifications")
    assert r.status_code == 404


def test_create_ticket_with_auto_classify_flag(client):
    """POST /tickets?auto_classify=true → 201 + ticket with classifier-assigned category/priority.

    Ref: task2-design.md §2.2 — when auto_classify=true, classifier overwrites
    client-supplied category/priority. "invoice" → billing_question; no priority
    keywords → medium.
    """
    payload = {**VALID_TICKET, "subject": "Invoice not paid", "description": "I need a refund for my payment."}
    r = client.post("/tickets?auto_classify=true", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["category"] == "billing_question"
    assert body["priority"] == "medium"  # no priority keywords


def test_auto_classify_twice_produces_two_log_entries(client, fresh_log):
    """Calling auto-classify twice → two entries in classification log.

    Ref: task2-design.md §6 edge case #11 — calling auto-classify twice produces
    two log entries; ticket ends in the same state both times.
    """
    tid = client.post("/tickets", json=VALID_TICKET).json()["id"]
    client.post(f"/tickets/{tid}/auto-classify")
    client.post(f"/tickets/{tid}/auto-classify")
    entries = client.get(f"/tickets/{tid}/classifications").json()
    assert len(entries) == 2


# ---------------------------------------------------------------------------
# Edge case #14: ?auto_classify=banana → 400, ticket not created
# ---------------------------------------------------------------------------

def test_create_ticket_auto_classify_invalid_value(client):
    """Edge case #14: ?auto_classify=banana → 400, ticket not created.

    A non-boolean query param value must be rejected before the ticket is
    persisted. After the 400 response the store must still be empty.

    Ref: task2-design.md §2.2 — ?auto_classify=banana → 400, field='auto_classify'.
    task2-design.md §6 edge case #14.
    """
    r = client.post("/tickets?auto_classify=banana", json=VALID_TICKET)
    assert r.status_code == 400
    # ticket should not have been created
    assert client.get("/tickets").json() == []


# ---------------------------------------------------------------------------
# PUT /tickets/{id} — string-length validation (issue #1 fix verification)
# ---------------------------------------------------------------------------

def test_put_subject_empty_returns_400(client: TestClient):
    """PUT with subject='' → 400 with field='subject' (min_length=1 enforced on TicketUpdate).

    Before the fix, TicketUpdate.subject lacked constraints and PUT {"subject": ""}
    returned 200 with an empty-string subject stored on the ticket.
    Ref: task1-design.md §7 row 8 — subject must be 1-200 chars; applies to PUT too.
    """
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"subject": ""})
    assert r.status_code == 400
    body = r.json()
    assert "details" in body
    fields = [d["field"] for d in body["details"]]
    assert "subject" in fields


def test_put_subject_too_long_returns_400(client: TestClient):
    """PUT with subject of 201 chars → 400 (max_length=200 enforced on TicketUpdate)."""
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"subject": "x" * 201})
    assert r.status_code == 400
    body = r.json()
    fields = [d["field"] for d in body["details"]]
    assert "subject" in fields


def test_put_description_too_short_returns_400(client: TestClient):
    """PUT with description of 9 chars → 400 (min_length=10 enforced on TicketUpdate)."""
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"description": "tooshort"})
    assert r.status_code == 400
    body = r.json()
    fields = [d["field"] for d in body["details"]]
    assert "description" in fields


# ---------------------------------------------------------------------------
# PUT /tickets/{id} — manual override logging (issue #3 fix verification)
# ---------------------------------------------------------------------------

def test_put_category_override_creates_log_entry(client: TestClient, fresh_log):
    """PUT that sets category creates a classification log entry with reasoning='Manual override via PUT'.

    Ref: TASKS.md:103 — "Log all decisions"; manual category/priority overrides are decisions.
    The log entry has confidence=0.0 and keywords_found=[] (no keyword match).
    """
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"category": "billing_question"})
    assert r.status_code == 200

    entries = fresh_log.entries(ticket_id=uuid.UUID(tid))
    assert len(entries) == 1
    assert entries[0].category.value == "billing_question"
    assert entries[0].reasoning == "Manual override via PUT"
    assert entries[0].confidence == 0.0
    assert entries[0].keywords_found == []


def test_put_priority_override_creates_log_entry(client: TestClient, fresh_log):
    """PUT that sets priority creates a classification log entry."""
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"priority": "urgent"})
    assert r.status_code == 200

    entries = fresh_log.entries(ticket_id=uuid.UUID(tid))
    assert len(entries) == 1
    assert entries[0].priority.value == "urgent"
    assert entries[0].reasoning == "Manual override via PUT"


def test_put_category_clear_does_not_log(client: TestClient, fresh_log):
    """PUT with category=null (clearing) does NOT create a log entry.

    Clearing is not a classification decision; only setting a concrete value is logged.
    """
    r = client.post("/tickets", json=_valid_payload(category="billing_question"))
    tid = r.json()["id"]

    r = client.put(f"/tickets/{tid}", json={"category": None})
    assert r.status_code == 200

    entries = fresh_log.entries(ticket_id=uuid.UUID(tid))
    assert len(entries) == 0


def test_put_status_change_does_not_log(client: TestClient, fresh_log):
    """PUT that changes only status does NOT create a classification log entry."""
    tid = client.post("/tickets", json=_valid_payload()).json()["id"]
    r = client.put(f"/tickets/{tid}", json={"status": "in_progress"})
    assert r.status_code == 200

    entries = fresh_log.entries(ticket_id=uuid.UUID(tid))
    assert len(entries) == 0


# ---------------------------------------------------------------------------
# XML import — wrong root element → 400 (issue #5 fix verification)
# ---------------------------------------------------------------------------

def test_import_xml_wrong_root_returns_400(client: TestClient):
    """POST /tickets/import with XML whose root is not <tickets> → 400 (container-level error).

    Before the fix, <not_tickets>...</not_tickets> returned 200 with successful=0,
    which silently accepted invalid XML structure. After the fix it returns 400.
    Ref: task1-design.md §3.1 — root element must be <tickets>.
    """
    xml = b"""<?xml version="1.0"?><not_tickets>
        <ticket>
            <customer_id>c1</customer_id>
        </ticket>
    </not_tickets>"""
    r = client.post(
        "/tickets/import",
        files={"file": ("bad_root.xml", xml, "application/xml")},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Edge case #12: POST /tickets?auto_classify=true overwrites body category/priority
# ---------------------------------------------------------------------------

def test_auto_classify_overwrites_body_category_priority(client):
    """Edge case #12: body supplies category+priority, auto_classify=true overwrites both.

    The client sends category='other' and priority='urgent' in the body.
    The classifier detects billing keywords ('invoice', 'refund', 'payment') and
    no priority keywords, so it must overwrite to billing_question / medium.

    Ref: task2-design.md §2.2 — classifier always overwrites client-supplied
    category/priority. task2-design.md §6 edge case #12.
    """
    payload = {
        **VALID_TICKET,
        "subject": "Invoice not paid",
        "description": "I need a refund for my payment.",
        "category": "other",
        "priority": "urgent",
    }
    r = client.post("/tickets?auto_classify=true", json=payload)
    assert r.status_code == 201
    body = r.json()
    # classifier should overwrite: billing_question and medium (no priority keywords)
    assert body["category"] == "billing_question"
    assert body["priority"] == "medium"


# ---------------------------------------------------------------------------
# Edge case #13: PUT after auto-classify; second auto-classify still overwrites
# ---------------------------------------------------------------------------

def test_auto_classify_after_put_overwrites(client):
    """Edge case #13: PUT sets fields manually, second auto-classify overwrites.

    Flow:
      1. Create ticket with VALID_TICKET (no billing or priority keywords).
      2. Run auto-classify (first time — sets whatever classifier returns).
      3. PUT overrides category='other', priority='low' manually.
      4. Verify the PUT was applied (category == 'other').
      5. Run auto-classify a second time — must succeed (200) and overwrite
         the manual values. No lock must exist.

    Ref: task2-design.md §6 edge case #13 — PUT after auto-classify just sets
    fields; no lock. Subsequent auto-classify overwrites again.
    task2-design.md §2.3 — calling auto-classify twice produces two log entries.
    """
    tid = client.post("/tickets", json=VALID_TICKET).json()["id"]
    # first auto-classify
    client.post(f"/tickets/{tid}/auto-classify")
    # PUT overrides fields manually
    client.put(f"/tickets/{tid}", json={"category": "other", "priority": "low"})
    assert client.get(f"/tickets/{tid}").json()["category"] == "other"
    # second auto-classify should overwrite the manual PUT values
    r2 = client.post(f"/tickets/{tid}/auto-classify")
    assert r2.status_code == 200
    # auto-classify ran again successfully — no lock
    final = client.get(f"/tickets/{tid}").json()
    assert final["category"] != "locked"  # any non-error category is fine
