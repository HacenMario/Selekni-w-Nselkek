#!/usr/bin/env bash
# v4.11 API verification: languages save (all nine), validation guards, friendly root.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v411-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v411 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
OT=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Owner V411\",\"email\":\"o411@t.dz\",\"phone\":\"0555110001\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"owner\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
[ -n "$OT" ] && [ "$OT" != "None" ] || { echo "FATAL: register failed"; exit 1; }

# ── 1) friendly root route ──
ROOT_CODE=$(curl -s -o "$WORK/root.json" -w '%{http_code}' http://127.0.0.1:3100/)
check "GET / returns 200" "200" "$ROOT_CODE"
check "root says ok" "True" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/root.json")).get("ok", False))')"

# ── 2) new default account starts with the model default (ar/fr/en) ──
DEFAULT_LANGS=$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("languages",[])))')
check "default languages count = 3" "3" "$DEFAULT_LANGS"

# ── 3) save ALL NINE languages via PATCH /me (the production bug) ──
CODE=$(curl -s -o "$WORK/patch9.json" -w '%{http_code}' -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"languages":["ar","fr","en","tr","es","it","de","ru","zh"]}')
check "PATCH /me with 9 languages accepted" "200" "$CODE"
SAVED=$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("languages",[])))')
check "all 9 languages persisted" "9" "$SAVED"

# ── 4) the old-style 3-language save still works ──
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"languages":["ar","fr","en"],"name":"Owner V411"}')
check "PATCH /me with 3 languages still works" "200" "$CODE"

# ── 5) guards: unknown code and empty array rejected ──
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"languages":["ar","klingon"]}')
check "unknown language code rejected" "400" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"languages":[]}')
check "empty languages rejected" "400" "$CODE"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
