#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FE="$ROOT/mycoseed-frontend"

export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3003}"
export NUXT_PUBLIC_SEMI_APP_URL="${NUXT_PUBLIC_SEMI_APP_URL:-http://127.0.0.1:3000}"

echo "[taskpool-e2e] API_BASE_URL=$API_BASE_URL"
echo "[taskpool-e2e] PLAYWRIGHT_BASE_URL=$PLAYWRIGHT_BASE_URL"
echo "[taskpool-e2e] NUXT_PUBLIC_SEMI_APP_URL=$NUXT_PUBLIC_SEMI_APP_URL"
echo ""
echo "[taskpool-e2e] NOTE: This test will PAUSE at Semi pages."
echo "You only need to click confirm in Semi, then it auto-returns and continues."
echo ""

cd "$FE"
npx playwright test e2e/taskpool-ordinary-semi-assisted.slow.spec.ts --timeout=1800000

