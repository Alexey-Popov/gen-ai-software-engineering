"""Unit tests for the Settlement Processor agent."""

from __future__ import annotations

from decimal import Decimal

from agents import settlement_processor as sp


def _cleared(**overrides):
    data = {
        "validated": True,
        "flagged": False,
        "compliance_status": "compliant",
        "amount": "1500.00",
        "currency": "USD",
    }
    data.update(overrides)
    return data


def test_is_settleable_true():
    assert sp.is_settleable(_cleared()) is True


def test_not_settleable_when_flagged():
    assert sp.is_settleable(_cleared(flagged=True)) is False


def test_not_settleable_when_on_hold():
    assert sp.is_settleable(_cleared(compliance_status="compliance_hold")) is False


def test_not_settleable_when_not_validated():
    assert sp.is_settleable(_cleared(validated=False)) is False


def test_compute_settlement_rounds_half_up():
    fee, settled = sp.compute_settlement(Decimal("1500.00"))
    assert fee == Decimal("1.50")
    assert settled == Decimal("1498.50")


def test_compute_settlement_half_up_edge():
    # 9999.99 * 0.001 = 9.99999 -> rounds half up to 10.00
    fee, settled = sp.compute_settlement(Decimal("9999.99"))
    assert fee == Decimal("10.00")
    assert settled == Decimal("9989.99")


def test_compute_settlement_refund_negative():
    fee, settled = sp.compute_settlement(Decimal("-100.00"))
    assert fee == Decimal("0.10")
    assert settled == Decimal("-100.10")


def test_process_message_settles(make_message):
    msg = make_message(
        validated=True, flagged=False, compliance_status="compliant"
    )
    out = sp.process_message(msg)
    assert out["data"]["status"] == "settled"
    assert out["data"]["settled_amount"] == "1498.50"
    assert out["data"]["settlement_fee"] == "1.50"
    assert out["target_agent"] == "reporting_agent"


def test_process_message_skips_flagged(make_message):
    msg = make_message(validated=True, flagged=True, status="flagged")
    out = sp.process_message(msg)
    assert out["data"]["status"] == "flagged"
    assert "settled_amount" not in out["data"]
