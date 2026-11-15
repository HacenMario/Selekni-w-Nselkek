#!/usr/bin/env bash
# v4.13 OAuth plumbing verification: consent redirect, state handling,
# callback guard rails, and the frontend handoff URL — no real Google calls.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v413-test
BASE=http://127.0.0.1:3100/api
APP_URL=https://frontend.test
REDIRECT_URI=https://api.test/api/auth/google/callback

pkill -f "mongod.*port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v413 JWT_SECRET=test-jwt-413 \
GOOGLE_CLIENT_ID=test-client-id.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=test-secret \
APP_URL="$APP_URL" GOOGLE_REDIRECT_URI="$REDIRECT_URI" \
nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

# ── 1) provider flag on ──
check "providers.google enabled" "True" "$(curl -s "$BASE/auth/providers" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("google", False))')"

# ── 2) consent redirect: correct Google URL, redirect_uri, state ──
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/auth/google")
check "consent targets accounts.google.com" "True" "$(python3 -c "print('accounts.google.com/o/oauth2/v2/auth' in '$LOC')")"
check "redirect_uri passed to Google" "True" "$(python3 -c "from urllib.parse import urlparse,parse_qs;q=parse_qs(urlparse('$LOC').query);print(q.get('redirect_uri')==['$REDIRECT_URI'])")"
check "client_id passed to Google" "True" "$(python3 -c "from urllib.parse import urlparse,parse_qs;q=parse_qs(urlparse('$LOC').query);print(q.get('client_id')==['test-client-id.apps.googleusercontent.com'])")"
STATE=$(python3 -c "from urllib.parse import urlparse,parse_qs;print(parse_qs(urlparse('$LOC').query).get('state',[''])[0])")
[ -n "$STATE" ] && { echo "PASS [state JWT present]"; pass=$((pass+1)); } || { echo "FAIL [state JWT missing]"; fail=$((fail+1)); }

# ── 3) callback guard rails (fake code → frontend handoff with error hash) ──
CB=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/auth/google/callback?code=fake&state=$STATE")
check "fake code → frontend social-error" "$APP_URL/#social-error=token_exchange_failed" "$CB"
CB=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/auth/google/callback?state=$STATE")
check "missing code → frontend social-error" "$APP_URL/#social-error=missing_code" "$CB"
CB=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/auth/google/callback?code=fake&state=garbage")
check "bad state → frontend social-error" "$APP_URL/#social-error=bad_state" "$CB"

# ── 4) regression: languages still save ×9 (v4.11) ──
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
OT=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Owner V413\",\"email\":\"o413@t.dz\",\"phone\":\"0555110001\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"owner\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"languages":["ar","fr","en","tr","es","it","de","ru","zh"]}' >/dev/null
check "languages ×9 still persist" "9" "$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("languages",[])))')"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
