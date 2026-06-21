"""Unit tests for the Transaction Validator agent."""

from __future__ import annotations

from pathlib import Path

from agents import transaction_validator as tv


def test_valid_transaction_passes(valid_txn):
    ok, reason = tv.validate(valid_txn)
    assert ok is True
    assert reason is None


def test_missing_field_rejected(valid_txn):
    del valid_txn["currency"]
    ok, reason = tv.validate(valid_txn)
    assert ok is False
    assert "currency" in reason


def test_invalid_currency_rejected(valid_txn):
    valid_txn["currency"] = "XYZ"
    ok, reason = tv.validate(valid_txn)
    assert ok is False
    assert "ISO 4217" in reason


def test_non_numeric_amount_rejected(valid_txn):
    valid_txn["amount"] = "abc"
    ok, reason = tv.validate(valid_txn)
    assert ok is False
    assert "valid number" in reason


def test_zero_amount_rejected(valid_txn):
    valid_txn["amount"] = "0.00"
    ok, reason = tv.validate(valid_txn)
    assert ok is False
    assert "greater than zero" in reason


def test_negative_amount_rejected_for_transfer(valid_txn):
    valid_txn["amount"] = "-50.00"
    ok, reason = tv.validate(valid_txn)
    assert ok is False


def test_negative_refund_allowed(valid_txn):
    valid_txn["transaction_type"] = "refund"
    valid_txn["amount"] = "-100.00"
    ok, reason = tv.validate(valid_txn)
    assert ok is True


def test_zero_refund_rejected(valid_txn):
    valid_txn["transaction_type"] = "refund"
    valid_txn["amount"] = "0"
    ok, reason = tv.validate(valid_txn)
    assert ok is False
    assert "non-zero" in reason


def test_process_message_valid_routes_to_fraud(make_message):
    out = tv.process_message(make_message())
    assert out["data"]["status"] == "validated"
    assert out["data"]["validated"] is True
    assert out["target_agent"] == "fraud_detector"


def test_process_message_rejected_routes_to_reporting(make_message):
    out = tv.process_message(make_message(currency="XYZ"))
    assert out["data"]["status"] == "rejected"
    assert out["data"]["validated"] is False
    assert "reason" in out["data"]
    assert out["target_agent"] == "reporting_agent"


def test_dry_run_summary(sample_transactions, tmp_path):
    path = Path(__file__).resolve().parent.parent / "sample-transactions.json"
    summary = tv.dry_run(path)
    assert summary["total"] == 8
    assert summary["valid"] == 7
    assert summary["invalid"] == 1
    invalid = [r for r in summary["rows"] if r["result"] == "INVALID"]
    assert invalid[0]["transaction_id"] == "TXN006"


def test_cli_dry_run(capsys):
    rc = tv.main(["--dry-run"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "Total:" in out
    assert "TXN006" in out


def test_cli_no_args_prints_help(capsys):
    rc = tv.main([])
    assert rc == 0
    out = capsys.readouterr().out
    assert "dry-run" in out
