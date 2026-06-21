"""Custom FastMCP server: make the banking pipeline queryable.

Exposes the latest pipeline run (the JSON files under ``shared/results/``) to
any MCP client:

* **Tool** ``get_transaction_status(transaction_id)`` — current status of one
  transaction.
* **Tool** ``list_pipeline_results()`` — a one-line summary per processed
  transaction.
* **Resource** ``pipeline://summary`` — the latest run summary as text.

Run with:  python mcp/server.py        (stdio transport)
       or:  fastmcp run mcp/server.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

mcp = FastMCP("pipeline-status")

# shared/ lives next to the homework-6 root, one level up from this file's dir.
BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "shared" / "results"
SUMMARY_FILE = RESULTS_DIR / "pipeline-summary.json"


def _load_result(transaction_id: str) -> dict[str, Any] | None:
    path = RESULTS_DIR / f"{transaction_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _all_results() -> list[dict[str, Any]]:
    if not RESULTS_DIR.exists():
        return []
    results = []
    for path in sorted(RESULTS_DIR.glob("TXN*.json")):
        results.append(json.loads(path.read_text(encoding="utf-8")))
    return results


@mcp.tool
def get_transaction_status(transaction_id: str) -> str:
    """Return the current pipeline status of a single transaction.

    Args:
        transaction_id: e.g. ``"TXN001"``.
    """
    message = _load_result(transaction_id)
    if message is None:
        return f"No result found for transaction '{transaction_id}'. Has the pipeline run?"
    data = message.get("data", {})
    lines = [
        f"Transaction : {data.get('transaction_id', transaction_id)}",
        f"Status      : {data.get('status', 'unknown')}",
        f"Risk level  : {data.get('risk_level', 'n/a')} (score {data.get('risk_score', 'n/a')})",
        f"Flagged     : {data.get('flagged', False)}",
    ]
    if data.get("compliance_flags"):
        lines.append(f"Compliance  : {', '.join(data['compliance_flags'])}")
    if data.get("settled_amount"):
        lines.append(f"Settled     : {data['settled_amount']} {data.get('currency', '')}")
    if data.get("reason"):
        lines.append(f"Reason      : {data['reason']}")
    return "\n".join(lines)


@mcp.tool
def list_pipeline_results() -> str:
    """Return a one-line summary for every processed transaction."""
    results = _all_results()
    if not results:
        return "No pipeline results yet. Run `python integrator.py` first."
    lines = [f"{len(results)} transaction(s) processed:"]
    for message in results:
        data = message.get("data", {})
        lines.append(
            f"  {data.get('transaction_id', '?'):<8} "
            f"{data.get('status', 'unknown'):<16} "
            f"risk={data.get('risk_level', 'n/a')}"
        )
    return "\n".join(lines)


@mcp.resource("pipeline://summary")
def pipeline_summary() -> str:
    """Resource: the latest pipeline run summary as pretty text."""
    if not SUMMARY_FILE.exists():
        return "No pipeline summary available. Run `python integrator.py` first."
    summary = json.loads(SUMMARY_FILE.read_text(encoding="utf-8"))
    counts = summary.get("counts", {})
    risk = summary.get("risk_distribution", {})
    lines = [
        f"Pipeline summary (generated {summary.get('generated_at', 'n/a')})",
        f"  Total       : {counts.get('total', 0)}",
        f"  Validated   : {counts.get('validated', 0)}",
        f"  Rejected    : {counts.get('rejected', 0)}",
        f"  Flagged     : {counts.get('flagged', 0)}",
        f"  On hold     : {counts.get('compliance_hold', 0)}",
        f"  Settled     : {counts.get('settled', 0)}",
        f"  Risk H/M/L  : {risk.get('high', 0)}/{risk.get('medium', 0)}/{risk.get('low', 0)}",
    ]
    for item in summary.get("rejected", []):
        lines.append(f"  Rejected {item.get('transaction_id')}: {item.get('reason')}")
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
