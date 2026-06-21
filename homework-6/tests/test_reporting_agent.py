"""Unit tests for the Reporting Agent."""

from __future__ import annotations

import json

from agents import common, reporting_agent as ra


def _msg(**data):
    return {"data": data}


def test_build_summary_counts():
    results = [
        _msg(validated=True, status="settled", risk_level="low"),
        _msg(validated=True, status="flagged", flagged=True, risk_level="high"),
        _msg(validated=True, status="compliance_hold", risk_level="high"),
        _msg(validated=False, status="rejected", reason="bad currency",
             transaction_id="TXN006"),
    ]
    summary = ra.build_summary(results)
    counts = summary["counts"]
    assert counts["total"] == 4
    assert counts["validated"] == 3
    assert counts["rejected"] == 1
    assert counts["flagged"] == 1
    assert counts["compliance_hold"] == 1
    assert counts["settled"] == 1
    assert summary["risk_distribution"] == {"high": 2, "medium": 0, "low": 1}
    assert summary["rejected"][0]["transaction_id"] == "TXN006"
    assert "generated_at" in summary


def test_build_summary_empty():
    summary = ra.build_summary([])
    assert summary["counts"]["total"] == 0
    assert summary["rejected"] == []


def test_write_summary(tmp_path):
    summary = ra.build_summary([_msg(validated=True, status="settled", risk_level="low")])
    path = ra.write_summary(tmp_path, summary)
    assert path.name == common.SUMMARY_FILE
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded["counts"]["settled"] == 1


def test_process_message_terminal(make_message):
    out = ra.process_message(make_message())
    assert out["source_agent"] == "reporting_agent"
    assert out["target_agent"] == "results"
