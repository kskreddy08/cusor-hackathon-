#!/usr/bin/env bash
# Run Nearby + public link (works on your phone from anywhere — for testing).
cd "$(dirname "$0")"
PORT=3847
CF="${CLOUDFLARED:-cloudflared}"
if ! command -v "$CF" >/dev/null 2>&1 && [ -x /tmp/cloudflared ]; then
  CF=/tmp/cloudflared
fi

if ! command -v "$CF" >/dev/null 2>&1; then
  echo "  Downloading cloudflared..."
  curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o /tmp/cloudflared
  chmod +x /tmp/cloudflared
  CF=/tmp/cloudflared
fi

echo ""
echo "  📡 Nearby — live public link mode"
echo ""

npm run build 2>/dev/null || npm run install:all && npm run build

lsof -ti:$PORT | xargs -r kill -9 2>/dev/null || true
sleep 1

NODE_ENV=production node server/index.js &
SERVER_PID=$!
sleep 2

if ! curl -sf "http://localhost:$PORT/api/health" >/dev/null; then
  echo "  ❌ Server failed to start"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

echo "  ✅ Local: http://localhost:$PORT"
echo "  🌐 Starting public link for your phone..."
echo ""

"$CF" tunnel --url "http://localhost:$PORT" 2>&1 | while read -r line; do
  echo "$line"
  url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
  if [ -n "$url" ]; then
    echo ""
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║  OPEN THIS ON YOUR PHONE — IT WORKS NOW      ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo ""
    echo "  → $url"
    echo ""
    echo "  Open Lounge is live. Keep this terminal open."
    echo ""
  fi
done

kill $SERVER_PID 2>/dev/null
