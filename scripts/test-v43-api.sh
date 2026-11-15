#!/usr/bin/env bash
# v4.3 API verification: admin notifications (sub request + ID verification),
# users smart filters, dashboard idPending, admin-account exclusion from stats.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v43-test
BASE=http://127.0.0.1:3100/api

rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done

cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v43 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"

cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# --- seed: 1 owner, 1 pending-ID seeker, 1 verified-ID seeker ---
curl -s -o "$WORK/own.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Owner V43","email":"own@t.dz","phone":"0555100001","password":"secret1","gender":"male","age":30,"bloodType":"O+","role":"owner"}'
curl -s -o "$WORK/s1.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Seeker Pending\",\"email\":\"s1@t.dz\",\"phone\":\"0555100011\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":25,\"bloodType\":\"A+\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"},\"role\":\"seeker\"}"
curl -s -o "$WORK/s2.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Seeker Good\",\"email\":\"s2@t.dz\",\"phone\":\"0555100022\",\"password\":\"secret1\",\"gender\":\"female\",\"age\":28,\"bloodType\":\"O-\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"},\"role\":\"seeker\"}"
S2ID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s2.json"))["user"]["_id"])')
curl -s -o /dev/null -X POST "$BASE/admin/users/$S2ID/verify-id" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'

# --- admin notifications: id_pending on both registrations, subscription_pending on request ---
N=$(curl -s "$BASE/notifications?token=$ADMIN_TOKEN&limit=50")
NP=$(echo "$N" | python3 -c 'import sys,json;print(json.load(sys.stdin)["total"])')
IDN=$(echo "$N" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for x in d["items"] if x["type"]=="id_pending"))')
check "id_pending notifications for admin" "2" "$IDN"

OWN_TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/own.json"))["token"])')
curl -s -o /dev/null -X POST "$BASE/subscriptions" -H "Authorization: Bearer $OWN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"reference":"REF-V43-TEST-001"}'
SUBN=$(curl -s "$BASE/notifications?token=$ADMIN_TOKEN&limit=50" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for x in d["items"] if x["type"]=="subscription_pending"))')
check "subscription_pending notification for admin" "1" "$SUBN"

# --- dashboard: idPending count + admin excluded from user totals ---
D=$(curl -s "$BASE/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
IP=$(echo "$D" | python3 -c 'import sys,json;print(json.load(sys.stdin)["users"].get("idPending", -1))')
check "dashboard users.idPending" "1" "$IP"
TOT=$(echo "$D" | python3 -c 'import sys,json;print(json.load(sys.stdin)["users"]["total"])')
check "dashboard total EXCLUDES admin account" "3" "$TOT"

# --- stats: usersTotal + daily users series exclude the admin ---
ST=$(curl -s "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
UT=$(echo "$ST" | python3 -c 'import sys,json;print(json.load(sys.stdin)["smart"]["usersTotal"])')
check "smart stats usersTotal EXCLUDES admin" "3" "$UT"
UD=$(echo "$ST" | python3 -c 'import sys,json;print(sum(x["count"] for x in json.load(sys.stdin)["usersSeries"]))')
check "daily users series EXCLUDES admin" "3" "$UD"

# --- users smart filters ---
CNT() { curl -s "$BASE/admin/users?f=$1" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["total"])'; }
check "filter=owner" "1" "$(CNT owner)"
check "filter=seeker" "2" "$(CNT seeker)"
check "filter=idpending" "1" "$(CNT idpending)"
check "filter=idverified" "1" "$(CNT idverified)"
check "filter=idrejected" "0" "$(CNT idrejected)"
check "filter=banned" "0" "$(CNT banned)"
check "no filter = all users" "3" "$(CNT '')"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
