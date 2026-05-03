"""Unit tests for the JSON importer parse_json() pure function.

The function currently raises NotImplementedError (stub). All tests call
parse_json() and assert REAL expected behavior from task1-design.md §6.
They will all fail in RED state — NotImplementedError propagates naturally.

Import contract: parse_json(data: bytes) -> (list[TicketCreate], list[ImportError])
Container-level errors (not a JSON array, malformed JSON) raise ValueError.
Ref: task1-design.md §6, §2.5.
"""
from __future__ import annotations

import json
import pytest

from app.services.importers.json import parse_json
from app.domain.models import ImportError, TicketCreate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_TICKET_1 = {
    "customer_id": "cust-001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Example",
    "subject": "Cannot log in",
    "description": "I cannot log into my account since this morning.",
}

_VALID_TICKET_2 = {
    "customer_id": "cust-002",
    "customer_email": "bob@example.com",
    "customer_name": "Bob Example",
    "subject": "Invoice question",
    "description": "I have a question about invoice number 12345.",
}


# ---------------------------------------------------------------------------
# 1. Valid JSON array of 2 objects
# ---------------------------------------------------------------------------

def test_parse_json_valid_array():
    """A valid JSON array of 2 ticket objects returns 2 TicketCreate and 0 ImportError.

    Ref: task1-design.md §6 — top-level value MUST be a JSON array; each element is TicketCreate.
    """
    data = json.dumps([_VALID_TICKET_1, _VALID_TICKET_2]).encode("utf-8")

    tickets, errors = parse_json(data)

    assert len(tickets) == 2
    assert len(errors) == 0
    assert all(isinstance(t, TicketCreate) for t in tickets)
    assert tickets[0].customer_id == "cust-001"
    assert tickets[1].customer_id == "cust-002"


# ---------------------------------------------------------------------------
# 2. Empty array — b"[]"
# ---------------------------------------------------------------------------

def test_parse_json_empty_array():
    """b'[]' returns ([], []) — zero rows, no error.

    Ref: task1-design.md §6 — array of zero elements is valid; not a container error.
    The result is an empty ImportSummary with successful=0, failed=0.
    """
    tickets, errors = parse_json(b"[]")

    assert tickets == []
    assert errors == []


# ---------------------------------------------------------------------------
# 3. Top-level object (not an array) — raises ValueError
# ---------------------------------------------------------------------------

def test_parse_json_not_an_array():
    """A top-level JSON object b'{}' must raise ValueError (container-level error).

    Ref: task1-design.md §6 — anything other than a top-level array → 400, field='file',
    message='malformed json file'. The parser raises ValueError; the router converts it to 400.
    """
    with pytest.raises(ValueError):
        parse_json(b"{}")


# ---------------------------------------------------------------------------
# 4. One element missing required field — 1 ImportError, 0 TicketCreate
# ---------------------------------------------------------------------------

def test_parse_json_invalid_row():
    """An array element missing customer_id produces 1 ImportError; 0 TicketCreate returned.

    Ref: task1-design.md §6 — non-object array elements or validation failures → per-row ImportError.
    task1-design.md §2.5 — row-level failures: 200 with ImportSummary errors (successful=0).
    """
    data = json.dumps([
        {
            # customer_id intentionally omitted
            "customer_email": "alice@example.com",
            "customer_name": "Alice",
            "subject": "Subject here",
            "description": "This is a long enough description.",
        }
    ]).encode("utf-8")

    tickets, errors = parse_json(data)

    assert len(tickets) == 0
    assert len(errors) == 1
    assert isinstance(errors[0], ImportError)
    assert errors[0].row == 1


# ---------------------------------------------------------------------------
# 5. Malformed JSON — raises ValueError
# ---------------------------------------------------------------------------

def test_parse_json_malformed_json():
    """b'not json' must raise ValueError (malformed container-level error).

    Ref: task1-design.md §2.5 — container-level malformed file → 400, field='file'.
    task1-design.md §7 row 18 — Import: container-level malformed file → 400.
    """
    with pytest.raises(ValueError):
        parse_json(b"not json")


# ---------------------------------------------------------------------------
# 6. Non-dict array elements — per-row ImportError, field='row'
# ---------------------------------------------------------------------------

def test_parse_json_non_dict_element():
    """An array containing non-dict elements (e.g. integers) produces one ImportError
    per element with field='row'; no TicketCreate objects are returned.

    Ref: task1-design.md §6 — Non-object array elements → per-row ImportError, field='row'.
    task1-design.md §2.5 — row-level failures: 200 with ImportSummary errors.
    """
    data = b"[1, 2]"

    tickets, errors = parse_json(data)

    assert len(tickets) == 0
    assert len(errors) == 2
    assert all(isinstance(e, ImportError) for e in errors)
    assert all(e.field == "row" for e in errors)
