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
PYTHONPATH=src uv run uvicorn app.main:app --port 3000 \
    --log-level warning &
SERVER_PID=$!

trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

echo -n "Waiting for server to be ready"
for i in $(seq 1 15); do
    if curl -sf "$BASE/tickets" >/dev/null 2>&1; then
        echo " ready."
        break
    fi
    echo -n "."
    sleep 1
done

# ── demo requests ─────────────────────────────────────────────────────────────
header "DEMO: Support Tickets API (Task 1)"

step "1. Create a support ticket (POST /tickets)"
TICKET_RESPONSE=$(curl -s -X POST "$BASE/tickets" \
    -H 'Content-Type: application/json' \
    -d '{
      "customer_id": "CUST-1001",
      "customer_email": "alice@example.com",
      "customer_name": "Alice Example",
      "subject": "Cannot log in",
      "description": "I cannot log into my account since yesterday morning.",
      "category": "account_access",
      "priority": "high",
      "tags": ["login", "urgent"],
      "metadata": {
        "source": "web_form",
        "browser": "Chrome 120",
        "device_type": "desktop"
      }
    }')
echo "$TICKET_RESPONSE" | python3 -m json.tool
TICKET_ID=$(echo "$TICKET_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

step "2. List all tickets (GET /tickets)"
curl -s "$BASE/tickets" | python3 -m json.tool

step "3. Bulk import from CSV (POST /tickets/import)"
IMPORT_RESPONSE=$(curl -s -X POST "$BASE/tickets/import" \
    -F "file=@demo/sample_tickets.csv")
echo "$IMPORT_RESPONSE" | python3 -m json.tool

step "4. Import result summary (from step 3)"
echo "$IMPORT_RESPONSE" | python3 -m json.tool

step "5. Filter tickets by status=new (GET /tickets?status=new)"
curl -s "$BASE/tickets?status=new" | python3 -m json.tool

step "6. Update ticket status to in_progress (PUT /tickets/{id})"
curl -s -X PUT "$BASE/tickets/$TICKET_ID" \
    -H 'Content-Type: application/json' \
    -d '{"status": "in_progress", "assigned_to": "agent-5"}' | python3 -m json.tool

step "7. Get updated ticket (GET /tickets/{id})"
curl -s "$BASE/tickets/$TICKET_ID" | python3 -m json.tool

header "Demo complete. Interactive docs: http://localhost:3000/docs"
echo "Server is still running (PID $SERVER_PID). Press Ctrl+C to stop."
wait "$SERVER_PID"
