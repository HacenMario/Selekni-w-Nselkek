#!/usr/bin/env bash
# v4.5 API verification: admin paid-sub activation (amount counted as revenue, not a free grant),
# grants excluded from the by-package chart, extended stats fields, trilingual notify regression.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v45-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v45 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

# user (owner) registers
curl -s -o "$WORK/u.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Sub Tester","email":"sub@t.dz","phone":"0555300001","password":"secret1","gender":"female","age":29,"bloodType":"O-","role":"owner"}'
TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["token"])')
USERID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["user"]["_id"])')
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

stats() { curl -s "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN"; }

# --- admin ACTIVATES a paid subscription with a counted amount ---
REV0=$(stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["revenueTotalDA"])')
curl -s -o "$WORK/act.json" -X POST "$BASE/admin/users/$USERID/activate-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"days":30,"amountDA":2500,"reference":"TR-998877"}'
check "activate-sub created" "201" "$(python3 -c 'import json;print(201 if json.load(open("'"$WORK"'/act.json")).get("status")=="active" else 500)')"
check "activated sub carries the paid amount" "2500" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/act.json"))["amountDA"])')"
check "activated sub keeps the admin reference" "TR-998877" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/act.json"))["reference"])')"
REV1=$(stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["revenueTotalDA"])')
check "revenue includes the activated amount" "$((REV0+2500))" "$REV1"
check "active subscriptions KPI counts it" "1" "$(stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["smart"]["subsActive"])')"

# --- a FREE grant must NOT appear in the by-package chart nor change revenue ---
BP0=$(stats | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["subsByPackage"]))')
curl -s -o /dev/null -X POST "$BASE/admin/users/$USERID/grant-sub" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"days":7}'
REV2=$(stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["revenueTotalDA"])')
BP1=$(stats | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["subsByPackage"]))')
check "free grant does not change revenue" "$REV1" "$REV2"
check "free grant does not appear in by-package chart" "yes" "$(python3 -c "print('yes' if '$BP0'=='$BP1' else 'no')")"

# --- extended stats fields exist ---
EXT=$(stats | python3 -c 'import sys,json;s=json.load(sys.stdin)["smart"];print(all(k in s for k in ["usersByRole","idStatus","offersByStatus","usersBanned","subsActive","complaints","tasksDone"]))')
check "extended stats fields present" "True" "$EXT"
check "roles split has the owner" "1" "$(stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["smart"]["usersByRole"].get("owner",0))')"

# --- trilingual notify regression (no mixed-language storage) ---
curl -s -o /dev/null -X POST "$BASE/admin/notify" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"userId":"'"$USERID"'","titleAr":"أهلا","titleFr":"Bonjour","titleEn":"Hello","bodyAr":"ن","bodyFr":"t","bodyEn":"b"}'
MIX=$(curl -s "$BASE/notifications?token=$TOKEN&limit=5" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=[i for i in d["items"] if i["type"]=="system"][0]["data"];print("yes" if "|" in str(x.get("titleAr","")) else "no")')
check "notifications still stored per-language" "no" "$MIX"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
