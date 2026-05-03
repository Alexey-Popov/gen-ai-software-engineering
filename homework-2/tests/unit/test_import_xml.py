"""Unit tests for the XML importer parse_xml() pure function.

The function currently raises NotImplementedError (stub). All tests call
parse_xml() and assert REAL expected behavior from task1-design.md §3.
They will all fail in RED state — NotImplementedError propagates naturally.

Import contract: parse_xml(data: bytes) -> (list[TicketCreate], list[ImportError])
Container-level errors (malformed XML) raise ValueError.
Ref: task1-design.md §3, §2.5.
"""
from __future__ import annotations

import pytest

from app.services.importers.xml import parse_xml
from app.domain.models import ImportError, TicketCreate


# ---------------------------------------------------------------------------
# Helpers — valid XML fixtures
# ---------------------------------------------------------------------------

_VALID_XML_TWO_TICKETS = b"""<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
    <category>account_access</category>
    <priority>high</priority>
    <status>new</status>
  </ticket>
  <ticket>
    <customer_id>cust-002</customer_id>
    <customer_email>bob@example.com</customer_email>
    <customer_name>Bob Example</customer_name>
    <subject>Invoice question</subject>
    <description>I have a question about invoice number 12345.</description>
  </ticket>
</tickets>
"""


# ---------------------------------------------------------------------------
# 1. Valid XML with 2 <ticket> elements
# ---------------------------------------------------------------------------

def test_parse_xml_valid():
    """A valid XML document with 2 <ticket> elements returns 2 TicketCreate, 0 ImportError.

    Ref: task1-design.md §3.1 — root element <tickets>, child <ticket> per entry.
    """
    tickets, errors = parse_xml(_VALID_XML_TWO_TICKETS)

    assert len(tickets) == 2
    assert len(errors) == 0
    assert all(isinstance(t, TicketCreate) for t in tickets)
    assert tickets[0].customer_id == "cust-001"
    assert tickets[1].customer_id == "cust-002"


# ---------------------------------------------------------------------------
# 2. Empty <tickets> element
# ---------------------------------------------------------------------------

def test_parse_xml_empty_tickets():
    """<tickets></tickets> returns ([], []) — zero rows, no error.

    Ref: task1-design.md §3.1 — zero <ticket> child elements is valid XML.
    """
    data = b'<?xml version="1.0" encoding="UTF-8"?><tickets></tickets>'

    tickets, errors = parse_xml(data)

    assert tickets == []
    assert errors == []


# ---------------------------------------------------------------------------
# 3. Malformed XML — raises ValueError
# ---------------------------------------------------------------------------

def test_parse_xml_malformed():
    """b'not xml at all' must raise ValueError (container-level error).

    Ref: task1-design.md §2.5 — container-level malformed file → 400, field='file'.
    task1-design.md §3.1 — parsed with defusedxml.ElementTree.
    """
    with pytest.raises(ValueError):
        parse_xml(b"not xml at all")


# ---------------------------------------------------------------------------
# 4. Tags parsed from <tags><tag>...</tag></tags> wrapper
# ---------------------------------------------------------------------------

def test_parse_xml_tags_wrapper():
    """<tags><tag>login</tag><tag>urgent</tag></tags> is parsed as ['login', 'urgent'].

    Ref: task1-design.md §3.1 — tags: <tags> wrapper containing <tag> elements.
    """
    data = b"""<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
    <tags>
      <tag>login</tag>
      <tag>urgent</tag>
    </tags>
  </ticket>
</tickets>
"""
    tickets, errors = parse_xml(data)

    assert len(errors) == 0
    assert len(tickets) == 1
    assert tickets[0].tags == ["login", "urgent"]


# ---------------------------------------------------------------------------
# 5. Missing required field in a <ticket> element — ImportError for that row
# ---------------------------------------------------------------------------

def test_parse_xml_missing_required_field():
    """A <ticket> with no <customer_email> produces an ImportError for that row.

    Ref: task1-design.md §2.5 — row-level failures → ImportError in ImportSummary.errors.
    task1-design.md §7 row 7 — customer_email is required.
    """
    data = b"""<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <!-- customer_email intentionally omitted -->
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
  </ticket>
</tickets>
"""
    tickets, errors = parse_xml(data)

    assert len(tickets) == 0
    assert len(errors) == 1
    assert isinstance(errors[0], ImportError)
    assert errors[0].row == 1


# ---------------------------------------------------------------------------
# 6. Full <metadata> wrapper parsed into TicketMetadata
# ---------------------------------------------------------------------------

def test_parse_xml_metadata_wrapper():
    """<metadata><source>web_form</source><browser>Chrome</browser><device_type>desktop</device_type></metadata>
    is parsed into TicketMetadata with source=Source.web_form, browser='Chrome',
    device_type=DeviceType.desktop.

    Ref: task1-design.md §3.1 — metadata: <metadata> wrapper containing optional
    <source>, <browser>, <device_type> child elements.
    """
    from app.domain.enums import Source, DeviceType

    data = b"""<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
    <metadata>
      <source>web_form</source>
      <browser>Chrome</browser>
      <device_type>desktop</device_type>
    </metadata>
  </ticket>
</tickets>
"""

    tickets, errors = parse_xml(data)

    assert len(errors) == 0
    assert len(tickets) == 1
    meta = tickets[0].metadata
    assert meta is not None
    assert meta.source == Source.web_form
    assert meta.browser == "Chrome"
    assert meta.device_type == DeviceType.desktop


# ---------------------------------------------------------------------------
# 7. Wrong root element — raises ValueError (issue #5 fix verification)
# ---------------------------------------------------------------------------

def test_parse_xml_wrong_root_element():
    """XML with root element other than <tickets> raises ValueError (container-level error).

    Ref: task1-design.md §3.1 — root element must be <tickets>.
    Posting <not_tickets>...</not_tickets> returned 200 with empty summary (bug); must now 400.
    """
    data = b"""<?xml version="1.0"?><not_tickets><ticket>
        <customer_id>c1</customer_id>
    </ticket></not_tickets>"""
    with pytest.raises(ValueError, match="not_tickets"):
        parse_xml(data)


# ---------------------------------------------------------------------------
# 8. Invalid metadata_source is a row-level error, not a 400 (issue #6 fix verification)
# ---------------------------------------------------------------------------

def test_parse_xml_invalid_metadata_source_is_row_error():
    """A <ticket> with invalid <source> inside <metadata> produces a per-row ImportError.

    Before the fix, TicketMetadata(source='bad') raised ValidationError outside the
    per-row try/except, which propagated as ValueError → 400 for the entire file.
    After the fix, the error is caught per-row and reported in errors[], not raised.
    Ref: task1-design.md §2.5 — row-level validation failures → 200 + ImportSummary.errors.
    """
    data = b"""<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust-001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice Example</customer_name>
    <subject>Cannot log in</subject>
    <description>I cannot log into my account since this morning.</description>
    <metadata>
      <source>invalid_source_value</source>
    </metadata>
  </ticket>
</tickets>
"""
    tickets, errors = parse_xml(data)
    assert len(tickets) == 0
    assert len(errors) >= 1
    assert errors[0].row == 1
