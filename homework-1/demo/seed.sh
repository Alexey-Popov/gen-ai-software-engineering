#!/usr/bin/env bash
# Seed the running API with demo/sample-data.json, then print balances.
# Usage: ./demo/seed.sh   (server must already be running on $HOST)
set -euo pipefail

HOST="${HOST:-http://localhost:3000}"
DIR="$(dirname "$0")"

if ! command -v jq >/dev/null 2>&1; then
  echo "This script needs 'jq'. Install it, or POST demo/sample-data.json manually." >&2
  exit 1
fi

echo "Seeding transactions from sample-data.json -> $HOST"
jq -c '.transactions[]' "$DIR/sample-data.json" | while read -r tx; do
  curl -s -X POST "$HOST/transactions" -H "Content-Type: application/json" -d "$tx" \
    | jq -r '"created \(.type) \(.amount) \(.currency) -> id \(.id)"'
done

echo ""
echo "Balance ACC-12345:"; curl -s "$HOST/accounts/ACC-12345/balance" | jq .
echo "Balance ACC-67890:"; curl -s "$HOST/accounts/ACC-67890/balance" | jq .
