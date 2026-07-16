#!/usr/bin/env bash
# ORBIT — API + client module smoke (dev servers must already be running).
#
# Usage:
#   # Terminal A: cd server && npm run dev
#   # Terminal B: cd client && npm run dev
#   bash scripts/smoke.sh
#
# Env:
#   API_BASE   default http://127.0.0.1:8000
#   VITE_BASE  default http://127.0.0.1:5173
#   SKIP_VITE  set to 1 to run API checks only
#   TIMEOUT    curl max-time seconds (default 20)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_BASE="${API_BASE:-http://127.0.0.1:8000}"
VITE_BASE="${VITE_BASE:-http://127.0.0.1:5173}"
TIMEOUT="${TIMEOUT:-20}"
SKIP_VITE="${SKIP_VITE:-0}"
TODAY="$(date -u +%Y-%m-%d)"

RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YLW=$'\033[0;33m'
NC=$'\033[0m'

pass=0
fail=0

pass_line() { echo "${GRN}OK${NC}   $*"; pass=$((pass + 1)); }
fail_line() { echo "${RED}FAIL${NC} $*"; fail=$((fail + 1)); }

check_http() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code="$(
    curl -sS -o /tmp/orbit-smoke-body.json -w "%{http_code}" \
      --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000"
  )"
  if [[ "$code" == "$expect" ]]; then
    pass_line "$name"
  else
    fail_line "$name (http $code, expected $expect) — $url"
  fi
}

echo "== ORBIT smoke =="
echo "API_BASE=$API_BASE"
echo "VITE_BASE=$VITE_BASE"
echo "date(UTC)=$TODAY"
echo

echo "-- API --"
check_http "health" "$API_BASE/health"
check_http "asteroids mock" \
  "$API_BASE/api/asteroids?start_date=$TODAY&page=1&limit=25&mock=true"
check_http "asteroids page 2" \
  "$API_BASE/api/asteroids?start_date=$TODAY&page=2&limit=25&mock=true"
check_http "asteroids hazardous" \
  "$API_BASE/api/asteroids?start_date=$TODAY&page=1&limit=25&mock=true&hazardous=true"
check_http "planets" "$API_BASE/api/planets?page=1&limit=8"
check_http "iss" "$API_BASE/api/iss"
check_http "sentry" "$API_BASE/api/sentry"
check_http "donki solar" "$API_BASE/api/donki/solar"
check_http "sbdb (99942)" "$API_BASE/api/sbdb?sstr=99942"

if [[ "$SKIP_VITE" != "1" ]]; then
  echo
  echo "-- Client (Vite) --"
  check_http "vite index" "$VITE_BASE/"
  check_http "vite proxy asteroids" \
    "$VITE_BASE/api/asteroids?start_date=$TODAY&page=1&limit=5&mock=true"
  check_http "live deep-link HTML" "$VITE_BASE/?mode=live"
  check_http "model module" "$VITE_BASE/src/mission/useMissionControlModel.tsx"
  check_http "session module" "$VITE_BASE/src/mission/useMissionSession.ts"
  check_http "handlers module" "$VITE_BASE/src/mission/useLiveHandlers.ts"
  check_http "ThreeDScene module" "$VITE_BASE/src/components/ThreeDScene.tsx"
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "${GRN}Smoke passed${NC} ($pass checks)."
  echo "${YLW}Reminder:${NC} run the Live QA checklist for UI paths — docs/LIVE_QA_CHECKLIST.md"
  exit 0
fi

echo "${RED}Smoke failed${NC} — $fail fail(s), $pass pass(es)."
echo "Ensure server (:8000) and client (:5173) are running, then retry."
exit 1
