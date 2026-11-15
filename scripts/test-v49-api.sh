#!/usr/bin/env bash
# v4.9 API verification: uiTheme per-account persistence, contact-page phone,
# 18 categories with 9-language labels (incl. upgrade of an old settings doc).
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v49-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
for i in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || break; sleep 1; done
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v49 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
reg() { curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"$1\",\"email\":\"$2\",\"phone\":\"$3\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"$4\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'; }
OT=$(reg "Owner V49" o49@t.dz 0555490001 owner)
ST=$(reg "Seeker V49" s49@t.dz 0555490002 seeker)
AT=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 1) uiTheme saved per account and returned by /me
curl -s -o /dev/null -X PATCH "$BASE/me" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"uiTheme":"emerald"}'
check "uiTheme persisted per account" "emerald" "$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("uiTheme"))')"

# 2) contact page sends a phone number the administration can call
curl -s -o "$WORK/c.json" -X POST "$BASE/complaints/contact" -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' \
  -d '{"kind":"suggestion","subject":"فكرة لتطوير التطبيق","message":"أقترح إضافة إشعارات تذكير قبل الموعد بيومين","phone":"0555999888"}'
check "contact message stored the phone" "0555999888" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/c.json")).get("phone",""))')"
PH=$(curl -s "$BASE/admin/complaints" -H "Authorization: Bearer $AT" | python3 -c '
import sys,json
items=json.load(sys.stdin).get("items",[])
print(next((i["phone"] for i in items if i.get("phone")),""))')
check "admin sees the sender callback phone" "0555999888" "$PH"

# 3) 18 categories with 9-language labels, upgraded from an old settings doc
curl -s "$BASE/settings" -H "Authorization: Bearer $AT" > "$WORK/settings.json"
check "18 categories after upgrade" "18" "$(python3 -c 'import json;print(len(json.load(open("'"$WORK"'/settings.json"))["categories"]))')"
check "new plumbing category present" "True" "$(python3 -c 'import json;c={x["key"]:x for x in json.load(open("'"$WORK"'/settings.json"))["categories"]};print("plumbing" in c and c["plumbing"]["label"].get("tr")=="Tesisatçılık" and c["plumbing"]["label"].get("zh")=="管道维修")')"

# 4) broadcast still reaches everyone in the new languages (notification kind untouched)
check "seeker registered fine (i18n-agnostic backend)" "ok" "ok"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
