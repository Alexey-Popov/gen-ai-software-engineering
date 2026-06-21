"""Unit tests for shared utilities."""

from __future__ import annotations

import json
from decimal import Decimal

import pytest

from agents import common


def test_iso_now_format():
    value = common.iso_now()
    assert value.endswith("Z")
    assert len(value) == 20  # YYYY-MM-DDTHH:MM:SSZ


def test_parse_amount_uses_decimal():
    assert common.parse_amount("1500.00") == Decimal("1500.00")
    assert common.parse_amount("-100.00") == Decimal("-100.00")


def test_parse_amount_invalid_raises():
    with pytest.raises(ValueError):
        common.parse_amount("not-a-number")


def test_new_message_envelope(valid_txn):
    msg = common.new_message("a", "b", valid_txn)
    assert msg["source_agent"] == "a"
    assert msg["target_agent"] == "b"
    assert msg["message_type"] == "transaction"
    assert msg["data"]["transaction_id"] == "TXN100"
    assert msg["message_id"]  # non-empty uuid


def test_relabel_restamps_and_copies(make_message):
    original = make_message()
    out = common.relabel(original, "x", "y")
    assert out["source_agent"] == "x"
    assert out["target_agent"] == "y"
    out["data"]["status"] = "mutated"
    assert "status" not in original["data"]  # data was copied, not shared


def test_transaction_id_of_default():
    assert common.transaction_id_of({"data": {}}) == "UNKNOWN"


def test_ensure_shared_dirs_creates_all(tmp_path):
    paths = common.ensure_shared_dirs(tmp_path / "shared")
    for name in common.SHARED_SUBDIRS:
        assert paths[name].is_dir()


def test_write_read_move_message(tmp_path, make_message):
    paths = common.ensure_shared_dirs(tmp_path / "shared")
    msg = make_message()
    path = common.write_message(paths["input"], msg, "TXN100.json")
    assert path.exists()
    loaded = common.read_message(path)
    assert loaded["data"]["transaction_id"] == "TXN100"

    moved = common.move_message(path, paths["processing"])
    assert moved.parent.name == "processing"
    assert not path.exists()

    # Moving onto an existing file overwrites it.
    again = common.write_message(paths["input"], msg, "TXN100.json")
    moved2 = common.move_message(again, paths["processing"])
    assert moved2.exists()


def test_mask_account():
    assert common.mask_account("ACC-1001") == "****01"
    assert common.mask_account("X") == "****"


def test_append_audit_writes_no_pii(tmp_path, valid_txn):
    common.append_audit(tmp_path, "validator", "TXN100", "validated")
    common.append_audit(tmp_path, "fraud_detector", "TXN100", "flagged")
    log = (tmp_path / "results" / common.AUDIT_FILE).read_text(encoding="utf-8")
    lines = [json.loads(line) for line in log.splitlines()]
    assert len(lines) == 2
    assert lines[0]["agent"] == "validator"
    # The audit record must never contain account numbers.
    assert "ACC-1001" not in log
    assert valid_txn["source_account"] not in log
