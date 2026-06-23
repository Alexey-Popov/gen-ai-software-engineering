"""Agent of the pipeline: **Fraud Detector**.

Scores each validated transaction for risk using a transparent rule set and
assigns a ``risk_level`` of ``low`` / ``medium`` / ``high``. High-risk
transactions are flagged for review (``data.flagged = True``).

All thresholds, scores and block-lists come from the ``fraud`` section of the
configurable rule engine (``config/rules.json``); the additive rules are:

    * amount >= very_high_value          -> +60  (very high value)
    * amount >= high_value               -> +40  (high value, reportable)
    * structuring_floor <= amount < high -> +25  (possible structuring)
    * timestamp hour in unusual_hours    -> +20  (unusual timing)
    * country != domestic_country        -> +15  (cross-border)
    * destination in suspicious_accounts -> +40
    * transaction_type == wire_transfer  -> +10
"""

from __future__ import annotations

from typing import Any

from agents import common, rule_engine

AGENT_NAME = "fraud_detector"


def _hour_of(timestamp: str) -> int | None:
    """Extract the hour (0–23) from an ISO timestamp, or None if unparseable."""
    try:
        # Expected form: 2026-03-16T02:47:00Z
        return int(str(timestamp).split("T")[1][:2])
    except (IndexError, ValueError):
        return None


def score_transaction(
    data: dict[str, Any], rules: dict[str, Any] | None = None
) -> tuple[int, list[str]]:
    """Return ``(risk_score, reasons)`` for a transaction's data block.

    Args:
        rules: the ``fraud`` rule section; defaults to the rule engine's config.
    """
    r = rule_engine.section("fraud", rules)
    scores = r["scores"]
    reasons: list[str] = []
    score = 0

    amount = abs(common.parse_amount(data.get("amount", "0")))
    if amount >= common.parse_amount(r["very_high_value"]):
        score += scores["very_high_value"]
        reasons.append("very_high_value")
    elif amount >= common.parse_amount(r["high_value"]):
        score += scores["high_value"]
        reasons.append("high_value")
    elif amount >= common.parse_amount(r["structuring_floor"]):
        score += scores["possible_structuring"]
        reasons.append("possible_structuring")

    hour = _hour_of(data.get("timestamp", ""))
    if hour is not None and hour in set(r["unusual_hours"]):
        score += scores["unusual_timing"]
        reasons.append("unusual_timing")

    domestic = r["domestic_country"]
    country = str(data.get("metadata", {}).get("country", domestic))
    if country != domestic:
        score += scores["cross_border"]
        reasons.append("cross_border")

    if str(data.get("destination_account", "")) in set(r["suspicious_accounts"]):
        score += scores["suspicious_destination"]
        reasons.append("suspicious_destination")

    if str(data.get("transaction_type", "")).lower() == "wire_transfer":
        score += scores["wire_transfer"]
        reasons.append("wire_transfer")

    return score, reasons


def risk_level_for(score: int, rules: dict[str, Any] | None = None) -> str:
    r = rule_engine.section("fraud", rules)
    if score >= r["high_risk_score"]:
        return "high"
    if score >= r["medium_risk_score"]:
        return "medium"
    return "low"


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Score the transaction and tag it with risk metadata."""
    out = common.relabel(message, AGENT_NAME, "compliance_checker")
    score, reasons = score_transaction(out["data"])
    level = risk_level_for(score)
    out["data"]["risk_score"] = score
    out["data"]["risk_level"] = level
    out["data"]["risk_reasons"] = reasons
    out["data"]["flagged"] = level == "high"
    if level == "high":
        out["data"]["status"] = "flagged"
    return out
