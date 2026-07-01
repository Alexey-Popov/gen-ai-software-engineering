#!/usr/bin/env bash
# Starts the Transactions API server.
# Usage: bash demo/run.sh
set -euo pipefail

# Resolve project root relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Prerequisites check
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install it from https://nodejs.org (v18 or higher required)."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js v18+ is required (found v$(node -v))."
  exit 1
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

PORT="${PORT:-3000}"
echo "Transactions API starting on http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
echo ""

exec node src/index.js
