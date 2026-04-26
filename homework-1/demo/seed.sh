#!/usr/bin/env bash
# Seed the running API with demo/sample-data.json.
# Server must be running first (in a separate terminal):  ./demo/run.sh
set -e

cd "$(dirname "$0")/.."
node demo/seed.js
