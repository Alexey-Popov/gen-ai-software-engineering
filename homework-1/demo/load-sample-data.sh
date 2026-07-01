#!/usr/bin/env bash
# Posts every transaction in sample-data.json to a running instance of the API.
# Usage: ./demo/load-sample-data.sh [base_url]
set -e

BASE_URL="${1:-http://localhost:3000}"
DATA_FILE="$(dirname "$0")/sample-data.json"

python3 - "$BASE_URL" "$DATA_FILE" <<'PYEOF'
import json
import sys
import urllib.request

base_url, data_file = sys.argv[1], sys.argv[2]

with open(data_file) as f:
    transactions = json.load(f)

for tx in transactions:
    body = json.dumps(tx).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/transactions",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        print(response.status, response.read().decode("utf-8"))
PYEOF
