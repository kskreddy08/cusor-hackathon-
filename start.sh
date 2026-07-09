#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT=3847

echo ""
echo "  📡 Nearby — starting..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d client/node_modules ]; then
  echo "  Installing dependencies..."
  npm run install:all
fi

echo "  Building app..."
npm run build

UNIVERSAL_LINK="${UNIVERSAL_LINK:-https://nearby-chat-weld.vercel.app}"
export UNIVERSAL_LINK

if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "  Stopping old server on port $PORT..."
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo ""
echo "  Starting host (keeps running — Ctrl+C to stop)..."
echo ""

while true; do
  NODE_ENV=production node server/index.js
  code=$?
  if [ "$code" -eq 0 ]; then
    break
  fi
  echo ""
  echo "  ⚠️  Server stopped — restarting in 2 seconds..."
  sleep 2
done
