"""
JSON importer — Task 1 implementation.

Parses a JSON file (as bytes) into a list of TicketCreate objects and a list of
ImportError objects for rows that fail validation.

Pure function — no FastAPI imports. The router is the thin adapter.
Ref: task1-design.md §6.
"""
from __future__ import annotations

import json as _json

from pydantic import ValidationError

from app.domain.models import ImportError, TicketCreate


def parse_json(data: bytes) -> tuple[list[TicketCreate], list[ImportError]]:
    """Parse JSON bytes into a list of TicketCreate objects and a list of row errors.

    Args:
        data: Raw JSON file content as bytes.

    Returns:
        A tuple of (successful_tickets, row_errors).

    Raises:
        ValueError: If the JSON is malformed or the top-level value is not an array.
    """
    try:
        payload = _json.loads(data)
    except _json.JSONDecodeError:
        raise ValueError("malformed json file")

    if not isinstance(payload, list):
        raise ValueError("malformed json file")

    tickets: list[TicketCreate] = []
    errors: list[ImportError] = []

    for row_num, element in enumerate(payload, start=1):
        if not isinstance(element, dict):
            errors.append(ImportError(
                row=row_num,
                field="row",
                message="expected object",
            ))
            continue

        try:
            ticket = TicketCreate(**element)
            tickets.append(ticket)
        except ValidationError as exc:
            for detail in exc.errors():
                loc = detail.get("loc", ())
                field = str(loc[-1]) if loc else "unknown"
                errors.append(ImportError(
                    row=row_num,
                    field=field,
                    message=detail["msg"],
                ))

    return tickets, errors
