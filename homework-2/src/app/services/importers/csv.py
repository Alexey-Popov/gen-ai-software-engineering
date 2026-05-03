"""
CSV importer — Task 1 implementation.

Parses a CSV file (as bytes) into a list of TicketCreate objects and a list of
ImportError objects for rows that fail validation.

Pure function — no FastAPI imports. The router is the thin adapter.
Ref: task1-design.md §4.
"""
from __future__ import annotations

import csv
import io

from pydantic import ValidationError

from app.domain.models import ImportError, TicketCreate, TicketMetadata

# Columns allowed in the CSV header (must match JSON model keys exactly)
_ALLOWED_COLUMNS = frozenset({
    "customer_id",
    "customer_email",
    "customer_name",
    "subject",
    "description",
    "category",
    "priority",
    "status",
    "assigned_to",
    "tags",
    "metadata_source",
    "metadata_browser",
    "metadata_device_type",
})


def parse_csv(data: bytes) -> tuple[list[TicketCreate], list[ImportError]]:
    """Parse CSV bytes into a list of TicketCreate objects and a list of row errors.

    Args:
        data: Raw CSV file content as bytes.

    Returns:
        A tuple of (successful_tickets, row_errors).

    Raises:
        ValueError: If the header is missing (empty file) or an unknown column is present.
    """
    # Strip BOM if present (UTF-8 BOM = EF BB BF)
    text = data.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))

    # Accessing fieldnames causes the header row to be read; None means no header.
    if reader.fieldnames is None:
        raise ValueError("CSV file is empty or has no header row")

    # Validate column names — unknown column → raise ValueError (router converts to 400)
    for col in reader.fieldnames:
        col_stripped = col.strip()
        if col_stripped not in _ALLOWED_COLUMNS:
            raise ValueError(f"unknown column: {col_stripped}")

    tickets: list[TicketCreate] = []
    errors: list[ImportError] = []

    for row_num, row in enumerate(reader, start=1):
        ticket_dict: dict = {}

        for key, value in row.items():
            key = key.strip()
            # Blank cell → omit the field (treat as None / default)
            if value is None or value.strip() == "":
                continue
            ticket_dict[key] = value.strip()

        # Handle tags column: split on ';', strip whitespace, drop empty segments
        if "tags" in ticket_dict:
            raw_tags = ticket_dict.pop("tags")
            ticket_dict["tags"] = [
                segment.strip()
                for segment in raw_tags.split(";")
                if segment.strip()
            ]

        # Handle metadata_* columns → build TicketMetadata if any is non-blank
        meta_source = ticket_dict.pop("metadata_source", None)
        meta_browser = ticket_dict.pop("metadata_browser", None)
        meta_device_type = ticket_dict.pop("metadata_device_type", None)

        if any(v is not None for v in (meta_source, meta_browser, meta_device_type)):
            try:
                ticket_dict["metadata"] = TicketMetadata(
                    source=meta_source,
                    browser=meta_browser,
                    device_type=meta_device_type,
                )
            except ValidationError as meta_exc:
                for detail in meta_exc.errors():
                    loc = detail.get("loc", ())
                    field = str(loc[-1]) if loc else "metadata"
                    errors.append(ImportError(
                        row=row_num,
                        field=field,
                        message=detail["msg"],
                    ))
                continue

        try:
            ticket = TicketCreate(**ticket_dict)
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
