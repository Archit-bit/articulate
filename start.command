#!/bin/bash
# Double-click to start Articulate. Keep this window open while you practise.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org, then double-click this file again."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run — installing (about a minute)…"
  npm install || { read -n 1 -s -r -p "Install failed. Press any key to close."; exit 1; }
fi
echo "Starting Articulate at http://localhost:5173  (close this window to stop)"
npm run dev
