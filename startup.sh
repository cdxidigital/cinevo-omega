#!/bin/sh
set -eu
cd /workspace
export VITE_AUTH_ENABLED=true
export BETTER_AUTH_SECRET=dev-secret-123
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
