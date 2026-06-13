#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { echo; echo "--- $1 ---"; }

# ── 1. Create a ticket ────────────────────────────────────────────────────────
step "POST /tickets — create a ticket"
RESPONSE=$(curl -s -X POST "$BASE_URL/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id":    "cust-demo",
    "customer_email": "demo@example.com",
    "customer_name":  "Demo User",
    "subject":        "Sample ticket from demo script",
    "description":    "This ticket was created by the sample-requests.sh demo script to show the create endpoint.",
    "status":         "new"
  }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
TICKET_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# ── 2. List all tickets ───────────────────────────────────────────────────────
step "GET /tickets — list all tickets"
curl -s "$BASE_URL/tickets" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/tickets"

# ── 3. Filter by status ───────────────────────────────────────────────────────
step "GET /tickets?status=new — filter by status"
curl -s "$BASE_URL/tickets?status=new" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/tickets?status=new"

# ── 4. Get single ticket ──────────────────────────────────────────────────────
step "GET /tickets/:id — get ticket by ID"
curl -s "$BASE_URL/tickets/$TICKET_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/tickets/$TICKET_ID"

# ── 5. Update ticket ──────────────────────────────────────────────────────────
step "PUT /tickets/:id — update ticket"
curl -s -X PUT "$BASE_URL/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"assigned_to":"support-team","status":"in_progress"}' \
  | python3 -m json.tool 2>/dev/null || curl -s -X PUT "$BASE_URL/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"assigned_to":"support-team","status":"in_progress"}'

# ── 6. Bulk import from sample-data.json ─────────────────────────────────────
step "POST /tickets/import — bulk import from sample-data.json"
curl -s -X POST "$BASE_URL/tickets/import" \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/sample-data.json" \
  | python3 -m json.tool 2>/dev/null || curl -s -X POST "$BASE_URL/tickets/import" \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/sample-data.json"

# ── 7. Delete the demo ticket ─────────────────────────────────────────────────
step "DELETE /tickets/:id — delete demo ticket"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/tickets/$TICKET_ID")
echo "HTTP $HTTP_STATUS — ticket $TICKET_ID deleted"

echo
echo "Demo complete."
