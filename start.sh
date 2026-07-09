#!/usr/bin/env bash
# MISTER — One-click launcher (macOS / Linux)
# Double-click this file or run: ./start.sh

set -e
cd "$(dirname "$0")"

echo "🏟️  MISTER — Starting..."

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "📦  Installing dependencies (first run only)..."
  npm install --legacy-peer-deps --no-audit --no-fund 2>/dev/null || true
fi

# Try Electron first, fallback to browser
if command -v npx &>/dev/null && npx --no-install electron --version &>/dev/null 2>&1; then
  echo "🖥️  Opening desktop app..."
  npx electron main.js
else
  echo "🌐  Opening in browser..."
  # Start a local server
  PORT=${PORT:-3000}
  if command -v python3 &>/dev/null; then
    echo "   → http://localhost:$PORT"
    (sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true) &
    cd demo && python3 -m http.server "$PORT"
  elif command -v npx &>/dev/null; then
    echo "   → http://localhost:$PORT"
    npx --yes serve demo -l "$PORT" --no-clipboard
  else
    echo "❌  No Python or Node found. Install Node.js from https://nodejs.org"
    exit 1
  fi
fi
