"""Integration test: run the whole pipeline against the bundled samples through
the in-process REST client, in an isolated shared/ directory (never touching the
real one)."""

from __future__ import annotations

import json
from pathlib import Path

from agents import common
import integrator


def _run(tmp_path, sample_transactions, pipeline_client):
    shared = tmp_path / "shared"
    txn_path = tmp_path / "sample-transactions.json"
    txn_path.write_text(json.dumps(sample_transactions), encoding="utf-8")
    summary = integrator.run_pipeline(
        client=pipeline_client, shared_root=shared, transactions_path=txn_path
    )
    return shared, summary


def test_full_pipeline_run(tmp_path, sample_transactions, pipeline_client):
    shared, summary = _run(tmp_path, sample_transactions, pipeline_client)

    # Every transaction produced a result file.
    result_files = list((shared / "results").glob("TXN*.json"))
    assert len(result_files) == len(sample_transactions)

    counts = summary["counts"]
    assert counts["total"] == 8
    assert counts["rejected"] == 1   # TXN006 (XYZ)
    assert counts["flagged"] == 3    # TXN002, TXN003, TXN005
    assert counts["settled"] == 4    # TXN001, TXN004, TXN007, TXN008


def test_rejected_transaction_recorded(tmp_path, sample_transactions, pipeline_client):
    shared, _ = _run(tmp_path, sample_transactions, pipeline_client)

    rejected = json.loads((shared / "results" / "TXN006.json").read_text(encoding="utf-8"))
    assert rejected["data"]["status"] == "rejected"
    assert "XYZ" in rejected["data"]["reason"]


def test_summary_file_written(tmp_path, sample_transactions, pipeline_client):
    shared, _ = _run(tmp_path, sample_transactions, pipeline_client)

    summary_path = shared / "results" / common.SUMMARY_FILE
    assert summary_path.exists()
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary["counts"]["total"] == 8


def test_audit_log_has_no_account_numbers(tmp_path, sample_transactions, pipeline_client):
    shared, _ = _run(tmp_path, sample_transactions, pipeline_client)

    audit = (shared / "results" / common.AUDIT_FILE).read_text(encoding="utf-8")
    assert "ACC-" not in audit  # PII must not leak into the audit trail
    assert "TXN001" in audit


def test_clear_shared(tmp_path):
    shared = tmp_path / "shared"
    paths = common.ensure_shared_dirs(shared)
    (paths["results"] / "stale.json").write_text("{}", encoding="utf-8")
    integrator.clear_shared(shared)
    assert not (shared / "results" / "stale.json").exists()
    assert (shared / "results").is_dir()


def test_load_transactions(tmp_path, sample_transactions):
    path = tmp_path / "t.json"
    path.write_text(json.dumps(sample_transactions), encoding="utf-8")
    loaded = integrator.load_transactions(path)
    assert len(loaded) == 8


def test_main_runs(capsys, monkeypatch, tmp_path, sample_transactions, pipeline_client):
    # Point the integrator's defaults at the isolated tmp dir, and make the
    # default client the in-process REST client (no real servers needed).
    txn_path = tmp_path / "sample-transactions.json"
    txn_path.write_text(json.dumps(sample_transactions), encoding="utf-8")
    monkeypatch.setattr(integrator, "DEFAULT_SHARED", tmp_path / "shared")
    monkeypatch.setattr(integrator, "DEFAULT_TRANSACTIONS", txn_path)
    monkeypatch.setattr(integrator, "default_client", lambda: pipeline_client)

    rc = integrator.main([])
    assert rc == 0
    out = capsys.readouterr().out
    assert "Pipeline summary" in out
    assert "TXN006" in out
