"""Launch the five agent REST services as separate processes.

Each agent is served by its own uvicorn process (``python -m agents.rest
<agent>``) on its configured port. The script waits until every service reports
ready on ``/health/ready``, then blocks until interrupted (Ctrl+C), at which
point it shuts the whole fleet down.

Usage::

    python run_services.py            # start all five, then keep them running
    python run_services.py --host 0.0.0.0
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from typing import Any

import httpx

from agents import rest


#: All services to launch: the five workers plus the master agent (orchestrator).
SERVICE_PORTS: dict[str, int] = {
    **{name: port for name, (_module, _route, port) in rest.SERVICES.items()},
    "orchestrator": rest.ORCHESTRATOR_PORT,
}


def _start_one(agent_name: str, host: str) -> subprocess.Popen[Any]:
    return subprocess.Popen(
        [sys.executable, "-m", "agents.rest", agent_name, "--host", host],
        cwd=str(__import__("pathlib").Path(__file__).resolve().parent),
    )


def _wait_ready(host: str, timeout: float = 20.0) -> bool:
    deadline = time.monotonic() + timeout
    pending = dict(SERVICE_PORTS)
    with httpx.Client(timeout=1.0) as client:
        while pending and time.monotonic() < deadline:
            for name in list(pending):
                port = pending[name]
                try:
                    resp = client.get(f"http://{host}:{port}/health/ready")
                    if resp.status_code == 200:
                        print(f"  ready: {name} (:{port})")
                        del pending[name]
                except httpx.HTTPError:
                    pass
            if pending:
                time.sleep(0.3)
    return not pending


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run all agent REST services.")
    parser.add_argument("--host", default=rest.DEFAULT_HOST)
    args = parser.parse_args(argv)

    print("Starting agent services...")
    procs = {name: _start_one(name, args.host) for name in SERVICE_PORTS}

    if not _wait_ready(args.host):
        print("ERROR: not all services became ready; shutting down.", file=sys.stderr)
        for proc in procs.values():
            proc.terminate()
        return 1

    print("\nAll services ready. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nStopping services...")
    finally:
        for proc in procs.values():
            proc.terminate()
        for proc in procs.values():
            try:
                proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                proc.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
