#!/usr/bin/env bash
# Starts the Banking Transactions API.
# Usage: ./demo/run.sh   (run from the homework-1 directory or anywhere)
set -euo pipefail

# Resolve the project root (parent of this demo/ folder) regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🚀 Starting API on http://localhost:${PORT:-3000} (Ctrl+C to stop)"
npm run start:prod
