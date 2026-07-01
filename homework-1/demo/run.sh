#!/usr/bin/env bash
# Starts the Banking Transactions API on http://localhost:3000
set -e

cd "$(dirname "$0")/.."

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo "Starting API on http://localhost:3000 (docs at http://localhost:3000/docs)"
uvicorn src.main:app --host 0.0.0.0 --port 3000 --reload
