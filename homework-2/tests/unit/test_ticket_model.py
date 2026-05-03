"""Unit tests for Pydantic domain models (task1-design.md §1.2, §5.3, §7).

No HTTP client or store — pure model validation in isolation.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.enums import Category, Priority, Source, DeviceType, Status
from app.domain.models import Ticket, TicketCreate, TicketUpdate


# ---------------------------------------------------------------------------
# 1. TicketCreate — valid fully-populated payload
# ---------------------------------------------------------------------------

def test_ticket_create_valid():
    """A fully populated TicketCreate with all fields passes validation.

    Ref: task1-design.md §1.2 — required + optional fields listed.
    """
    model = TicketCreate(
        customer_id="cust-001",
        customer_email="alice@example.com",
        customer_name="Alice Example",
        subject="Cannot log in",
        description="I cannot log into my account since this morning.",
        category=Category.account_access,
        priority=Priority.high,
        status=Status.new,
        assigned_to="agent-7",
        tags=["login", "urgent"],
        metadata=None,
    )
    assert model.customer_id == "cust-001"
    assert model.customer_email == "alice@example.com"
    assert model.subject == "Cannot log in"
    assert model.tags == ["login", "urgent"]
    assert model.status == Status.new


# ---------------------------------------------------------------------------
# 2. Missing required field — customer_id omitted
# ---------------------------------------------------------------------------

def test_ticket_create_missing_required_field():
    """Omitting customer_id must raise a ValidationError.

    Ref: task1-design.md §1.2 — customer_id is a required field.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            # customer_id intentionally omitted
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="I cannot log into my account since this morning.",
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "customer_id" in fields


# ---------------------------------------------------------------------------
# 3. Invalid email
# ---------------------------------------------------------------------------

def test_ticket_create_invalid_email():
    """customer_email='not-an-email' must raise ValidationError.

    Ref: task1-design.md §7 row 7 — customer_email must be a valid email address.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="not-an-email",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="I cannot log into my account since this morning.",
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "customer_email" in fields


# ---------------------------------------------------------------------------
# 4. Subject too short (empty string)
# ---------------------------------------------------------------------------

def test_ticket_create_subject_too_short():
    """subject='' (0 chars) must raise ValidationError.

    Ref: task1-design.md §7 row 8 — subject must be 1-200 chars.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="",
            description="I cannot log into my account since this morning.",
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "subject" in fields


# ---------------------------------------------------------------------------
# 5. Subject too long (201 chars)
# ---------------------------------------------------------------------------

def test_ticket_create_subject_too_long():
    """subject of 201 characters must raise ValidationError.

    Ref: task1-design.md §7 row 8 — subject max_length=200.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="x" * 201,
            description="I cannot log into my account since this morning.",
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "subject" in fields


# ---------------------------------------------------------------------------
# 6. Description too short (9 chars — boundary: min is 10)
# ---------------------------------------------------------------------------

def test_ticket_create_description_too_short():
    """description of 9 characters must raise ValidationError.

    Ref: task1-design.md §7 row 9 — description must be >= 10 chars.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="123456789",  # exactly 9 chars
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "description" in fields


# ---------------------------------------------------------------------------
# 7. Description too long (2001 chars)
# ---------------------------------------------------------------------------

def test_ticket_create_description_too_long():
    """description of 2001 characters must raise ValidationError.

    Ref: task1-design.md §7 row 9 — description max_length=2000.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="x" * 2001,
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "description" in fields


# ---------------------------------------------------------------------------
# 8. Invalid category enum value
# ---------------------------------------------------------------------------

def test_ticket_create_invalid_category():
    """category='invalid_val' must raise ValidationError.

    Ref: task1-design.md §7 row 2 — category must be a valid Category enum value.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="I cannot log into my account since this morning.",
            category="invalid_val",
        )
    errors = exc_info.value.errors()
    fields = [e["loc"][-1] for e in errors]
    assert "category" in fields


# ---------------------------------------------------------------------------
# 9. Extra (unknown) field forbidden
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# TicketUpdate — string-length constraints (issue #1 fix verification)
# ---------------------------------------------------------------------------

def test_ticket_update_subject_too_short():
    """TicketUpdate with subject='' must raise ValidationError (min_length=1).

    Ref: task1-design.md §7 row 8 — subject must be 1-200 chars; same constraint applies on PUT.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketUpdate(subject="")
    fields = [e["loc"][-1] for e in exc_info.value.errors()]
    assert "subject" in fields


def test_ticket_update_subject_too_long():
    """TicketUpdate with subject of 201 chars must raise ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        TicketUpdate(subject="x" * 201)
    fields = [e["loc"][-1] for e in exc_info.value.errors()]
    assert "subject" in fields


def test_ticket_update_description_too_short():
    """TicketUpdate with description of 9 chars must raise ValidationError (min_length=10)."""
    with pytest.raises(ValidationError) as exc_info:
        TicketUpdate(description="123456789")
    fields = [e["loc"][-1] for e in exc_info.value.errors()]
    assert "description" in fields


def test_ticket_update_description_too_long():
    """TicketUpdate with description of 2001 chars must raise ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        TicketUpdate(description="x" * 2001)
    fields = [e["loc"][-1] for e in exc_info.value.errors()]
    assert "description" in fields


def test_ticket_update_subject_none_is_valid():
    """TicketUpdate with subject=None is valid — clearing a field is permitted."""
    model = TicketUpdate(subject=None)
    assert model.subject is None


# ---------------------------------------------------------------------------
# 9. Extra (unknown) field forbidden
# ---------------------------------------------------------------------------

def test_ticket_create_extra_field_forbidden():
    """Passing an unknown field must raise ValidationError (extra='forbid').

    Ref: task1-design.md §1.2 — TicketCreate has extra='forbid'; unknown keys → 400.
    Also: task1-design.md §7 row 10 — the extra field name appears in details[].field.
    """
    with pytest.raises(ValidationError) as exc_info:
        TicketCreate(
            customer_id="cust-001",
            customer_email="alice@example.com",
            customer_name="Alice Example",
            subject="Cannot log in",
            description="I cannot log into my account since this morning.",
            this_field_does_not_exist="surprise",
        )
    errors = exc_info.value.errors()
    # Pydantic v2 raises type="extra_forbidden" for extra fields
    types = [e["type"] for e in errors]
    assert "extra_forbidden" in types
