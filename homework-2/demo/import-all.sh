#!/usr/bin/env bash
#
# Import all three sample fixtures (CSV, JSON, XML) into a running server.
# Defaults to http://localhost:3000; override with HOST=...
#
# Usage:
#   ./demo/import-all.sh
#   HOST=http://staging.example.com ./demo/import-all.sh

set -euo pipefail

HOST="${HOST:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES="$ROOT/tests/fixtures"

for file in sample_tickets.csv sample_tickets.json sample_tickets.xml; do
  echo "=== importing $file ==="
  curl -sS -X POST "$HOST/tickets/import" -F "file=@$FIXTURES/$file"
  echo
done

echo
echo "=== final ticket count ==="
curl -sS "$HOST/tickets" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'
