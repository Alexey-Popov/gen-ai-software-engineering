"""Agent 2 of the pipeline: **Fraud Detector**.

Scores each validated transaction for risk using a transparent rule set and
assigns a ``risk_level`` of ``low`` / ``medium`` / ``high``. High-risk
transactions are flagged for review (``data.flagged = True``).

Rules (additive score):
    * amount >= 50,000           -> +60  (very high value)
    * amount >= 10,000           -> +40  (high value, reportable)
    * 9,000 <= amount < 10,000   -> +25  (possible structuring under the CTR threshold)
    * timestamp hour in 0..5     -> +20  (unusual timing)
    * country != US              -> +15  (cross-border)
    * destination is suspicious  -> +40
    * transaction_type == wire   -> +10
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from agents import common

AGENT_NAME = "fraud_detector"

HIGH_VALUE_THRESHOLD = Decimal("10000")
VERY_HIGH_VALUE_THRESHOLD = Decimal("50000")
STRUCTURING_FLOOR = Decimal("9000")
UNUSUAL_HOURS = range(0, 6)  # 00:00–05:59 local-naive UTC

#: Accounts known to be suspicious (demo blocklist).
SUSPICIOUS_ACCOUNTS: frozenset[str] = frozenset({"ACC-9999"})

HIGH_RISK_SCORE = 40
MEDIUM_RISK_SCORE = 20


def _hour_of(timestamp: str) -> int | None:
    """Extract the hour (0–23) from an ISO timestamp, or None if unparseable."""
    try:
        # Expected form: 2026-03-16T02:47:00Z
        return int(str(timestamp).split("T")[1][:2])
    except (IndexError, ValueError):
        return None


def score_transaction(data: dict[str, Any]) -> tuple[int, list[str]]:
    """Return ``(risk_score, reasons)`` for a transaction's data block."""
    reasons: list[str] = []
    score = 0

    amount = abs(common.parse_amount(data.get("amount", "0")))
    if amount >= VERY_HIGH_VALUE_THRESHOLD:
        score += 60
        reasons.append("very_high_value")
    elif amount >= HIGH_VALUE_THRESHOLD:
        score += 40
        reasons.append("high_value")
    elif amount >= STRUCTURING_FLOOR:
        score += 25
        reasons.append("possible_structuring")

    hour = _hour_of(data.get("timestamp", ""))
    if hour is not None and hour in UNUSUAL_HOURS:
        score += 20
        reasons.append("unusual_timing")

    country = str(data.get("metadata", {}).get("country", common.DOMESTIC_COUNTRY))
    if country != common.DOMESTIC_COUNTRY:
        score += 15
        reasons.append("cross_border")

    if str(data.get("destination_account", "")) in SUSPICIOUS_ACCOUNTS:
        score += 40
        reasons.append("suspicious_destination")

    if str(data.get("transaction_type", "")).lower() == "wire_transfer":
        score += 10
        reasons.append("wire_transfer")

    return score, reasons


def risk_level_for(score: int) -> str:
    if score >= HIGH_RISK_SCORE:
        return "high"
    if score >= MEDIUM_RISK_SCORE:
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
