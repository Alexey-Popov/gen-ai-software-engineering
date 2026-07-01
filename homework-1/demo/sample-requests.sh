#!/usr/bin/env bash
# curl equivalent of sample-requests.http, for environments without a REST client.
# Usage: ./demo/sample-requests.sh [base_url]
set -e

BASE_URL="${1:-http://localhost:3000}"

echo "== Health check =="
curl -s "$BASE_URL/"; echo -e "\n"

echo "== Create a transfer =="
curl -s -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'
echo -e "\n"

echo "== Create a deposit =="
curl -s -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-00000","toAccount":"ACC-12345","amount":500,"currency":"USD","type":"deposit"}'
echo -e "\n"

echo "== Trigger a validation error =="
curl -s -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"12345","toAccount":"ACC-67890","amount":-5,"currency":"XYZ","type":"transfer"}'
echo -e "\n"

echo "== List all transactions =="
curl -s "$BASE_URL/transactions"; echo -e "\n"

echo "== Filter by account =="
curl -s "$BASE_URL/transactions?accountId=ACC-12345"; echo -e "\n"

echo "== Get account balance =="
curl -s "$BASE_URL/accounts/ACC-12345/balance"; echo -e "\n"

echo "== Get account summary =="
curl -s "$BASE_URL/accounts/ACC-12345/summary"; echo -e "\n"
