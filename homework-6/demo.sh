#!/usr/bin/env bash
# One-command end-to-end demo: starts every agent service, submits transactions
# through the REST API gateway, retrieves and displays the results, then shuts
# everything down. Zero manual steps.
#
#   ./demo.sh
#
set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python}"

# Optional: install dependencies first with  DEMO_INSTALL=1 ./demo.sh
if [[ "${DEMO_INSTALL:-0}" == "1" ]]; then
  "$PYTHON" -m pip install -q -r requirements.txt
fi

exec "$PYTHON" demo.py
