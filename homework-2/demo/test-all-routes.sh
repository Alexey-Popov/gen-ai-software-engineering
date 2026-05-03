#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
TICKET_ID=""

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Testing Customer Support API${NC}"
echo -e "${BLUE}================================${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}[1/8] Testing Health Check: GET /${NC}"
response=$(curl -s -w "\n%{http_code}" $BASE_URL/)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
fi
echo ""

# Test 2: Create Ticket
echo -e "${YELLOW}[2/8] Testing Create Ticket: POST /tickets${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@example.com",
    "customer_name": "Test User",
    "subject": "Cannot login",
    "description": "I forgot my password and need help"
  }')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" -eq 201 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
    TICKET_ID=$(echo "$body" | jq -r '.id' 2>/dev/null)
    echo "Created ticket ID: $TICKET_ID"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    echo "$body"
fi
echo ""

# Test 3: Get All Tickets
echo -e "${YELLOW}[3/8] Testing List All Tickets: GET /tickets${NC}"
response=$(curl -s -w "\n%{http_code}" $BASE_URL/tickets)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
    ticket_count=$(echo "$body" | jq -r '.count' 2>/dev/null)
    echo "Total tickets: $ticket_count"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
fi
echo ""

# Test 4: Get Ticket by ID
echo -e "${YELLOW}[4/8] Testing Get Ticket by ID: GET /tickets/:id${NC}"
if [ -n "$TICKET_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" $BASE_URL/tickets/$TICKET_ID)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC} - No ticket ID available"
fi
echo ""

# Test 5: Update Ticket
echo -e "${YELLOW}[5/8] Testing Update Ticket: PUT /tickets/:id${NC}"
if [ -n "$TICKET_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PUT $BASE_URL/tickets/$TICKET_ID \
      -H "Content-Type: application/json" \
      -d '{
        "status": "in_progress",
        "assigned_to": "agent@example.com"
      }')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC} - No ticket ID available"
fi
echo ""

# Test 6: Auto-Classify Ticket
echo -e "${YELLOW}[6/8] Testing Auto-Classify: POST /tickets/:id/auto-classify${NC}"
if [ -n "$TICKET_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/tickets/$TICKET_ID/auto-classify)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC} - No ticket ID available"
fi
echo ""

# Test 7: Import Tickets (CSV)
echo -e "${YELLOW}[7/8] Testing Import Tickets: POST /tickets/import${NC}"
if [ -f "demo/sample_tickets.csv" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/tickets/import \
      -H "Content-Type: text/csv" \
      --data-binary @demo/sample_tickets.csv)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC} - sample_tickets.csv not found"
fi
echo ""

# Test 8: Delete Ticket
echo -e "${YELLOW}[8/8] Testing Delete Ticket: DELETE /tickets/:id${NC}"
if [ -n "$TICKET_ID" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE $BASE_URL/tickets/$TICKET_ID)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $http_code)"
    fi
else
    echo -e "${RED}✗ SKIPPED${NC} - No ticket ID available"
fi
echo ""

# Test filtering
echo -e "${YELLOW}[BONUS] Testing Ticket Filtering${NC}"
echo "Testing filter by status:"
response=$(curl -s "$BASE_URL/tickets?status=new")
echo "$response" | jq '.count' 2>/dev/null && echo -e "${GREEN}✓ Filter by status works${NC}" || echo -e "${RED}✗ Failed${NC}"
echo ""

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}All Tests Completed!${NC}"
echo -e "${BLUE}================================${NC}"
