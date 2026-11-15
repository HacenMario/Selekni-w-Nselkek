#!/usr/bin/env bash
# v4.6 API verification: "mine" prefers an ACTIVE subscription (no lingering expired banner),
# sub-lock re-enable revives the latest sub, contact page (suggestion/report + admin-editable info),
# dashboard verified/banned fields, no Windows-incompatible bash-isms in package.json scripts.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v46-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v46 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

# owner user + admin token
curl -s -o "$WORK/u.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Owner Test","email":"owner46@t.dz","phone":"0555460001","password":"secret1","gender":"male","age":31,"bloodType":"A+","role":"owner"}'
TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["token"])')
USERID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["user"]["_id"])')
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
mine_status() { curl -s "$BASE/subscriptions/mine" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;c=json.load(sys.stdin).get("current");print(c["status"] if c else "none")'; }

# --- scenario: older APPROVED sub + newer REJECTED sub → mine must report ACTIVE ---
curl -s -o /dev/null -X POST "$BASE/subscriptions" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"reference":"TR-A11111"}'
SUBA=$(curl -s "$BASE/subscriptions/mine" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["current"]["_id"])')
curl -s -o /dev/null -X POST "$BASE/admin/subscriptions/$SUBA/decide" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"action":"approve"}'
curl -s -o /dev/null -X POST "$BASE/subscriptions" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"reference":"TR-B22222"}'
SUBB=$(curl -s "$BASE/subscriptions/mine" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["current"]["_id"])')
curl -s -o /dev/null -X POST "$BASE/admin/subscriptions/$SUBB/decide" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"action":"reject"}'
check "active approved sub wins over newer rejected one" "active" "$(mine_status)"

# --- free grant → immediately active ---
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/grant-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"days":5}'
check "grant-sub shows active instantly" "active" "$(mine_status)"

# --- paid activation → immediately active ---
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/activate-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"days":30,"amountDA":3000,"reference":"TR-C33333"}'
check "activate-sub shows active instantly" "active" "$(mine_status)"

# --- sub-lock disable + re-enable → revived ACTIVE subscription ---
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/sub-lock" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"locked":true}'
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/sub-lock" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"locked":false}'
check "re-enabled account is subscribed again" "active" "$(mine_status)"

# --- contact page ---
curl -s -o "$WORK/contact.json" -X POST "$BASE/complaints/contact" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"kind":"suggestion","subject":"Improvement idea","message":"Please add dark mode colors"}'
check "contact suggestion created" "201" "$(python3 -c 'import json;print(201 if json.load(open("'"$WORK"'/contact.json")).get("kind")=="suggestion" else 500)')"
KINDS=$(curl -s "$BASE/admin/complaints?status=open" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c 'import sys,json;print(any(i.get("kind")=="suggestion" for i in json.load(sys.stdin)["items"]))')
check "suggestion visible in admin complaints" "True" "$KINDS"
curl -s -o "$WORK/setc.json" -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"contact":{"phone":"0555 46 00 00","email":"help@slekni.dz","facebook":"facebook.com/slekni","address":"Alger"}}'
PUBC=$(curl -s "$BASE/settings" | python3 -c 'import sys,json;c=json.load(sys.stdin).get("contact") or {};print("yes" if c.get("phone")=="0555 46 00 00" and c.get("email")=="help@slekni.dz" else "no")')
check "admin-edited contact info is public" "yes" "$PUBC"

# --- dashboard: verified/banned fields for the new KPI cards ---
DASH=$(curl -s "$BASE/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
check "dashboard exposes verified count" "0" "$(echo "$DASH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["users"].get("verified", -1))')"
check "dashboard exposes banned count" "0" "$(echo "$DASH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["users"].get("banned", -1))')"
check "dashboard active subs ≥1" "yes" "$(echo "$DASH" | python3 -c 'import sys,json;print("yes" if json.load(sys.stdin)["subscriptions"]["active"]>=1 else "no")')"

# --- package.json scripts must run on Windows CMD (no bash-only syntax) ---
BADS=$(python3 -c '
import json
s = json.load(open("'$ROOT'/package.json"))["scripts"]
bad = [k for k, v in s.items() if "tee" in v or "cp -r" in v or v.strip().startswith("NODE_ENV=") or "MONGODB_URI=" in v]
print(",".join(bad) if bad else "clean")')
check "no bash-isms in npm scripts (Windows CMD)" "clean" "$BADS"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
