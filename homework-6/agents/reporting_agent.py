"""Agent 5 of the pipeline: **Reporting Agent**.

Aggregates the final per-transaction results into a single pipeline summary:
counts by outcome, the list of rejected transactions with reasons, and the
risk-level distribution. The summary is the source of truth for the custom
MCP ``pipeline://summary`` resource.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents import common

AGENT_NAME = "reporting_agent"


def build_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate final transaction messages into a summary dict.

    Args:
        results: final pipeline messages (each with a ``data`` block).
    """
    counts = {
        "total": len(results),
        "validated": 0,
        "rejected": 0,
        "flagged": 0,
        "compliance_hold": 0,
        "settled": 0,
    }
    risk_distribution = {"high": 0, "medium": 0, "low": 0}
    rejected: list[dict[str, str]] = []

    for message in results:
        data = message.get("data", {})
        status = data.get("status")

        if data.get("validated"):
            counts["validated"] += 1
        if status == "rejected":
            counts["rejected"] += 1
            rejected.append(
                {
                    "transaction_id": data.get("transaction_id", "UNKNOWN"),
                    "reason": data.get("reason", "unknown"),
                }
            )
        if data.get("flagged"):
            counts["flagged"] += 1
        if status == "compliance_hold":
            counts["compliance_hold"] += 1
        if status == "settled":
            counts["settled"] += 1

        level = data.get("risk_level")
        if level in risk_distribution:
            risk_distribution[level] += 1

    return {
        "generated_at": common.iso_now(),
        "counts": counts,
        "risk_distribution": risk_distribution,
        "rejected": rejected,
    }


def write_summary(shared_root: Path, summary: dict[str, Any]) -> Path:
    """Write the summary to ``shared/results/pipeline-summary.json``."""
    results_dir = Path(shared_root) / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    path = results_dir / common.SUMMARY_FILE
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def process_message(message: dict[str, Any]) -> dict[str, Any]:
    """Stamp a message as seen by the reporting agent (terminal hop)."""
    out = common.relabel(message, AGENT_NAME, "results")
    return out
