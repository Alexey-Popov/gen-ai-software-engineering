"""Coverage-gate hook for Claude Code.

Registered as a ``PreToolUse`` hook on the ``Bash`` tool. It reads the tool
call from stdin; if the command is a ``git push`` it runs the test-suite with
coverage and **blocks the push** (exit code 2) when total coverage is below the
threshold. Any other command is allowed through untouched (exit code 0).

Threshold: 80% (the assignment's gate). Tests routinely hit ~99%.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

THRESHOLD = 80.0
HOMEWORK_DIR = Path(__file__).resolve().parent.parent.parent  # homework-6/
COVERAGE_JSON = HOMEWORK_DIR / "coverage.json"


def _read_command() -> str:
    """Return the Bash command from the hook payload on stdin (or "")."""
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return ""
    if payload.get("tool_name") != "Bash":
        return ""
    return str(payload.get("tool_input", {}).get("command", ""))


def _measure_coverage() -> float | None:
    """Run pytest with coverage and return total percent covered."""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=str(HOMEWORK_DIR),
        capture_output=True,
        text=True,
    )
    if not COVERAGE_JSON.exists():
        sys.stderr.write(
            "Coverage gate: could not produce coverage.json.\n" + proc.stdout[-2000:]
        )
        return None
    data = json.loads(COVERAGE_JSON.read_text(encoding="utf-8"))
    return float(data["totals"]["percent_covered"])


def main() -> int:
    command = _read_command()
    if "git push" not in command:
        return 0  # not a push — allow

    sys.stderr.write("Coverage gate: running tests before push...\n")
    percent = _measure_coverage()
    if percent is None:
        return 2  # block: tests failed / no coverage produced

    if percent < THRESHOLD:
        sys.stderr.write(
            f"Coverage gate BLOCKED push: coverage {percent:.1f}% is below "
            f"the required {THRESHOLD:.0f}%.\n"
        )
        return 2  # block the push

    sys.stderr.write(
        f"Coverage gate passed: {percent:.1f}% >= {THRESHOLD:.0f}%. Push allowed.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
