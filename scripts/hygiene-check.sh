#!/usr/bin/env bash
# Repo hygiene + light security scan (no network).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YLW=$'\033[0;33m'
NC=$'\033[0m'
fail=0
warn=0

pass() { echo "${GRN}OK${NC}  $*"; }
bad()  { echo "${RED}FAIL${NC} $*"; fail=1; }
caution() { echo "${YLW}WARN${NC} $*"; warn=$((warn + 1)); }

echo "== Astro-app hygiene check =="
echo "root: $ROOT"
echo

# --- gitignore present ---
if [[ -f .gitignore ]]; then
  pass "root .gitignore exists"
else
  bad "missing root .gitignore"
fi

if grep -qE '^local/|^\*\*/local/' .gitignore 2>/dev/null; then
  pass ".gitignore ignores local/"
else
  bad ".gitignore does not list local/"
fi

if [[ -f client/.gitignore ]] && grep -qE '^local' client/.gitignore; then
  pass "client/.gitignore ignores local/"
else
  caution "client/.gitignore missing local/ entry"
fi

# --- .env must not be force-tracked patterns ---
if [[ -f server/.env ]]; then
  pass "server/.env present locally (should stay untracked)"
else
  caution "server/.env missing — copy from server/.env.example"
fi

if [[ -f server/.env.example ]]; then
  pass "server/.env.example present"
else
  bad "missing server/.env.example"
fi

# --- secret pattern scan (tracked-ish source; skip node_modules/dist/.env) ---
echo
echo "-- secret / key scan --"
# NASA DEMO_KEY is public; real keys look like long alnum. Flag known leak pattern + generic api_key= in md/json.
SECRET_HITS=$(
  find . \
    \( -path './node_modules' -o -path '*/node_modules/*' -o -path '*/dist/*' -o -path './.git/*' \) -prune -o \
    -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.html' -o -name '*.json' -o -name '.env.example' \) \
    -print0 2>/dev/null \
  | xargs -0 grep -nE 'api_key=[A-Za-z0-9]{20,}|NASA_API_KEY=[A-Za-z0-9]{20,}' 2>/dev/null \
  | grep -v 'YOUR_NASA_API_KEY' \
  | grep -v 'DEMO_KEY' \
  | grep -v '\.env\.example' \
  || true
)

if [[ -z "$SECRET_HITS" ]]; then
  pass "no hard-coded API keys found in source/docs/json (excluding .env)"
else
  bad "possible hard-coded secrets:"
  echo "$SECRET_HITS" | head -40
fi

# .env itself should exist only locally — remind rotation if DEMO not used
if [[ -f server/.env ]]; then
  if grep -qE 'NASA_API_KEY=(DEMO_KEY|your_|YOUR_|change_me)' server/.env 2>/dev/null; then
    pass "server/.env uses placeholder-style key"
  else
    caution "server/.env has a non-placeholder NASA_API_KEY — ensure it is gitignored and rotated if it was ever committed/shared"
  fi
fi

# --- placeholder production URL ---
echo
echo "-- config hygiene --"
if grep -rn 'production-api-url\.com' client/src --include='*.js' --include='*.jsx' 2>/dev/null | grep -v node_modules; then
  caution "placeholder production API URL still in client code"
else
  pass "no production-api-url.com placeholder in client/src"
fi

# --- cors open (info) ---
if grep -q 'app.use(cors())' server/src/index.js 2>/dev/null; then
  caution "Express CORS is wide open (ok for local; lock origin before public deploy)"
fi

# --- gitignore effectiveness (if git repo) ---
echo
echo "-- git status (if repo) --"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git check-ignore -q server/.env 2>/dev/null; then
    pass "git ignores server/.env"
  else
    bad "server/.env is NOT ignored by git"
  fi
  if [[ -d client/local ]] || [[ -d local ]]; then
    if git check-ignore -q client/local 2>/dev/null || git check-ignore -q local 2>/dev/null; then
      pass "git ignores local/"
    else
      bad "local/ is NOT ignored by git"
    fi
  fi
  if git check-ignore -q client/node_modules 2>/dev/null; then
    pass "git ignores client/node_modules"
  else
    bad "client/node_modules not ignored"
  fi
  # Would .env be staged?
  if git status --porcelain 2>/dev/null | grep -E '\.env$' | grep -v example; then
    bad ".env appears in git status — unstage and ensure ignore rules"
  else
    pass "no .env in git status porcelain"
  fi
else
  caution "not a git repository yet — run: git init (then re-run this script)"
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "${GRN}Hygiene check passed${NC} (${warn} warning(s))."
  exit 0
else
  echo "${RED}Hygiene check failed${NC} — fix FAIL items above."
  exit 1
fi
