#!/bin/bash
set -e
cd "$(dirname "$0")/.."
pip install -r requirements.txt
python3 -m uvicorn src.app:app --reload --port 8000
