#!/usr/bin/env bash
# Interactive launcher: pick a backend, then a frontend, and run them together (locally).
# Requires the chosen stack's toolchain installed. Ctrl+C stops everything.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"
API="http://localhost:3000"
mkdir -p "$LOGS"

BACK_PID=""

cleanup() {
  echo ""
  echo "⏹  Stopping…"
  [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null
  for port in 3000 4200; do
    pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
    [ -n "$pids" ] && kill $pids 2>/dev/null
  done
  exit 0
}
trap cleanup INT TERM

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ '$1' not found — install it and retry."; exit 1; }; }

# ---- 1) choose backend ----
echo "Choose a backend:"
echo "  1) Java + Spring Boot"
echo "  2) Go + Chi"
echo "  3) Python + FastAPI"
echo "  4) C# / .NET"
read -rp "Backend [1-4]: " B
echo ""

case "$B" in
  1) need mvn
     ( cd "$ROOT/backend" && mvn -q spring-boot:run -Dspring-boot.run.fork=false ) >"$LOGS/backend.log" 2>&1 &
     BACK_PID=$!; NAME="Java + Spring Boot" ;;
  2) need go
     ( cd "$ROOT/backend-go" && go run ./cmd/server ) >"$LOGS/backend.log" 2>&1 &
     BACK_PID=$!; NAME="Go + Chi" ;;
  3) need python3
     if [ ! -d "$ROOT/backend-fastapi/.venv" ]; then
       echo "📦 Creating venv + installing FastAPI deps (first run)…"
       ( cd "$ROOT/backend-fastapi" && python3 -m venv .venv && ./.venv/bin/pip install -q -r requirements.txt )
     fi
     ( cd "$ROOT/backend-fastapi" && ./.venv/bin/uvicorn app.main:app --port 3000 ) >"$LOGS/backend.log" 2>&1 &
     BACK_PID=$!; NAME="Python + FastAPI" ;;
  4) need dotnet
     ( cd "$ROOT/backend-dotnet" && dotnet run --project src/BankingApi ) >"$LOGS/backend.log" 2>&1 &
     BACK_PID=$!; NAME="C# / .NET" ;;
  *) echo "Invalid choice."; exit 1 ;;
esac

echo "🚀 Starting backend: $NAME  (logs: .logs/backend.log)"
printf "⏳ Waiting for API on :3000"
for _ in $(seq 1 120); do
  if curl -s -o /dev/null "$API/transactions"; then echo " — ready"; break; fi
  if ! kill -0 "$BACK_PID" 2>/dev/null; then
    echo ""; echo "✗ Backend exited. Last log lines:"; tail -n 20 "$LOGS/backend.log"; cleanup
  fi
  printf "."; sleep 1
done

if [ -f "$ROOT/demo/seed.sh" ]; then
  echo "🌱 Seeding sample data…"
  bash "$ROOT/demo/seed.sh" "$API" >/dev/null 2>&1 || true
fi

# ---- 2) choose frontend ----
echo ""
echo "Choose a frontend:"
echo "  1) Angular  (web, http://localhost:4200)"
echo "  2) Electron (desktop window)"
echo "  3) Flutter Web (opens Chrome)"
echo "  4) None (backend only)"
read -rp "Frontend [1-4]: " F

echo ""
echo "✅ Backend running: $API   (docs: $API/docs, health: $API/actuator/health)"
echo "   Press Ctrl+C to stop everything."
echo ""

case "$F" in
  1) need npm
     [ -d "$ROOT/frontend/node_modules" ] || ( cd "$ROOT/frontend" && npm install )
     ( sleep 12 && command -v open >/dev/null 2>&1 && open http://localhost:4200 ) &
     ( cd "$ROOT/frontend" && npm start ) ;;
  2) need npm
     [ -d "$ROOT/frontend-electron/node_modules" ] || ( cd "$ROOT/frontend-electron" && npm install )
     ( cd "$ROOT/frontend-electron" && npm start ) ;;
  3) need flutter
     ( cd "$ROOT/frontend-flutter" && flutter pub get && flutter run -d chrome --web-browser-flag "--disable-web-security" ) ;;
  4) echo "Backend only — Ctrl+C to stop."; wait "$BACK_PID" ;;
  *) echo "Invalid choice."; cleanup ;;
esac

cleanup
