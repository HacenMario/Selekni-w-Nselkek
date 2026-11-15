#!/usr/bin/env bash
# v4.7 API verification: the "disabled by administration" state clears instantly whenever a
# NEW subscription goes live (grant / paid activation / approval), instagram contact info,
# and the v4.6 regression (mine still prefers an ACTIVE sub over a newer rejected one).
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v47-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v47 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

curl -s -o "$WORK/u.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Owner V47","email":"owner47@t.dz","phone":"0555470001","password":"secret1","gender":"male","age":33,"bloodType":"O+","role":"owner"}'
TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["token"])')
USERID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["user"]["_id"])')
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

mine() { curl -s "$BASE/subscriptions/mine" -H "Authorization: Bearer $TOKEN"; }
mine_status() { mine | python3 -c 'import sys,json;c=json.load(sys.stdin).get("current");print(c["status"] if c else "none")'; }
mine_locked() { mine | python3 -c 'import sys,json;print(json.load(sys.stdin).get("locked"))'; }
request_sub() { curl -s -o /dev/null -X POST "$BASE/subscriptions" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"reference\":\"TR-$1\"}"; }
latest_sub_id() { mine | python3 -c 'import sys,json;print(json.load(sys.stdin)["current"]["_id"])'; }

# --- grant lifts the disabled state ---
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/sub-lock" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"locked":true}'
check "locked flag reaches /mine after disable" "True" "$(mine_locked)"
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/grant-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"days":14}'
check "grant clears the disabled banner" "False" "$(mine_locked)"
check "grant shows active" "active" "$(mine_status)"

# --- paid activation lifts it too ---
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/sub-lock" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"locked":true}'
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/activate-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"days":30,"amountDA":2500,"reference":"TR-PAID47"}'
check "paid activation clears the disabled banner" "False" "$(mine_locked)"
check "paid activation shows active" "active" "$(mine_status)"

# --- approving a pending request lifts it too (request made BEFORE locking, approved while locked) ---
request_sub "P47"
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/sub-lock" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"locked":true}'
SUB=$(curl -s "$BASE/admin/subscriptions?status=pending" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c 'import sys,json;items=json.load(sys.stdin)["items"];print(items[0]["_id"] if items else "")')
curl -s -o /dev/null -X POST "$BASE/admin/subscriptions/$SUB/decide" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"action":"approve"}'
check "approval clears the disabled banner" "False" "$(mine_locked)"
check "approval shows active" "active" "$(mine_status)"

# --- regression (v4.6): an older APPROVED sub wins over a newer REJECTED one ---
request_sub "R47"
SUB2=$(latest_sub_id)
curl -s -o /dev/null -X POST "$BASE/admin/subscriptions/$SUB2/decide" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"action":"reject"}'
check "active sub still wins over newer rejected one" "active" "$(mine_status)"

# --- instagram contact info (facebook removed) ---
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"contact":{"phone":"0555 47 00 00","email":"help@slekni.dz","instagram":"instagram.com/slekni","address":"Alger"}}'
CONTACT=$(curl -s "$BASE/settings" | python3 -c 'import sys,json;c=json.load(sys.stdin).get("contact") or {};print(c.get("instagram","") , c.get("facebook","MISSING"))')
check "instagram contact is public" "instagram.com/slekni MISSING" "$CONTACT"
SUG=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/complaints/contact" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"kind":"report","subject":"Bug report","message":"The chart label is truncated on mobile"}')
check "contact report still works" "201" "$SUG"

# --- dashboard regression ---
DASH=$(curl -s "$BASE/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
check "dashboard active subs ≥1" "yes" "$(echo "$DASH" | python3 -c 'import sys,json;print("yes" if json.load(sys.stdin)["subscriptions"]["active"]>=1 else "no")')"
check "dashboard exposes verified/banned" "yes" "$(echo "$DASH" | python3 -c 'import sys,json;u=json.load(sys.stdin)["users"];print("yes" if "verified" in u and "banned" in u else "no")')"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
