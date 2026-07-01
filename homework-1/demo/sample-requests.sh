#!/usr/bin/env bash
# Seeds sample data and exercises every endpoint using curl.
# Prerequisite: the API must already be running (e.g. `npm run start:prod`).
# Usage: ./demo/sample-requests.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

hr() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

hr "Seeding transactions from sample-data.json"
# Requires python3 (ships with macOS) to iterate over the JSON array.
python3 - "$BASE_URL" "$SCRIPT_DIR/sample-data.json" <<'PY'
import json, subprocess, sys
base, path = sys.argv[1], sys.argv[2]
for tx in json.load(open(path)):
    subprocess.run([
        "curl", "-s", "-X", "POST", f"{base}/transactions",
        "-H", "Content-Type: application/json", "-d", json.dumps(tx),
    ])
    print()
PY

hr "All transactions"
curl -s "$BASE_URL/transactions"; echo

hr "Filter: transfers only"
curl -s "$BASE_URL/transactions?type=transfer"; echo

hr "Balance ACC-12345"
curl -s "$BASE_URL/accounts/ACC-12345/balance"; echo

hr "Summary ACC-12345 (Task 4A)"
curl -s "$BASE_URL/accounts/ACC-12345/summary"; echo

hr "Interest ACC-12345 rate=0.05 days=30 (Task 4B)"
curl -s "$BASE_URL/accounts/ACC-12345/interest?rate=0.05&days=30"; echo

hr "CSV export (Task 4C)"
curl -s "$BASE_URL/transactions/export?format=csv"; echo

hr "Validation error example"
curl -s -X POST "$BASE_URL/transactions" -H "Content-Type: application/json" \
  -d '{"fromAccount":"BAD","toAccount":"ACC-1","amount":-5.999,"currency":"XX","type":"transfer"}'; echo
