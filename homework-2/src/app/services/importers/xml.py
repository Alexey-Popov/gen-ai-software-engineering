"""
XML importer — Task 1 implementation.

Parses an XML file (as bytes) into a list of TicketCreate objects and a list of
ImportError objects for elements that fail validation.

IMPORTANT: Uses defusedxml.ElementTree exclusively — never stdlib xml.etree.ElementTree.
Stdlib parsers are vulnerable to XXE and billion-laughs attacks on untrusted input.

Pure function — no FastAPI imports. The router is the thin adapter.
Ref: task1-design.md §3.
"""
from __future__ import annotations

import defusedxml.ElementTree as ET
from defusedxml.common import DefusedXmlException

from pydantic import ValidationError

from app.domain.models import ImportError, TicketCreate, TicketMetadata


def parse_xml(data: bytes) -> tuple[list[TicketCreate], list[ImportError]]:
    """Parse XML bytes into a list of TicketCreate objects and a list of row errors.

    Args:
        data: Raw XML file content as bytes.

    Returns:
        A tuple of (successful_tickets, row_errors).

    Raises:
        ValueError: If the XML is malformed (container-level error).
    """
    try:
        root = ET.fromstring(data)
    except (ET.ParseError, DefusedXmlException):
        raise ValueError("malformed xml file")

    if root.tag != "tickets":
        raise ValueError(
            f"malformed xml file: expected root element <tickets>, got <{root.tag}>"
        )

    tickets: list[TicketCreate] = []
    errors: list[ImportError] = []

    for row_num, ticket_elem in enumerate(root.findall("ticket"), start=1):
        ticket_dict: dict = {}
        metadata_error = False

        for child in ticket_elem:
            tag = child.tag

            if tag == "tags":
                # <tags><tag>login</tag><tag>urgent</tag></tags>
                tag_values = [
                    t.text.strip()
                    for t in child.findall("tag")
                    if t.text and t.text.strip()
                ]
                ticket_dict["tags"] = tag_values

            elif tag == "metadata":
                # <metadata><source>...</source><browser>...</browser><device_type>...</device_type>
                source_elem = child.find("source")
                browser_elem = child.find("browser")
                device_type_elem = child.find("device_type")

                source = (source_elem.text.strip() if source_elem is not None and source_elem.text else None) or None
                browser = (browser_elem.text.strip() if browser_elem is not None and browser_elem.text else None) or None
                device_type = (device_type_elem.text.strip() if device_type_elem is not None and device_type_elem.text else None) or None

                if any(v is not None for v in (source, browser, device_type)):
                    try:
                        ticket_dict["metadata"] = TicketMetadata(
                            source=source,
                            browser=browser,
                            device_type=device_type,
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
                        metadata_error = True

            else:
                # Scalar field — strip whitespace; empty text = omission
                text = child.text.strip() if child.text else None
                if text:
                    ticket_dict[tag] = text

        if metadata_error:
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
