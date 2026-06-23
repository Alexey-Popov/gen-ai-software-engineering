"""Master agent: the **orchestrator**.

This is the only agent that knows the *shape* of the pipeline. It drives each
transaction through the five worker agents over HTTP and persists the outcome —
but it contains **no banking business logic** of its own. Validation, fraud
scoring, compliance, settlement and reporting all live in their own services;
the orchestrator just routes messages and records what happened. See
``rules/orchestrator.md`` for the governing rule.

Routing is message-driven: the orchestrator POSTs to the validator, then keeps
POSTing to whichever agent the reply's ``target_agent`` points at, until the
chain reaches the reporting agent. Rejections and compliance holds therefore
short-circuit the chain on their own, without the orchestrator special-casing
them.

The orchestrator is transport-agnostic: it talks to the workers through a
*pipeline client* (``process`` / ``summary`` / ``close``), so the same logic
runs over real HTTP (:class:`agents.client.HttpPipelineClient`) or in-process
for tests (:class:`agents.client.InProcessPipelineClient`).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from agents import common, reporting_agent

AGENT_NAME = "orchestrator"

#: Where the chain starts and where it ends.
ENTRY_AGENT = "transaction_validator"
TERMINAL_AGENT = "reporting_agent"


def clear_shared(shared_root: Path) -> None:
    """Remove and recreate the shared results sink for a clean run."""
    shared_root = Path(shared_root)
    if shared_root.exists():
        shutil.rmtree(shared_root)
    common.ensure_shared_dirs(shared_root)


def load_transactions(path: Path) -> list[dict[str, Any]]:
    """Load raw transactions from ``path`` (a JSON array)."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def process_transaction(
    client: Any, shared_root: Path, results_dir: Path, txn: dict[str, Any]
) -> dict[str, Any]:
    """Run one transaction through the full agent chain over HTTP.

    Returns the final message that was written to ``results/``.
    """
    txn_id = txn.get("transaction_id", "UNKNOWN")
    message = common.new_message(AGENT_NAME, ENTRY_AGENT, txn)

    current = ENTRY_AGENT
    while current != TERMINAL_AGENT:
        message = client.process(current, message)
        common.append_audit(
            shared_root, current, txn_id, message["data"].get("status", "unknown")
        )
        current = message.get("target_agent", TERMINAL_AGENT)

    final = client.process(TERMINAL_AGENT, message)
    common.append_audit(
        shared_root, TERMINAL_AGENT, txn_id, final["data"].get("status", "unknown")
    )
    common.write_message(results_dir, final, f"{txn_id}.json")
    return final


def process_one(client: Any, shared_root: Path, txn: dict[str, Any]) -> dict[str, Any]:
    """Run a single transaction through the chain without clearing prior results.

    Used by the API gateway's submit-one endpoint so individually submitted
    transactions accumulate in ``shared/results`` instead of wiping the sink.
    """
    shared_root = Path(shared_root)
    results_dir = common.ensure_shared_dirs(shared_root)["results"]
    return process_transaction(client, shared_root, results_dir, txn)


def run_pipeline(
    client: Any, transactions: list[dict[str, Any]], shared_root: Path
) -> dict[str, Any]:
    """Drive every transaction through the chain and return the run summary.

    The caller owns the ``client`` lifecycle (the orchestrator never closes a
    client it did not create).
    """
    shared_root = Path(shared_root)
    clear_shared(shared_root)
    results_dir = common.ensure_shared_dirs(shared_root)["results"]

    finals = [
        process_transaction(client, shared_root, results_dir, txn)
        for txn in transactions
    ]
    summary = client.summary(finals)
    reporting_agent.write_summary(shared_root, summary)
    return summary
