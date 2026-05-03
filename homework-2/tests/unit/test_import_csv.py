"""Unit tests for the CSV importer parse_csv() pure function.

The function currently raises NotImplementedError (stub). All tests here call
parse_csv() and assert REAL expected behavior as specified in task1-design.md §4.
They will all fail in RED state (NotImplementedError propagates naturally — we
do NOT catch it). This is the correct red state per the TDD invariant.

Import contract: parse_csv(data: bytes) -> (list[TicketCreate], list[ImportError])
Ref: task1-design.md §4, architecture-skeleton.md §2 (importers table row).
"""
from __future__ import annotations

import pytest

from app.services.importers.csv import parse_csv
from app.domain.models import ImportError, TicketCreate


# ---------------------------------------------------------------------------
# Helpers — minimal valid CSV bytes
# ---------------------------------------------------------------------------

_REQUIRED_HEADER = (
    "customer_id,customer_email,customer_name,subject,description"
)

_VALID_ROW_1 = (
    "cust-001,alice@example.com,Alice Example,"
    "Cannot log in,I cannot log into my account since this morning."
)

_VALID_ROW_2 = (
    "cust-002,bob@example.com,Bob Example,"
    "Invoice question,I have a question about invoice number 12345."
)

_FULL_HEADER = (
    "customer_id,customer_email,customer_name,subject,description,"
    "category,priority,status,assigned_to,tags,"
    "metadata_source,metadata_browser,metadata_device_type"
)


# ---------------------------------------------------------------------------
# 1. Valid CSV with 2 data rows
# ---------------------------------------------------------------------------

def test_parse_csv_valid_rows():
    """A valid CSV with 2 data rows returns 2 TicketCreate objects and 0 errors.

    Ref: task1-design.md §4.1 — CSV format conventions; required headers.
    """
    csv_bytes = (
        f"{_REQUIRED_HEADER}\n"
        f"{_VALID_ROW_1}\n"
        f"{_VALID_ROW_2}\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    assert len(tickets) == 2
    assert len(errors) == 0
    assert all(isinstance(t, TicketCreate) for t in tickets)
    assert tickets[0].customer_id == "cust-001"
    assert tickets[1].customer_id == "cust-002"


# ---------------------------------------------------------------------------
# 2. Empty file — 0 bytes
# ---------------------------------------------------------------------------

def test_parse_csv_empty_file():
    """Zero-byte input should raise ValueError or return ([], [ImportError]).

    Design choice: task1-design.md §2.5 says an empty file is a 400-level error
    (field='file'). The router enforces the 400; the parser's job is to signal that
    the file has no usable content. We expect parse_csv(b"") to raise ValueError.
    A ValueError propagates to the router which converts it to a 400 response.
    """
    # The parser should raise ValueError when given empty bytes (no header row).
    with pytest.raises(ValueError):
        parse_csv(b"")


# ---------------------------------------------------------------------------
# 3. CSV missing required column (customer_id) — every row gets an ImportError
# ---------------------------------------------------------------------------

def test_parse_csv_missing_required_column():
    """CSV missing the customer_id column should produce an ImportError per row.

    Ref: task1-design.md §4.1 — required headers listed; unknown/missing → 400 (field='file').
    The parser returns [] tickets and >=1 ImportError entries covering missing required data.
    """
    csv_bytes = (
        # customer_id column deliberately omitted
        "customer_email,customer_name,subject,description\n"
        "alice@example.com,Alice,Cannot log in,I cannot log into my account since this morning.\n"
        "bob@example.com,Bob,Invoice question,I have a question about invoice number 12345.\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    # No valid tickets because required column is missing
    assert len(tickets) == 0
    # At least one ImportError for the missing required column
    assert len(errors) >= 1
    assert all(isinstance(e, ImportError) for e in errors)


# ---------------------------------------------------------------------------
# 4. One row with invalid email — that row is an ImportError; valid rows pass
# ---------------------------------------------------------------------------

def test_parse_csv_invalid_email_in_row():
    """A row with an invalid email produces one ImportError; the other row is returned.

    Ref: task1-design.md §2.5 — some rows valid, some invalid → 200 with ImportSummary errors.
    task1-design.md §7 row 7 — customer_email must be a valid email.
    """
    csv_bytes = (
        f"{_REQUIRED_HEADER}\n"
        "cust-001,not-an-email,Alice,Cannot log in,I cannot log into my account since this morning.\n"
        f"{_VALID_ROW_2}\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    # Row with bad email produces an error; the valid row is returned
    assert len(errors) == 1
    assert len(tickets) == 1
    assert tickets[0].customer_id == "cust-002"
    # Error row index is 1-based data row (row 1 = first data row)
    assert errors[0].row == 1


# ---------------------------------------------------------------------------
# 5. Tags column — semicolon-separated values parsed into a list
# ---------------------------------------------------------------------------

def test_parse_csv_tags_semicolon_separated():
    """tags column 'login;urgent' is parsed as ['login', 'urgent'].

    Ref: task1-design.md §4.1 — tags: semicolon-separated in one column; empty segments stripped.
    """
    csv_bytes = (
        f"{_FULL_HEADER}\n"
        "cust-001,alice@example.com,Alice Example,"
        "Cannot log in,I cannot log into my account since this morning.,"
        "account_access,high,new,,login;urgent,,,\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    assert len(errors) == 0
    assert len(tickets) == 1
    assert tickets[0].tags == ["login", "urgent"]


# ---------------------------------------------------------------------------
# 6. Metadata columns flattened to TicketMetadata object
# ---------------------------------------------------------------------------

def test_parse_csv_metadata_flattened_columns():
    """metadata_source=web_form, metadata_browser=Chrome, metadata_device_type=desktop
    produces a TicketMetadata object with those fields.

    Ref: task1-design.md §4.1 — metadata flattened to metadata_source / metadata_browser /
    metadata_device_type. If at least one is non-blank -> TicketMetadata object.
    """
    from app.domain.enums import Source, DeviceType

    csv_bytes = (
        f"{_FULL_HEADER}\n"
        "cust-001,alice@example.com,Alice Example,"
        "Cannot log in,I cannot log into my account since this morning.,"
        ",,,,,"  # category, priority, status, assigned_to, tags all blank
        "web_form,Chrome,desktop\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    assert len(errors) == 0
    assert len(tickets) == 1
    meta = tickets[0].metadata
    assert meta is not None
    assert meta.source == Source.web_form
    assert meta.browser == "Chrome"
    assert meta.device_type == DeviceType.desktop


# ---------------------------------------------------------------------------
# 7. Invalid metadata_source is a row-level error, not a 400 (issue #6 fix verification)
# ---------------------------------------------------------------------------

def test_parse_csv_invalid_metadata_source_is_row_error():
    """A row with an invalid metadata_source produces a per-row ImportError, not ValueError.

    Before the fix, TicketMetadata(source='bad_value') raised ValidationError outside the
    per-row try/except, propagating as ValueError → 400 for the whole file. After the fix,
    the error is caught per-row and collected in the errors list.
    Ref: task1-design.md §2.5 — row-level validation failures → 200 + ImportSummary.errors.
    """
    csv_bytes = (
        f"{_FULL_HEADER}\n"
        "cust-001,alice@example.com,Alice Example,"
        "Cannot log in,I cannot log into my account since this morning.,"
        ",,,,,invalid_source_value,,\n"
    ).encode("utf-8")

    tickets, errors = parse_csv(csv_bytes)

    assert len(tickets) == 0
    assert len(errors) >= 1
    assert errors[0].row == 1
