"""Unit tests for the configurable rule engine."""

from __future__ import annotations

import json

from agents import rule_engine


def test_default_rules_have_all_sections():
    rules = rule_engine.get_rules()
    for name in ("policy", "fraud", "compliance", "settlement"):
        assert name in rules


def test_section_returns_default_slice():
    fraud = rule_engine.section("fraud")
    assert fraud["high_value"] == "10000"
    assert "scores" in fraud


def test_section_override_is_returned_verbatim():
    override = {"high_value": "1"}
    assert rule_engine.section("fraud", override) is override


def test_load_rules_from_custom_path(tmp_path):
    path = tmp_path / "rules.json"
    path.write_text(json.dumps({"policy": {"max_transaction_amount": "5"}}), encoding="utf-8")
    rules = rule_engine.load_rules(path)
    assert rules["policy"]["max_transaction_amount"] == "5"


def test_reset_cache_reloads(monkeypatch):
    rule_engine.reset_cache()
    first = rule_engine.get_rules()
    # Cached: the same object is returned until reset.
    assert rule_engine.get_rules() is first
    rule_engine.reset_cache()
    assert rule_engine.get_rules() is not first
