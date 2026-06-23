"""Agent of the pipeline: **Policy Agent** (new in homework-7).

Sits right after validation and enforces the institution's *configurable
business policy* — the rules a bank tunes without shipping code. Everything it
checks comes from the ``policy`` section of the rule engine
(``config/rules.json``):

    * ``allowed_currencies``        — currency must be on the list (empty = any)
    * ``max_transaction_amount``    — absolute amount must not exceed the cap
    * ``blocked_countries``         — transaction country must not be sanctioned
    * ``blocked_transaction_types`` — type must not be on the block-list

A transaction that breaks any rule is **rejected** (with a reason) and routed
straight to reporting; otherwise it is marked ``policy_ok`` and passed to the
fraud detector. This agent demonstrates the configurable rule engine end to end.
"""

from __future__ import annotations

from typing import Any

from agents import common, rule_engine

AGENT_NAME = "policy_agent"


def evaluate(data: dict[str, Any], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return policy findings for a transaction's data block.

    Returns a dict with ``policy_status`` (``"policy_ok"`` / ``"rejected"``),
    the list of ``policy_flags`` that tripped, and a human-readable ``reason``
    when rejected.
    """
    r = rule_engine.section("policy", rules)
    allowed_currencies = {c.upper() for c in r.get("allowed_currencies", [])}
    blocked_countries = {c.upper() for c in r.get("blocked_countries", [])}
    blocked_types = {t.lower() for t in r.get("blocked_transaction_types", [])}
    max_amount = common.parse_amount(r["max_transaction_amount"])

    flags: list[str] = []
    reasons: list[str] = []

    currency = str(data.get("currency", "")).upper()
    if allowed_currencies and currency not in allowed_currencies:
        flags.append("CURRENCY_NOT_ALLOWED")
        reasons.append(f"currency '{currency}' is not permitted by policy")

    amount = abs(common.parse_amount(data.get("amount", "0")))
    if amount > max_amount:
        flags.append("AMOUNT_LIMIT_EXCEEDED")
        reasons.append(f"amount {amount} exceeds the policy limit {max_amount}")

    country = str(data.get("metadata", {}).get("country", "")).upper()
    if country in blocked_countries:
        flags.append("COUNTRY_BLOCKED")
        reasons.append(f"country '{country}' is blocked by policy")

    txn_type = str(data.get("transaction_type", "")).lower()
    if txn_type in blocked_types:
        flags.append("TRANSACTION_TYPE_BLOCKED")
        reasons.append(f"transaction type '{txn_type}' is blocked by policy")

    return {
        "policy_flags": flags,
        "policy_status": "rejected" if flags else "policy_ok",
        "reason": "; ".join(reasons) if reasons else None,
    }


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Apply business policy; route violations to reporting."""
    out = common.relabel(message, AGENT_NAME, "fraud_detector")
    findings = evaluate(out["data"])
    out["data"]["policy_flags"] = findings["policy_flags"]
    out["data"]["policy_status"] = findings["policy_status"]

    if findings["policy_status"] == "rejected":
        out["data"]["status"] = "rejected"
        out["data"]["validated"] = False
        out["data"]["reason"] = findings["reason"]
        out["target_agent"] = "reporting_agent"
    return out
