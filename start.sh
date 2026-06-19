#!/usr/bin/env bash
# Start the GitHub Actions + SAP BTP Learning App
# Run from: C:\Users\I560043\projects\githubActionsCAP\

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting GitHub Actions + SAP BTP Learning App..."
echo ""

# Start backend
echo "[1/2] Starting backend (port 19110)..."
cd "$SCRIPT_DIR/app/backend"
node src/index.js &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "[2/2] Starting frontend (Vite)..."
cd "$SCRIPT_DIR/app/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "App is starting..."
echo "  Frontend: http://localhost:8767 (or next available port)"
echo "  Backend:  http://localhost:19110"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
