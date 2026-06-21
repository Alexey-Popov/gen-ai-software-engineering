"""Unit tests for the Fraud Detector agent."""

from __future__ import annotations

from agents import fraud_detector as fd


def test_low_risk_clean_transaction(valid_txn):
    score, reasons = fd.score_transaction(valid_txn)
    assert score == 0
    assert reasons == []
    assert fd.risk_level_for(score) == "low"


def test_high_value_is_flagged(valid_txn):
    valid_txn["amount"] = "25000.00"
    score, reasons = fd.score_transaction(valid_txn)
    assert "high_value" in reasons
    assert fd.risk_level_for(score) == "high"


def test_very_high_value(valid_txn):
    valid_txn["amount"] = "75000.00"
    score, reasons = fd.score_transaction(valid_txn)
    assert "very_high_value" in reasons
    assert score >= 60


def test_structuring_just_under_threshold(valid_txn):
    valid_txn["amount"] = "9999.99"
    _, reasons = fd.score_transaction(valid_txn)
    assert "possible_structuring" in reasons


def test_unusual_timing(valid_txn):
    valid_txn["timestamp"] = "2026-03-16T02:47:00Z"
    _, reasons = fd.score_transaction(valid_txn)
    assert "unusual_timing" in reasons


def test_unparseable_timestamp_is_ignored(valid_txn):
    valid_txn["timestamp"] = "not-a-timestamp"
    _, reasons = fd.score_transaction(valid_txn)
    assert "unusual_timing" not in reasons


def test_cross_border(valid_txn):
    valid_txn["metadata"]["country"] = "DE"
    _, reasons = fd.score_transaction(valid_txn)
    assert "cross_border" in reasons


def test_suspicious_destination(valid_txn):
    valid_txn["destination_account"] = "ACC-9999"
    _, reasons = fd.score_transaction(valid_txn)
    assert "suspicious_destination" in reasons


def test_wire_transfer_adds_score(valid_txn):
    valid_txn["transaction_type"] = "wire_transfer"
    _, reasons = fd.score_transaction(valid_txn)
    assert "wire_transfer" in reasons


def test_refund_uses_absolute_value(valid_txn):
    valid_txn["transaction_type"] = "refund"
    valid_txn["amount"] = "-25000.00"
    _, reasons = fd.score_transaction(valid_txn)
    assert "high_value" in reasons


def test_risk_levels():
    assert fd.risk_level_for(70) == "high"
    assert fd.risk_level_for(40) == "high"
    assert fd.risk_level_for(25) == "medium"
    assert fd.risk_level_for(10) == "low"


def test_process_message_sets_metadata(make_message):
    out = fd.process_message(make_message(amount="25000.00"))
    assert out["data"]["risk_level"] == "high"
    assert out["data"]["flagged"] is True
    assert out["data"]["status"] == "flagged"
    assert out["target_agent"] == "compliance_checker"


def test_process_message_low_risk_not_flagged(make_message):
    out = fd.process_message(make_message())
    assert out["data"]["flagged"] is False
    assert "status" not in out["data"]  # validator-set status untouched here
