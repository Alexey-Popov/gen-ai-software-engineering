"""Agent 1 of the pipeline: **Transaction Validator**.

Checks that each transaction carries the required fields, a well-formed
monetary amount, and a valid ISO 4217 currency. Valid transactions are
marked ``validated`` and passed on; invalid ones are ``rejected`` with a
human-readable reason and never reach the downstream agents.

Run as a script with ``--dry-run`` to validate ``sample-transactions.json``
without writing any files.
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

# Allow running directly as a script (`python agents/transaction_validator.py`)
# by putting the project root on the import path before importing the package.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents import common

AGENT_NAME = "transaction_validator"


def validate(data: dict[str, Any]) -> tuple[bool, str | None]:
    """Return ``(is_valid, reason)`` for a single transaction's data block."""
    missing = [f for f in common.REQUIRED_FIELDS if not data.get(f)]
    if missing:
        return False, f"missing required field(s): {', '.join(missing)}"

    try:
        amount = common.parse_amount(data["amount"])
    except ValueError:
        return False, f"amount is not a valid number: {data['amount']!r}"

    txn_type = str(data["transaction_type"]).lower()
    if txn_type == "refund":
        if amount == Decimal("0"):
            return False, "refund amount must be non-zero"
    elif amount <= Decimal("0"):
        return False, "amount must be greater than zero"

    currency = str(data["currency"]).upper()
    if currency not in common.ISO_4217_CURRENCIES:
        return False, f"currency '{currency}' is not a valid ISO 4217 code"

    return True, None


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Validate the transaction carried by ``message``.

    Returns a new message addressed to the fraud detector. ``data.status`` is
    set to ``validated`` or ``rejected`` (with ``data.reason`` on rejection).
    """
    out = common.relabel(message, AGENT_NAME, "fraud_detector")
    is_valid, reason = validate(out["data"])
    if is_valid:
        out["data"]["status"] = "validated"
        out["data"]["validated"] = True
    else:
        out["data"]["status"] = "rejected"
        out["data"]["validated"] = False
        out["data"]["reason"] = reason
        out["target_agent"] = "reporting_agent"
    return out


# --- CLI dry-run -------------------------------------------------------------

def _load_transactions(path: Path) -> list[dict[str, Any]]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dry_run(path: Path) -> dict[str, Any]:
    """Validate every transaction in ``path`` and return a summary dict."""
    transactions = _load_transactions(path)
    rows: list[dict[str, Any]] = []
    valid = 0
    for txn in transactions:
        ok, reason = validate(txn)
        valid += int(ok)
        rows.append(
            {
                "transaction_id": txn.get("transaction_id", "UNKNOWN"),
                "currency": txn.get("currency", "?"),
                "amount": txn.get("amount", "?"),
                "result": "VALID" if ok else "INVALID",
                "reason": reason or "",
            }
        )
    return {
        "total": len(transactions),
        "valid": valid,
        "invalid": len(transactions) - valid,
        "rows": rows,
    }


def _print_dry_run(summary: dict[str, Any]) -> None:
    print("Transaction Validator - dry run\n")
    print(f"Total:   {summary['total']}")
    print(f"Valid:   {summary['valid']}")
    print(f"Invalid: {summary['invalid']}\n")
    header = f"{'TXN':<8} {'CUR':<5} {'AMOUNT':>12}  {'RESULT':<8} REASON"
    print(header)
    print("-" * len(header))
    for row in summary["rows"]:
        print(
            f"{row['transaction_id']:<8} {row['currency']:<5} "
            f"{str(row['amount']):>12}  {row['result']:<8} {row['reason']}"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Transaction validator")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate sample-transactions.json without processing.",
    )
    parser.add_argument(
        "--input",
        default=str(Path(__file__).resolve().parent.parent / "sample-transactions.json"),
        help="Path to the transactions JSON file.",
    )
    args = parser.parse_args(argv)

    if args.dry_run:
        summary = dry_run(Path(args.input))
        _print_dry_run(summary)
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
