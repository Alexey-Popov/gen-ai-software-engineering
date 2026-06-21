"""Agent 4 of the pipeline: **Settlement Processor**.

Settles transactions that have cleared validation, fraud and compliance.
A transaction is settled only when it is ``validated``, **not** high-risk
(``flagged``) and **not** on ``compliance_hold``. Anything else is left for
review and passes through unchanged.

All money math uses :class:`~decimal.Decimal` with ``ROUND_HALF_UP`` so the
fee and settled amount are deterministic to the cent.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from agents import common

AGENT_NAME = "settlement_processor"

#: Processing fee rate applied to the gross amount (0.1%).
FEE_RATE = Decimal("0.001")
CENTS = Decimal("0.01")


def is_settleable(data: dict[str, Any]) -> bool:
    """A transaction settles only when fully cleared."""
    return (
        bool(data.get("validated"))
        and not bool(data.get("flagged"))
        and data.get("compliance_status") == "compliant"
    )


def compute_settlement(amount: Decimal) -> tuple[Decimal, Decimal]:
    """Return ``(fee, settled_amount)`` for a gross ``amount``.

    The fee is charged on the absolute value (so refunds are also charged),
    rounded half-up to the cent; the settled amount nets the fee out of the
    gross while preserving the original sign of the transaction.
    """
    fee = (abs(amount) * FEE_RATE).quantize(CENTS, rounding=ROUND_HALF_UP)
    settled = (amount - fee).quantize(CENTS, rounding=ROUND_HALF_UP)
    return fee, settled


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Settle a cleared transaction; otherwise leave it for review."""
    out = common.relabel(message, AGENT_NAME, "reporting_agent")
    data = out["data"]

    if not is_settleable(data):
        # Status already reflects the blocking reason (flagged / hold).
        return out

    amount = common.parse_amount(data.get("amount", "0"))
    fee, settled = compute_settlement(amount)
    data["settlement_fee"] = str(fee)
    data["settled_amount"] = str(settled)
    data["currency_settled"] = data.get("currency")
    data["status"] = "settled"
    return out
