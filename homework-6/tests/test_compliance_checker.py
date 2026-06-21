"""Unit tests for the Compliance Checker agent."""

from __future__ import annotations

from agents import compliance_checker as cc


def test_clean_transaction_is_compliant(valid_txn):
    findings = cc.evaluate(valid_txn)
    assert findings["compliance_status"] == "compliant"
    assert findings["compliance_flags"] == []
    assert findings["requires_reporting"] is False


def test_blocked_destination_holds(valid_txn):
    valid_txn["destination_account"] = "ACC-9999"
    findings = cc.evaluate(valid_txn)
    assert findings["compliance_status"] == "compliance_hold"
    assert "BLOCKED_ACCOUNT" in findings["compliance_flags"]


def test_blocked_source_holds(valid_txn):
    valid_txn["source_account"] = "ACC-9999"
    findings = cc.evaluate(valid_txn)
    assert "BLOCKED_ACCOUNT" in findings["compliance_flags"]


def test_reporting_threshold(valid_txn):
    valid_txn["amount"] = "10000.00"
    findings = cc.evaluate(valid_txn)
    assert findings["requires_reporting"] is True
    assert "CTR_REPORTING_REQUIRED" in findings["compliance_flags"]
    # Reporting alone is not a hold.
    assert findings["compliance_status"] == "compliant"


def test_wire_limit_exceeded_holds(valid_txn):
    valid_txn["transaction_type"] = "wire_transfer"
    valid_txn["amount"] = "75000.00"
    findings = cc.evaluate(valid_txn)
    assert "WIRE_LIMIT_EXCEEDED" in findings["compliance_flags"]
    assert findings["compliance_status"] == "compliance_hold"


def test_process_message_compliant_routes_to_settlement(make_message):
    out = cc.process_message(make_message())
    assert out["data"]["compliance_status"] == "compliant"
    assert out["target_agent"] == "settlement_processor"


def test_process_message_hold_routes_to_reporting(make_message):
    out = cc.process_message(make_message(destination_account="ACC-9999"))
    assert out["data"]["status"] == "compliance_hold"
    assert out["target_agent"] == "reporting_agent"
