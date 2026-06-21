"""Shared utilities for the multi-agent banking pipeline.

This module is the reusable base every agent depends on. It provides:

* the canonical message envelope (:func:`new_message`) and a small set of
  helpers to read / write / move those messages through the ``shared/``
  directories;
* monetary parsing on :class:`decimal.Decimal` (never ``float``);
* an append-only **audit trail** (:func:`append_audit`) that records *who*
  did *what* to *which transaction* with an ISO 8601 timestamp — and which
  deliberately never writes account numbers or names (PII) in plaintext.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

# --- Domain constants --------------------------------------------------------

#: Ordered names of the pipeline stages (used by the integrator and reports).
AGENT_SEQUENCE: list[str] = [
    "transaction_validator",
    "fraud_detector",
    "compliance_checker",
    "settlement_processor",
    "reporting_agent",
]

#: Subset of active ISO 4217 currency codes the pipeline accepts.
ISO_4217_CURRENCIES: frozenset[str] = frozenset(
    {
        "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD",
        "SGD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "TRY", "ZAR",
        "BRL", "MXN", "INR", "KRW", "AED", "SAR", "ILS", "THB", "MYR", "UAH",
    }
)

#: The home country; transactions to/from elsewhere are treated as cross-border.
DOMESTIC_COUNTRY = "US"

#: Required fields a raw transaction must carry to be processed.
REQUIRED_FIELDS: tuple[str, ...] = (
    "transaction_id",
    "timestamp",
    "source_account",
    "destination_account",
    "amount",
    "currency",
    "transaction_type",
)

#: Sub-directories that make up the file-based communication channel.
SHARED_SUBDIRS: tuple[str, ...] = ("input", "processing", "output", "results")

AUDIT_FILE = "audit-log.jsonl"
SUMMARY_FILE = "pipeline-summary.json"


# --- Time --------------------------------------------------------------------

def iso_now() -> str:
    """Return the current UTC time as an ISO 8601 string (``...Z``)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- Money -------------------------------------------------------------------

def parse_amount(raw: Any) -> Decimal:
    """Parse a monetary value into :class:`~decimal.Decimal`.

    Amounts arrive as JSON strings (e.g. ``"1500.00"``). Parsing always goes
    through ``str`` so we never inherit binary ``float`` rounding error.

    Raises:
        ValueError: if ``raw`` is not a valid decimal number.
    """
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"invalid amount: {raw!r}") from exc


# --- Messages ----------------------------------------------------------------

def new_message(
    source_agent: str,
    target_agent: str,
    data: dict[str, Any],
    message_type: str = "transaction",
) -> dict[str, Any]:
    """Build a standard pipeline message envelope."""
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": iso_now(),
        "source_agent": source_agent,
        "target_agent": target_agent,
        "message_type": message_type,
        "data": dict(data),
    }


def relabel(message: dict[str, Any], source_agent: str, target_agent: str) -> dict[str, Any]:
    """Return a deep-ish copy of ``message`` re-stamped for the next hop."""
    clone = {
        "message_id": message.get("message_id", str(uuid.uuid4())),
        "timestamp": iso_now(),
        "source_agent": source_agent,
        "target_agent": target_agent,
        "message_type": message.get("message_type", "transaction"),
        "data": dict(message.get("data", {})),
    }
    return clone


def transaction_id_of(message: dict[str, Any]) -> str:
    """Best-effort extraction of the transaction id from a message."""
    return str(message.get("data", {}).get("transaction_id", "UNKNOWN"))


# --- File-based channel ------------------------------------------------------

def ensure_shared_dirs(shared_root: Path) -> dict[str, Path]:
    """Create the ``shared/`` sub-directories and return a name -> path map."""
    shared_root = Path(shared_root)
    paths = {}
    for name in SHARED_SUBDIRS:
        d = shared_root / name
        d.mkdir(parents=True, exist_ok=True)
        paths[name] = d
    return paths


def write_message(directory: Path, message: dict[str, Any], name: str | None = None) -> Path:
    """Write ``message`` as pretty JSON into ``directory`` and return its path."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    filename = name or f"{transaction_id_of(message)}.json"
    path = directory / filename
    path.write_text(json.dumps(message, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def read_message(path: Path) -> dict[str, Any]:
    """Read a JSON message from ``path``."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def move_message(src: Path, dest_dir: Path) -> Path:
    """Move a message file into ``dest_dir`` (overwriting any same-named file)."""
    src = Path(src)
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    if dest.exists():
        dest.unlink()
    src.replace(dest)
    return dest


# --- Audit trail (PII-safe) --------------------------------------------------

def mask_account(account: str) -> str:
    """Mask an account identifier, keeping only the last 2 characters.

    ``ACC-1001`` -> ``****01``. Used so the rare diagnostic that needs an
    account reference still never leaks the full number.
    """
    account = str(account)
    if len(account) <= 2:
        return "****"
    return "****" + account[-2:]


def append_audit(shared_root: Path, agent: str, transaction_id: str, outcome: str) -> None:
    """Append one audit record to ``shared/results/audit-log.jsonl``.

    The record carries an ISO 8601 timestamp, the agent name, the transaction
    id and the outcome — and nothing else. Account numbers, names and other
    PII are intentionally excluded from the audit trail.
    """
    results_dir = Path(shared_root) / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "timestamp": iso_now(),
        "agent": agent,
        "transaction_id": str(transaction_id),
        "outcome": outcome,
    }
    line = json.dumps(record, ensure_ascii=False)
    with (results_dir / AUDIT_FILE).open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
