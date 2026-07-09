#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  📡 Nearby — starting..."
echo ""

if [ ! -d node_modules ] || [ ! -d client/node_modules ]; then
  npm run install:all
fi

if [ ! -d client/dist ]; then
  echo "  Building client..."
  npm run build
fi

echo ""
NODE_ENV=production node server/index.js
