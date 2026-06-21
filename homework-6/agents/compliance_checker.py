"""Agent 3 of the pipeline: **Compliance Checker**.

Applies regulatory-style rules to each transaction:

    * **Blocked accounts** — a source/destination on the blocklist places the
      transaction on ``compliance_hold``.
    * **CTR reporting** — amounts at or above $10,000 require a currency
      transaction report (``requires_reporting = True``); this is informational,
      not a hold.
    * **Wire limit** — wire transfers at or above $50,000 exceed the
      auto-clear limit and go on ``compliance_hold`` for manual review.

A transaction with no blocking flag is marked ``compliant``.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from agents import common

AGENT_NAME = "compliance_checker"

REPORTING_THRESHOLD = Decimal("10000")
WIRE_AUTOCLEAR_LIMIT = Decimal("50000")

#: Accounts blocked by compliance (sanctions / fraud demo list).
BLOCKED_ACCOUNTS: frozenset[str] = frozenset({"ACC-9999"})


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    """Return compliance findings for a transaction's data block."""
    flags: list[str] = []
    requires_reporting = False
    hold = False

    amount = abs(common.parse_amount(data.get("amount", "0")))
    source = str(data.get("source_account", ""))
    destination = str(data.get("destination_account", ""))
    txn_type = str(data.get("transaction_type", "")).lower()

    if source in BLOCKED_ACCOUNTS or destination in BLOCKED_ACCOUNTS:
        flags.append("BLOCKED_ACCOUNT")
        hold = True

    if amount >= REPORTING_THRESHOLD:
        flags.append("CTR_REPORTING_REQUIRED")
        requires_reporting = True

    if txn_type == "wire_transfer" and amount >= WIRE_AUTOCLEAR_LIMIT:
        flags.append("WIRE_LIMIT_EXCEEDED")
        hold = True

    return {
        "compliance_flags": flags,
        "requires_reporting": requires_reporting,
        "compliance_status": "compliance_hold" if hold else "compliant",
    }


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Attach compliance findings; route held transactions to reporting."""
    out = common.relabel(message, AGENT_NAME, "settlement_processor")
    findings = evaluate(out["data"])
    out["data"].update(findings)
    if findings["compliance_status"] == "compliance_hold":
        out["data"]["status"] = "compliance_hold"
        out["target_agent"] = "reporting_agent"
    return out
