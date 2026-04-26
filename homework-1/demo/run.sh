#!/usr/bin/env bash
# Install dependencies (if needed) and start the Banking Transactions API.
# Run from the homework-1 directory:  ./demo/run.sh
set -e

cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Banking Transactions API on http://localhost:3000"
npm start
