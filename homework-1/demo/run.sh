#!/usr/bin/env bash
# Start the Banking Transactions API.
# Usage: ./demo/run.sh   (run from the homework-1 directory)
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting API on http://localhost:${PORT:-3000}"
npm start
