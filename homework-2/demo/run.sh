#!/bin/bash

echo "======================================"
echo "Homework 2: Customer Support System"
echo "======================================"
echo

echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node.js version: $NODE_VERSION"
echo

echo "Installing dependencies..."
npm install
echo

echo "Starting Customer Support System API..."
echo "Server will be available at http://localhost:3000"
echo
echo "Available endpoints:"
echo "  GET  /                              - Health check"
echo "  POST /tickets                       - Create ticket"
echo "  GET  /tickets                       - List tickets"
echo "  GET  /tickets/:id                   - Get ticket"
echo "  PUT  /tickets/:id                   - Update ticket"
echo "  DELETE /tickets/:id                 - Delete ticket"
echo "  POST /tickets/import                - Import tickets (CSV/JSON/XML)"
echo "  POST /tickets/:id/auto-classify     - Auto-classify ticket"
echo
echo "Press Ctrl+C to stop the server"
echo "======================================"
echo

npm start
