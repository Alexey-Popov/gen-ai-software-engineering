"""Integrator / orchestrator for the multi-agent banking pipeline.

Responsibilities:
    1. Create the ``shared/{input,processing,output,results}`` channel.
    2. Load ``sample-transactions.json`` and wrap each record in a message.
    3. Drive every message through the agent chain, moving the JSON file
       ``input -> processing -> output`` at each hop and writing the final
       outcome to ``shared/results/<transaction_id>.json``.
    4. Run the reporting agent to produce ``shared/results/pipeline-summary.json``.

Run with::

    python integrator.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any

from agents import (
    common,
    compliance_checker,
    fraud_detector,
    reporting_agent,
    settlement_processor,
    transaction_validator,
)

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SHARED = BASE_DIR / "shared"
DEFAULT_TRANSACTIONS = BASE_DIR / "sample-transactions.json"

#: Ordered processing stages (the reporting agent is run separately at the end).
STAGES = [
    transaction_validator,
    fraud_detector,
    compliance_checker,
    settlement_processor,
]


def clear_shared(shared_root: Path) -> None:
    """Remove and recreate the shared channel for a clean run."""
    shared_root = Path(shared_root)
    if shared_root.exists():
        shutil.rmtree(shared_root)
    common.ensure_shared_dirs(shared_root)


def load_transactions(path: Path) -> list[dict[str, Any]]:
    """Load raw transactions from ``path`` (a JSON array)."""
    import json

    return json.loads(Path(path).read_text(encoding="utf-8"))


def process_transaction(
    shared_root: Path, paths: dict[str, Path], txn: dict[str, Any]
) -> dict[str, Any]:
    """Run one transaction through the full agent chain.

    Returns the final message that was written to ``results/``.
    """
    txn_id = txn.get("transaction_id", "UNKNOWN")
    message = common.new_message("integrator", "transaction_validator", txn)
    current_path = common.write_message(paths["input"], message, f"{txn_id}.json")

    for stage in STAGES:
        proc_path = common.move_message(current_path, paths["processing"])
        message = common.read_message(proc_path)
        message = stage.process_message(message)
        current_path = common.write_message(paths["output"], message, f"{txn_id}.json")
        proc_path.unlink(missing_ok=True)
        common.append_audit(
            shared_root, stage.AGENT_NAME, txn_id, message["data"].get("status", "unknown")
        )
        if message.get("target_agent") == "reporting_agent" and message["data"].get(
            "status"
        ) in {"rejected", "compliance_hold"}:
            break

    final = reporting_agent.process_message(message)
    common.write_message(paths["results"], final, f"{txn_id}.json")
    common.append_audit(
        shared_root, reporting_agent.AGENT_NAME, txn_id, final["data"].get("status", "unknown")
    )
    # Clean the intermediate output file now that the result is final.
    (paths["output"] / f"{txn_id}.json").unlink(missing_ok=True)
    return final


def run_pipeline(
    shared_root: Path | None = None,
    transactions_path: Path | None = None,
) -> dict[str, Any]:
    """Run the entire pipeline and return the summary dict."""
    shared_root = Path(shared_root if shared_root is not None else DEFAULT_SHARED)
    transactions_path = Path(
        transactions_path if transactions_path is not None else DEFAULT_TRANSACTIONS
    )
    clear_shared(shared_root)
    paths = common.ensure_shared_dirs(shared_root)

    transactions = load_transactions(transactions_path)
    finals = [process_transaction(shared_root, paths, txn) for txn in transactions]

    summary = reporting_agent.build_summary(finals)
    reporting_agent.write_summary(shared_root, summary)
    return summary


def _print_summary(summary: dict[str, Any]) -> None:
    counts = summary["counts"]
    risk = summary["risk_distribution"]
    print("\n=== Pipeline summary ===")
    print(f"Generated at : {summary['generated_at']}")
    print(f"Total        : {counts['total']}")
    print(f"Validated    : {counts['validated']}")
    print(f"Rejected     : {counts['rejected']}")
    print(f"Flagged      : {counts['flagged']}")
    print(f"On hold      : {counts['compliance_hold']}")
    print(f"Settled      : {counts['settled']}")
    print(f"Risk (H/M/L) : {risk['high']}/{risk['medium']}/{risk['low']}")
    if summary["rejected"]:
        print("\nRejected transactions:")
        for item in summary["rejected"]:
            print(f"  - {item['transaction_id']}: {item['reason']}")
    print("\nResults written to shared/results/")


def main(argv: list[str] | None = None) -> int:
    summary = run_pipeline()
    _print_summary(summary)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
