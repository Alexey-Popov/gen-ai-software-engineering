#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ── helpers ────────────────────────────────────────────────────────────────────
BASE="http://localhost:3000"

header() { echo; echo "══════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════"; }
step()   { echo; echo "▶ $*"; }

# ── install & start server in background ──────────────────────────────────────
echo "Installing dependencies..."
uv sync --quiet

header "Starting server on $BASE"
PYTHONPATH=src uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 \
    --log-level warning &
SERVER_PID=$!

echo -n "Waiting for server to be ready"
for i in $(seq 1 20); do
    if curl -sf "$BASE/transactions" >/dev/null 2>&1; then
        echo " ready."
        break
    fi
    echo -n "."
    sleep 0.5
done

# ── demo requests ─────────────────────────────────────────────────────────────
header "DEMO: Banking Transactions API"

step "1. Create a deposit (ACC-11111 receives \$1000 USD)"
curl -s -X POST "$BASE/transactions" \
    -H 'Content-Type: application/json' \
    -d '{"toAccount":"ACC-11111","amount":1000.00,"currency":"USD","type":"deposit"}' \
    | python3 -m json.tool

step "2. Create a transfer (ACC-11111 → ACC-22222, \$250 USD)"
curl -s -X POST "$BASE/transactions" \
    -H 'Content-Type: application/json' \
    -d '{"fromAccount":"ACC-11111","toAccount":"ACC-22222","amount":250.00,"currency":"USD","type":"transfer"}' \
    | python3 -m json.tool

step "3. Create a withdrawal (ACC-11111 takes out \$100 USD)"
curl -s -X POST "$BASE/transactions" \
    -H 'Content-Type: application/json' \
    -d '{"fromAccount":"ACC-11111","amount":100.00,"currency":"USD","type":"withdrawal"}' \
    | python3 -m json.tool

step "4. List all transactions"
curl -s "$BASE/transactions" | python3 -m json.tool

step "5. Filter transactions by account ACC-11111"
curl -s "$BASE/transactions?accountId=ACC-11111" | python3 -m json.tool

step "6. Get balance for ACC-11111 (expected: USD 650.00)"
curl -s "$BASE/accounts/ACC-11111/balance" | python3 -m json.tool

step "7. Get balance for ACC-22222 (expected: USD 250.00)"
curl -s "$BASE/accounts/ACC-22222/balance" | python3 -m json.tool

step "8. Validation error — invalid amount and bad currency"
curl -s -X POST "$BASE/transactions" \
    -H 'Content-Type: application/json' \
    -d '{"toAccount":"ACC-11111","amount":-5,"currency":"XYZ","type":"deposit"}' \
    | python3 -m json.tool

step "9. Export all transactions as CSV"
curl -s "$BASE/transactions/export?format=csv"
echo

header "Demo complete. Interactive docs → $BASE/docs"
echo "Server is still running (PID $SERVER_PID). Press Ctrl+C to stop."
wait "$SERVER_PID"
