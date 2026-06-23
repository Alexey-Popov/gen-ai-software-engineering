"""CLI entry point for the multi-agent banking pipeline.

The orchestration itself lives in the **master agent**
(:mod:`agents.orchestrator`); this module is the thin command-line front end
that loads the bundled transactions, hands them to the master agent over an
HTTP pipeline client, and prints the resulting summary.

The five worker agents and the orchestrator run as REST services — start them
first with ``run_services.py``::

    python run_services.py        # terminal 1: start the agent services
    python integrator.py          # terminal 2: drive the pipeline

``run_pipeline`` / ``clear_shared`` / ``load_transactions`` are re-exported from
the master agent so existing callers and tests keep working.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from agents import orchestrator
from agents.client import HttpPipelineClient
# Re-exported for backward compatibility (tests and external callers).
from agents.orchestrator import clear_shared, load_transactions  # noqa: F401

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SHARED = BASE_DIR / "shared"
DEFAULT_TRANSACTIONS = BASE_DIR / "sample-transactions.json"


def default_client() -> HttpPipelineClient:  # pragma: no cover - real network
    """Create the production HTTP client (the tests inject their own)."""
    return HttpPipelineClient()


def run_pipeline(
    client: Any | None = None,
    shared_root: Path | None = None,
    transactions_path: Path | None = None,
) -> dict[str, Any]:
    """Load transactions and run them through the master agent.

    Args:
        client: a pipeline client (``process``/``summary``/``close``). When
            ``None``, the production HTTP client is created and closed here.
    """
    shared_root = Path(shared_root if shared_root is not None else DEFAULT_SHARED)
    transactions_path = Path(
        transactions_path if transactions_path is not None else DEFAULT_TRANSACTIONS
    )
    transactions = load_transactions(transactions_path)

    owns_client = client is None
    client = client or default_client()
    try:
        return orchestrator.run_pipeline(client, transactions, shared_root)
    finally:
        if owns_client:
            client.close()


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
