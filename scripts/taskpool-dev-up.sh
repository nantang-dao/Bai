#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[taskpool-dev-up] workspace: $ROOT"

echo ""
echo "== 1) Start semi-app (3000) =="
(cd "$ROOT/../semi-new/semi-app" && npm run dev) &

echo ""
echo "== 2) Start mycoseed-backend (3001) =="
(cd "$ROOT/mycoseed-backend" && npm run dev) &

echo ""
echo "== 3) Start mycoseed-frontend (3003) =="
(cd "$ROOT/mycoseed-frontend" && npm run dev) &

echo ""
echo "[taskpool-dev-up] started. Check ports:"
echo "  lsof -nP -iTCP:3000 -sTCP:LISTEN"
echo "  lsof -nP -iTCP:3001 -sTCP:LISTEN"
echo "  lsof -nP -iTCP:3003 -sTCP:LISTEN"

wait

