"""
Ticket CRUD router — Task 1 implementation.

Implements all five CRUD routes per task1-design.md §1.
Task 2 surface (auto-classify) remains a stub.

Mount point: prefix="/tickets" (set in main.py).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response

from app.domain.enums import Category, Priority, Status
from app.domain.models import ClassificationResult, Ticket, TicketCreate, TicketUpdate
from app.services.classification_log import ClassificationLog, get_log
from app.services.classifier import classify
from app.services.store import InMemoryTicketStore, get_store

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _not_found(ticket_id: UUID) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "error": "Ticket not found",
            "details": [
                {
                    "field": "ticket_id",
                    "message": f"no ticket with id {ticket_id}",
                }
            ],
        },
    )


@router.post("", status_code=201)
async def create_ticket(
    payload: TicketCreate,
    store: InMemoryTicketStore = Depends(get_store),
    log: ClassificationLog = Depends(get_log),  # only used when auto_classify=True
    auto_classify: bool = Query(False),
) -> JSONResponse:
    """POST /tickets — create a new ticket and return it with 201."""
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        id=uuid4(),
        customer_id=payload.customer_id,
        customer_email=payload.customer_email,
        customer_name=payload.customer_name,
        subject=payload.subject,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        status=payload.status,
        assigned_to=payload.assigned_to,
        tags=payload.tags,
        metadata=payload.metadata,
        created_at=now,
        updated_at=now,
        resolved_at=now if payload.status == Status.resolved else None,
    )
    store.insert(ticket)
    if auto_classify:
        result = classify(ticket.id, ticket.subject, ticket.description)
        ticket.category = result.category
        ticket.priority = result.priority
        ticket.updated_at = datetime.now(timezone.utc)
        store.update(ticket)
        log.record(result)
    return JSONResponse(status_code=201, content=ticket.model_dump(mode="json"))


@router.get("")
async def list_tickets(
    category: Category | None = None,
    priority: Priority | None = None,
    status: Status | None = None,
    store: InMemoryTicketStore = Depends(get_store),
) -> JSONResponse:
    """GET /tickets — list all tickets with optional AND-composed filters."""
    tickets = store.filter(category=category, priority=priority, status=status)
    return JSONResponse(
        status_code=200,
        content=[t.model_dump(mode="json") for t in tickets],
    )


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: UUID,
    store: InMemoryTicketStore = Depends(get_store),
) -> JSONResponse:
    """GET /tickets/{ticket_id} — fetch a ticket by ID; 404 if not found."""
    ticket = store.get(ticket_id)
    if ticket is None:
        return _not_found(ticket_id)
    return JSONResponse(status_code=200, content=ticket.model_dump(mode="json"))


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    store: InMemoryTicketStore = Depends(get_store),
    log: ClassificationLog = Depends(get_log),
) -> JSONResponse:
    """PUT /tickets/{ticket_id} — partial update using exclude_unset semantics."""
    ticket = store.get(ticket_id)
    if ticket is None:
        return _not_found(ticket_id)

    changes = payload.model_dump(exclude_unset=True)

    # Capture previous status BEFORE applying changes
    previous_status = ticket.status

    # Apply changes field by field
    for field, value in changes.items():
        setattr(ticket, field, value)

    # Status transition side effects (task1-design.md §5.2)
    if "status" in changes:
        new_status = changes["status"]
        if new_status == Status.resolved:
            if previous_status != Status.resolved:
                # Transitioning INTO resolved — always set resolved_at
                ticket.resolved_at = datetime.now(timezone.utc)
            # else: was already resolved and stays resolved — resolved_at unchanged
        else:
            # Transitioning OUT of resolved (or non-resolved → non-resolved)
            ticket.resolved_at = None

    ticket.updated_at = datetime.now(timezone.utc)
    store.update(ticket)

    # Log manual category/priority overrides (TASKS.md: "Log all decisions")
    if any(changes.get(f) is not None for f in ("category", "priority")):
        log.record(ClassificationResult(
            ticket_id=ticket.id,
            category=ticket.category or Category.other,
            priority=ticket.priority or Priority.medium,
            confidence=0.0,
            reasoning="Manual override via PUT",
            keywords_found=[],
        ))

    return JSONResponse(status_code=200, content=ticket.model_dump(mode="json"))


@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(
    ticket_id: UUID,
    store: InMemoryTicketStore = Depends(get_store),
) -> Response:
    """DELETE /tickets/{ticket_id} — delete a ticket; 404 if not found."""
    deleted = store.delete(ticket_id)
    if not deleted:
        return _not_found(ticket_id)
    return Response(status_code=204)


@router.post("/{ticket_id}/auto-classify")
async def auto_classify_ticket(
    ticket_id: UUID,
    store: InMemoryTicketStore = Depends(get_store),
    log: ClassificationLog = Depends(get_log),
) -> JSONResponse:
    """Run keyword-based auto-classification on a ticket and update its category and priority."""
    ticket = store.get(ticket_id)
    if ticket is None:
        return _not_found(ticket_id)
    result = classify(ticket.id, ticket.subject, ticket.description)
    ticket.category = result.category
    ticket.priority = result.priority
    ticket.updated_at = datetime.now(timezone.utc)
    store.update(ticket)
    log.record(result)
    return JSONResponse(status_code=200, content=result.model_dump(mode="json"))


@router.get("/{ticket_id}/classifications")
async def get_ticket_classifications(
    ticket_id: UUID,
    store: InMemoryTicketStore = Depends(get_store),
    log: ClassificationLog = Depends(get_log),
) -> JSONResponse:
    ticket = store.get(ticket_id)
    if ticket is None:
        return _not_found(ticket_id)
    entries = log.entries(ticket_id=ticket_id)
    return JSONResponse(status_code=200, content=[e.model_dump(mode="json") for e in entries])
