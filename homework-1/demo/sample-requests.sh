#!/usr/bin/env bash
# Demonstrates all Transactions API endpoints with curl.
# Requires: curl, jq
# Usage:
#   1. Start the server:  bash demo/run.sh
#   2. In another terminal: bash demo/sample-requests.sh
set -euo pipefail

BASE="${API_URL:-http://localhost:3000}"

# ── helpers ──────────────────────────────────────────────────────────────────

BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'

section() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }
label()   { echo -e "${DIM}  $1${NC}"; }

pretty_curl() {
  local method="$1"; local url="$2"; local body="${3:-}"
  echo -e "${YELLOW}  ${method} ${url}${NC}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$body" | jq .
  else
    curl -s "$url" | jq .
  fi
}

# Smoke-test: server must be reachable
if ! curl -sf "$BASE/transactions" > /dev/null 2>&1; then
  echo -e "${RED}Error: server not reachable at $BASE${NC}"
  echo "Start it with:  bash demo/run.sh"
  exit 1
fi

echo -e "${GREEN}Connected to $BASE${NC}"

# ── Task 1: Core API ─────────────────────────────────────────────────────────

section "Task 1 · Core API — Create transactions"

label "POST /transactions  (deposit)"
DEPOSIT=$(curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":5000,"currency":"USD","type":"deposit"}')
echo "$DEPOSIT" | jq .
TX_ID=$(echo "$DEPOSIT" | jq -r '.id')

label "POST /transactions  (deposit EUR)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":1200,"currency":"EUR","type":"deposit"}' | jq .

label "POST /transactions  (transfer ACC-AA001 → ACC-BB002)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-AA001","toAccount":"ACC-BB002","amount":800,"currency":"USD","type":"transfer"}' | jq .

label "POST /transactions  (withdrawal)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-AA001","amount":250.50,"currency":"USD","type":"withdrawal"}' | jq .

section "Task 1 · Core API — Read"

label "GET /transactions  (list all)"
pretty_curl GET "$BASE/transactions"

label "GET /transactions/:id  (single transaction)"
pretty_curl GET "$BASE/transactions/$TX_ID"

label "GET /accounts/ACC-AA001/balance"
pretty_curl GET "$BASE/accounts/ACC-AA001/balance"

# ── Task 2: Validation ────────────────────────────────────────────────────────

section "Task 2 · Validation — Error responses"

label "Invalid account format  (expects 400)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"acc-001","amount":100,"currency":"USD","type":"deposit"}' | jq .

label "Negative amount  (expects 400)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":-50,"currency":"USD","type":"deposit"}' | jq .

label "More than 2 decimal places  (expects 400)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":99.999,"currency":"USD","type":"deposit"}' | jq .

label "Invalid ISO 4217 currency  (expects 400)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-AA001","amount":100,"currency":"XYZ","type":"deposit"}' | jq .

label "Multiple errors at once  (expects 400 with 3 details)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"bad","amount":-5.999,"currency":"ZZZ","type":"deposit"}' | jq .

label "Transfer — same fromAccount and toAccount  (expects 400)"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-AA001","toAccount":"ACC-AA001","amount":100,"currency":"USD","type":"transfer"}' | jq .

# ── Task 3: Filtering ─────────────────────────────────────────────────────────

section "Task 3 · Filtering"

label "GET /transactions?accountId=ACC-AA001"
pretty_curl GET "$BASE/transactions?accountId=ACC-AA001"

label "GET /transactions?type=transfer"
pretty_curl GET "$BASE/transactions?type=transfer"

label "GET /transactions?from=2026-01-01&to=2026-12-31"
pretty_curl GET "$BASE/transactions?from=2026-01-01&to=2026-12-31"

label "GET /transactions?accountId=ACC-AA001&type=deposit&from=2026-01-01  (combined)"
pretty_curl GET "$BASE/transactions?accountId=ACC-AA001&type=deposit&from=2026-01-01"

label "Invalid filter — bad accountId format  (expects 400)"
curl -s "$BASE/transactions?accountId=bad-id" | jq .

label "Invalid filter — from > to  (expects 400)"
curl -s "$BASE/transactions?from=2026-12-31&to=2026-01-01" | jq .

# ── Task 4A: Summary ──────────────────────────────────────────────────────────

section "Task 4A · Account Summary"

label "GET /accounts/ACC-AA001/summary"
pretty_curl GET "$BASE/accounts/ACC-AA001/summary"

label "GET /accounts/ACC-BB002/summary"
pretty_curl GET "$BASE/accounts/ACC-BB002/summary"

# ── Task 4B: Interest ─────────────────────────────────────────────────────────

section "Task 4B · Simple Interest"

label "GET /accounts/ACC-AA001/interest?rate=0.05&days=30  (5% annual, 30 days)"
pretty_curl GET "$BASE/accounts/ACC-AA001/interest?rate=0.05&days=30"

label "GET /accounts/ACC-AA001/interest?rate=0.10&days=365  (10% annual, 1 year)"
pretty_curl GET "$BASE/accounts/ACC-AA001/interest?rate=0.10&days=365"

label "Missing parameter  (expects 400)"
curl -s "$BASE/accounts/ACC-AA001/interest?rate=0.05" | jq .

# ── Task 4C: CSV Export ───────────────────────────────────────────────────────

section "Task 4C · CSV Export"

label "GET /transactions/export?format=csv  (all transactions)"
curl -s "$BASE/transactions/export?format=csv"
echo ""

label "GET /transactions/export?format=csv&type=deposit  (filtered)"
curl -s "$BASE/transactions/export?format=csv&type=deposit"
echo ""

label "Unsupported format  (expects 400)"
curl -s "$BASE/transactions/export?format=xml" | jq .

# ── Task 4D: Rate Limiting ────────────────────────────────────────────────────

section "Task 4D · Rate Limiting"

label "Rate limit response headers"
curl -sI "$BASE/transactions" | grep -i "x-ratelimit\|retry-after" || true

echo -e "\n${GREEN}${BOLD}All requests completed.${NC}\n"
