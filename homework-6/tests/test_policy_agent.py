"""Unit tests for the Policy Agent (configurable rule engine)."""

from __future__ import annotations

from agents import policy_agent as pa


def test_clean_transaction_is_allowed(valid_txn):
    findings = pa.evaluate(valid_txn)
    assert findings["policy_status"] == "policy_ok"
    assert findings["policy_flags"] == []
    assert findings["reason"] is None


def test_disallowed_currency_rejected(valid_txn):
    valid_txn["currency"] = "ZAR"  # valid ISO code, but not on the policy allow-list
    findings = pa.evaluate(valid_txn)
    assert findings["policy_status"] == "rejected"
    assert "CURRENCY_NOT_ALLOWED" in findings["policy_flags"]


def test_amount_over_limit_rejected(valid_txn):
    valid_txn["amount"] = "2000000.00"
    findings = pa.evaluate(valid_txn)
    assert "AMOUNT_LIMIT_EXCEEDED" in findings["policy_flags"]


def test_blocked_country_rejected(valid_txn):
    valid_txn["metadata"]["country"] = "IR"
    findings = pa.evaluate(valid_txn)
    assert "COUNTRY_BLOCKED" in findings["policy_flags"]


def test_blocked_transaction_type_uses_override(valid_txn):
    rules = {
        "allowed_currencies": [],
        "max_transaction_amount": "1000000",
        "blocked_countries": [],
        "blocked_transaction_types": ["transfer"],
    }
    findings = pa.evaluate(valid_txn, rules=rules)
    assert "TRANSACTION_TYPE_BLOCKED" in findings["policy_flags"]


def test_process_message_ok_routes_to_fraud(make_message):
    out = pa.process_message(make_message())
    assert out["data"]["policy_status"] == "policy_ok"
    assert out["target_agent"] == "fraud_detector"


def test_process_message_rejected_routes_to_reporting(make_message):
    out = pa.process_message(make_message(currency="ZAR"))
    assert out["data"]["status"] == "rejected"
    assert out["data"]["validated"] is False
    assert "reason" in out["data"]
    assert out["target_agent"] == "reporting_agent"
