"""
Bulk import router — Task 1 implementation.

POST /tickets/import — accepts multipart/form-data with a file field.
Format detection priority: explicit ?format= param → MIME type → filename suffix.
Dispatches to the appropriate pure parser and batch-inserts valid tickets.

Ref: task1-design.md §2.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse

from app.domain.enums import Status
from app.domain.models import ImportSummary, Ticket
from app.services.importers.csv import parse_csv
from app.services.importers.json import parse_json
from app.services.importers.xml import parse_xml
from app.services.store import InMemoryTicketStore, get_store

router = APIRouter(prefix="/tickets", tags=["imports"])

# MIME type → format string
_MIME_MAP: dict[str, str] = {
    "text/csv": "csv",
    "application/csv": "csv",
    "application/json": "json",
    "text/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
}

# File suffix → format string (lower-cased)
_SUFFIX_MAP: dict[str, str] = {
    ".csv": "csv",
    ".json": "json",
    ".xml": "xml",
}


def _detect_format(
    format_param: str | None,
    content_type: str | None,
    filename: str | None,
) -> str | None:
    """Return the detected format string ('csv', 'json', 'xml') or None if unknown."""
    # 1. Explicit format query param (highest priority)
    if format_param is not None:
        return format_param.lower()

    # 2. MIME type
    if content_type:
        # content_type may include parameters like '; charset=utf-8'
        mime = content_type.split(";")[0].strip().lower()
        if mime in _MIME_MAP:
            return _MIME_MAP[mime]

    # 3. Filename suffix
    if filename:
        dot_pos = filename.rfind(".")
        if dot_pos != -1:
            suffix = filename[dot_pos:].lower()
            if suffix in _SUFFIX_MAP:
                return _SUFFIX_MAP[suffix]

    return None


@router.post("/import")
async def import_tickets(
    file: UploadFile = File(...),
    file_format: str | None = Query(None, alias="format"),
    store: InMemoryTicketStore = Depends(get_store),
) -> JSONResponse:
    """POST /tickets/import — import tickets from a CSV, JSON, or XML file."""

    data = await file.read()

    # Empty file check
    if len(data) == 0:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Empty file",
                "details": [{"field": "file", "message": "uploaded file is empty"}],
            },
        )

    # Format detection
    detected = _detect_format(file_format, file.content_type, file.filename)

    if detected not in {"csv", "json", "xml"}:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Unrecognised format",
                "details": [
                    {
                        "field": "format",
                        "message": (
                            "unable to detect file format; "
                            "pass ?format=csv|json|xml or send a recognised content-type"
                        ),
                    }
                ],
            },
        )

    # Dispatch to parser
    try:
        if detected == "csv":
            ticket_creates, import_errors = parse_csv(data)
        elif detected == "json":
            ticket_creates, import_errors = parse_json(data)
        else:  # xml
            ticket_creates, import_errors = parse_xml(data)
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Malformed file",
                "details": [{"field": "file", "message": str(exc)}],
            },
        )

    # Insert valid tickets
    for create in ticket_creates:
        now = datetime.now(timezone.utc)
        ticket = Ticket(
            id=uuid4(),
            customer_id=create.customer_id,
            customer_email=create.customer_email,
            customer_name=create.customer_name,
            subject=create.subject,
            description=create.description,
            category=create.category,
            priority=create.priority,
            status=create.status,
            assigned_to=create.assigned_to,
            tags=create.tags,
            metadata=create.metadata,
            created_at=now,
            updated_at=now,
            resolved_at=now if create.status == Status.resolved else None,
        )
        store.insert(ticket)

    summary = ImportSummary(
        total=len(ticket_creates) + len(import_errors),
        successful=len(ticket_creates),
        failed=len(import_errors),
        errors=import_errors,
    )
    return JSONResponse(status_code=200, content=summary.model_dump(mode="json"))
