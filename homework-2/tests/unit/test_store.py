"""Unit tests for InMemoryTicketStore — direct store access without HTTP.

Tests cover the filter() method with category, priority, and combined filters.
Ref: task1-design.md §1.3 — filters compose with AND semantics.
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest

from app.domain.enums import Category, Priority, Status
from app.domain.models import Ticket
from app.services.store import InMemoryTicketStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ticket(
    *,
    category: Category | None = None,
    priority: Priority | None = None,
    status: Status = Status.new,
) -> Ticket:
    """Build a minimal Ticket with server-side fields populated."""
    now = datetime.utcnow()
    return Ticket(
        id=uuid4(),
        customer_id="cust-001",
        customer_email="alice@example.com",
        customer_name="Alice Example",
        subject="Test subject",
        description="This description is long enough to pass validation.",
        category=category,
        priority=priority,
        status=status,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------------------------
# 1. Filter by category
# ---------------------------------------------------------------------------

def test_store_filter_by_category():
    """Insert 2 tickets with different categories; filter by one → only matching returned.

    Ref: task1-design.md §1.3 — category filter applied, insertion order preserved.
    """
    store = InMemoryTicketStore()

    ticket_billing = _make_ticket(category=Category.billing_question)
    ticket_technical = _make_ticket(category=Category.technical_issue)

    store.insert(ticket_billing)
    store.insert(ticket_technical)

    results = store.filter(category=Category.billing_question)

    assert len(results) == 1
    assert results[0].id == ticket_billing.id
    assert results[0].category == Category.billing_question


# ---------------------------------------------------------------------------
# 2. Filter by priority
# ---------------------------------------------------------------------------

def test_store_filter_by_priority():
    """Insert 2 tickets with different priorities; filter by one → only matching returned.

    Ref: task1-design.md §1.3 — priority filter applied.
    """
    store = InMemoryTicketStore()

    ticket_high = _make_ticket(priority=Priority.high)
    ticket_low = _make_ticket(priority=Priority.low)

    store.insert(ticket_high)
    store.insert(ticket_low)

    results = store.filter(priority=Priority.high)

    assert len(results) == 1
    assert results[0].id == ticket_high.id
    assert results[0].priority == Priority.high


# ---------------------------------------------------------------------------
# 3. Combined category + priority filter — only intersection returned
# ---------------------------------------------------------------------------

def test_store_filter_combined():
    """Insert 3 tickets; filter by category AND priority → only the intersection returned.

    Ref: task1-design.md §1.3 — filters compose with AND semantics.
    """
    store = InMemoryTicketStore()

    # Matches both filters (category=billing_question, priority=urgent)
    ticket_match = _make_ticket(
        category=Category.billing_question,
        priority=Priority.urgent,
    )
    # Matches category only
    ticket_cat_only = _make_ticket(
        category=Category.billing_question,
        priority=Priority.low,
    )
    # Matches priority only
    ticket_pri_only = _make_ticket(
        category=Category.technical_issue,
        priority=Priority.urgent,
    )

    store.insert(ticket_match)
    store.insert(ticket_cat_only)
    store.insert(ticket_pri_only)

    results = store.filter(
        category=Category.billing_question,
        priority=Priority.urgent,
    )

    assert len(results) == 1
    assert results[0].id == ticket_match.id
    assert results[0].category == Category.billing_question
    assert results[0].priority == Priority.urgent
