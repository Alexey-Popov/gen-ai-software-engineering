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

from typing import Any

from agents import common, rule_engine

AGENT_NAME = "compliance_checker"


def evaluate(data: dict[str, Any], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return compliance findings for a transaction's data block.

    Args:
        rules: the ``compliance`` rule section; defaults to the engine's config.
    """
    r = rule_engine.section("compliance", rules)
    reporting_threshold = common.parse_amount(r["reporting_threshold"])
    wire_autoclear_limit = common.parse_amount(r["wire_autoclear_limit"])
    blocked_accounts = set(r["blocked_accounts"])

    flags: list[str] = []
    requires_reporting = False
    hold = False

    amount = abs(common.parse_amount(data.get("amount", "0")))
    source = str(data.get("source_account", ""))
    destination = str(data.get("destination_account", ""))
    txn_type = str(data.get("transaction_type", "")).lower()

    if source in blocked_accounts or destination in blocked_accounts:
        flags.append("BLOCKED_ACCOUNT")
        hold = True

    if amount >= reporting_threshold:
        flags.append("CTR_REPORTING_REQUIRED")
        requires_reporting = True

    if txn_type == "wire_transfer" and amount >= wire_autoclear_limit:
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
