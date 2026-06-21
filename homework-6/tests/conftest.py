"""Shared pytest fixtures for the pipeline test-suite."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import pytest

from agents import common


@pytest.fixture
def valid_txn() -> dict[str, Any]:
    """A clean, low-risk, domestic transaction that should settle."""
    return {
        "transaction_id": "TXN100",
        "timestamp": "2026-03-16T09:00:00Z",
        "source_account": "ACC-1001",
        "destination_account": "ACC-2001",
        "amount": "1500.00",
        "currency": "USD",
        "transaction_type": "transfer",
        "description": "Test payment",
        "metadata": {"channel": "online", "country": "US"},
    }


@pytest.fixture
def make_message(valid_txn) -> Callable[..., dict[str, Any]]:
    """Factory: build a pipeline message, optionally overriding data fields."""

    def _make(source="integrator", target="transaction_validator", **overrides):
        data = dict(valid_txn)
        data.update(overrides)
        return common.new_message(source, target, data)

    return _make


@pytest.fixture
def sample_transactions() -> list[dict[str, Any]]:
    """The eight bundled sample transactions."""
    path = Path(__file__).resolve().parent.parent / "sample-transactions.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def shared_root(tmp_path) -> Path:
    """An isolated shared/ channel rooted in pytest's tmp_path."""
    root = tmp_path / "shared"
    common.ensure_shared_dirs(root)
    return root
