"""End-to-end demo driver — zero manual steps.

Starts the whole agent fleet (the five workers + the policy agent + the master
orchestrator/gateway), then exercises the REST API the way a client would:

    1. POST /api/v1/pipeline/runs        — submit the bundled sample batch
    2. POST /api/v1/transactions         — submit one extra transaction
    3. GET  /api/v1/transactions/{id}    — retrieve that result
    4. GET  /api/v1/pipeline/summary     — retrieve the run summary

Finally it shuts every service down. Invoked by ``demo.sh``; can also be run
directly with ``python demo.py``.
"""

from __future__ import annotations

import sys

import httpx

from agents import rest
from run_services import SERVICE_PORTS, _start_one, _wait_ready

HOST = rest.DEFAULT_HOST
GATEWAY = f"http://{HOST}:{rest.ORCHESTRATOR_PORT}"

DEMO_TRANSACTION = {
    "transaction_id": "TXN-DEMO",
    "timestamp": "2026-03-16T11:00:00Z",
    "source_account": "ACC-1200",
    "destination_account": "ACC-2200",
    "amount": "4200.00",
    "currency": "USD",
    "transaction_type": "transfer",
    "description": "Demo transaction",
    "metadata": {"channel": "api", "country": "US"},
}


def _print_counts(title: str, summary: dict) -> None:
    counts = summary["counts"]
    print(f"\n{title}")
    print(
        f"  total={counts['total']} validated={counts['validated']} "
        f"rejected={counts['rejected']} flagged={counts['flagged']} "
        f"hold={counts['compliance_hold']} settled={counts['settled']}"
    )


def _drive_api() -> None:
    with httpx.Client(timeout=30.0) as client:
        print("\n[1] POST /api/v1/pipeline/runs  (submit bundled samples)")
        run = client.post(f"{GATEWAY}{rest.PIPELINE_RUN_ROUTE}", json={})
        run.raise_for_status()
        _print_counts("Run summary:", run.json())

        print("\n[2] POST /api/v1/transactions  (submit one extra transaction)")
        submit = client.post(f"{GATEWAY}{rest.TRANSACTIONS_ROUTE}", json=DEMO_TRANSACTION)
        submit.raise_for_status()
        data = submit.json()["data"]
        print(
            f"  HTTP {submit.status_code}  Location: {submit.headers.get('Location')}"
        )
        print(
            f"  {data['transaction_id']} -> status={data['status']} "
            f"settled={data.get('settled_amount')} fee={data.get('settlement_fee')}"
        )

        print("\n[3] GET /api/v1/transactions/TXN-DEMO  (retrieve result)")
        got = client.get(f"{GATEWAY}{rest.TRANSACTIONS_ROUTE}/TXN-DEMO")
        got.raise_for_status()
        print(f"  HTTP {got.status_code}  status={got.json()['data']['status']}")

        print("\n[4] GET /api/v1/pipeline/summary  (retrieve summary)")
        summary = client.get(f"{GATEWAY}{rest.PIPELINE_SUMMARY_ROUTE}")
        summary.raise_for_status()
        _print_counts("Latest summary:", summary.json())


def main() -> int:
    print("Starting agent services (workers + policy + orchestrator gateway)...")
    procs = {name: _start_one(name, HOST) for name in SERVICE_PORTS}
    try:
        if not _wait_ready(HOST):
            print("ERROR: services did not become ready.", file=sys.stderr)
            return 1
        print("All services ready.")
        _drive_api()
        print("\nDemo complete. Results are in shared/results/.")
        return 0
    finally:
        print("\nStopping services...")
        for proc in procs.values():
            proc.terminate()
        for proc in procs.values():
            try:
                proc.wait(timeout=5.0)
            except Exception:
                proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
