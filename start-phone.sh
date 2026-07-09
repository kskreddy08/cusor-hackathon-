#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PORT=3847

echo ""
echo "  📱 Nearby — PHONE MODE (public link)"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d client/node_modules ]; then
  npm run install:all
fi

npm run build

if lsof -ti:$PORT >/dev/null 2>&1; then
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

rm -f tunnel-url.txt
node scripts/start-with-tunnel.mjs
