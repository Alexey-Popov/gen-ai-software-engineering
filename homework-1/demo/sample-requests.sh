#!/usr/bin/env bash
# Banking Transactions API — sample requests
# Requires: curl, jq  (jq: https://jqlang.github.io/jq/download/)

BASE_URL="http://localhost:3000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_FILE="$SCRIPT_DIR/sample-data.json"

# ── helpers ──────────────────────────────────────────────────────────────────

header() { echo; echo "━━━  $1  ━━━"; }

post_json() {
  curl -s -w "\n  HTTP %{http_code}\n" \
    -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -d "$1"
}

get() {
  curl -s -w "\n  HTTP %{http_code}\n" "$BASE_URL$1"
}

# ── preflight ────────────────────────────────────────────────────────────────

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install it from https://jqlang.github.io/jq/download/"
  exit 1
fi

if ! curl -s --max-time 2 "$BASE_URL/transactions" &>/dev/null; then
  echo "ERROR: Server is not running. Start it with: npm run dev"
  exit 1
fi

# ═════════════════════════════════════════════════════════════════════════════
# 1. SEED — create all transactions from sample-data.json
# ═════════════════════════════════════════════════════════════════════════════

header "1. Seeding transactions from sample-data.json"

count=$(jq length "$DATA_FILE")
for i in $(seq 0 $((count - 1))); do
  payload=$(jq ".[$i]" "$DATA_FILE")
  echo
  echo "  POST /transactions — $(jq -r '.type' <<< "$payload")  $(jq -r '.fromAccount' <<< "$payload") → $(jq -r '.toAccount' <<< "$payload")  $(jq -r '.amount' <<< "$payload") $(jq -r '.currency' <<< "$payload")"
  post_json "$payload"
done

# ═════════════════════════════════════════════════════════════════════════════
# 2. LIST — get all transactions
# ═════════════════════════════════════════════════════════════════════════════

header "2. List all transactions"
get "/transactions" | jq '.'

# ═════════════════════════════════════════════════════════════════════════════
# 3. SINGLE — get one transaction by ID
# ═════════════════════════════════════════════════════════════════════════════

header "3. Get single transaction by ID"
FIRST_ID=$(curl -s "$BASE_URL/transactions" | jq -r '.[0].id')
echo "  Using ID: $FIRST_ID"
get "/transactions/$FIRST_ID" | jq '.'

# ═════════════════════════════════════════════════════════════════════════════
# 4. FILTERS
# ═════════════════════════════════════════════════════════════════════════════

header "4a. Filter by accountId=ACC-AA111"
get "/transactions?accountId=ACC-AA111" | jq '[.[] | {id, type, fromAccount, toAccount, amount, currency}]'

header "4b. Filter by type=transfer"
get "/transactions?type=transfer" | jq '[.[] | {id, type, fromAccount, toAccount, amount}]'

header "4c. Filter by date range (from today)"
TODAY=$(date +%Y-%m-%d)
get "/transactions?from=$TODAY&to=$TODAY" | jq '[.[] | {id, timestamp, type}]'

header "4d. Combined filter — ACC-AA111 + type=transfer"
get "/transactions?accountId=ACC-AA111&type=transfer" | jq '[.[] | {id, type, fromAccount, toAccount, amount}]'

# ═════════════════════════════════════════════════════════════════════════════
# 5. BALANCE
# ═════════════════════════════════════════════════════════════════════════════

header "5. Account balance — ACC-AA111"
get "/accounts/ACC-AA111/balance" | jq '.'

# ═════════════════════════════════════════════════════════════════════════════
# 6. SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

header "6. Account summary — ACC-AA111"
get "/accounts/ACC-AA111/summary" | jq '.'

header "6b. Account summary — ACC-CC333"
get "/accounts/ACC-CC333/summary" | jq '.'

# ═════════════════════════════════════════════════════════════════════════════
# 7. ERROR CASES
# ═════════════════════════════════════════════════════════════════════════════

header "7a. Validation error — negative amount, bad account format, unknown currency"
post_json '{
  "fromAccount": "ACC123",
  "toAccount":   "ACC-BB222",
  "amount":      -50,
  "currency":    "XX",
  "type":        "transfer"
}' | jq '.'

header "7b. Validation error — amount has more than 2 decimal places"
post_json '{
  "fromAccount": "ACC-AA111",
  "toAccount":   "ACC-BB222",
  "amount":      9.999,
  "currency":    "USD",
  "type":        "transfer"
}' | jq '.'

header "7c. 404 — transaction not found"
get "/transactions/00000000-0000-0000-0000-000000000000" | jq '.'

header "7d. 404 — account not found"
get "/accounts/ACC-ZZ999/summary" | jq '.'

header "7e. Invalid filter parameter"
get "/transactions?accountId=BADFORMAT&type=invalid" | jq '.'

echo
echo "Done."
