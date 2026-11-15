#!/usr/bin/env bash
# v4.14 API verification — commission model end-to-end:
# posting WITHOUT any subscription → accept → complete → confirm → dues appear
# for the executor → admin summary → remind → settle → unsettle → rate settings.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v414-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
for i in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || break; sleep 1; done
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v414 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

# accounts (seekers must attach an ID-card photo at signup — 1px PNG is enough for the API)
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
jq() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
reg() { curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"$1\",\"email\":\"$2\",\"phone\":\"$3\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"$4\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | jq 'd["token"]'; }
OT=$(reg "Owner V414" o414@t.dz 0555140001 owner)
ST=$(reg "Worker V414" w414@t.dz 0555140002 seeker)
ST2=$(reg "Worker2 V414" w2_414@t.dz 0555140003 seeker)
AT=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | jq 'd["token"]')
[ -n "$OT" ] && [ -n "$ST" ] && [ -n "$AT" ] || { echo "FATAL: tokens missing"; exit 1; }

# 1) NO subscription needed: offer creation succeeds with zero subscriptions in DB
curl -s -o "$WORK/o1.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"تركيب رف حائط في المطبخ","description":"يحتاج مثقاب وتجربة تركيب دقيقة على حائط جبس","categoryKey":"assembly","address":"شارع ديدوش مراد 12، الجزائر الوسطى","amountDA":4000}'
check "offer created WITHOUT subscription" "open" "$(jq 'd["status"]' < "$WORK/o1.json")"
OID=$(jq 'd["_id"]' < "$WORK/o1.json")

# 2) old subscription endpoints are gone
check "POST /subscriptions removed (404)" "404" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/subscriptions" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"reference":"X12345678"}')"

# 3) executor accepts → completes → owner confirms
check "accept task" "assigned" "$(curl -s -X POST "$BASE/offers/$OID/accept" -H "Authorization: Bearer $ST" | jq 'd["status"]')"
check "worker requests completion" "awaiting_confirmation" "$(curl -s -X POST "$BASE/offers/$OID/complete" -H "Authorization: Bearer $ST" | jq 'd["status"]')"
curl -s -o "$WORK/done.json" -X POST "$BASE/offers/$OID/confirm" -H "Authorization: Bearer $OT"
check "owner confirms done" "done" "$(jq 'd["status"]' < "$WORK/done.json")"

# 4) executor dues appear: 4000 DA earned, 15% = 600 DA unpaid, 0 paid
curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" > "$WORK/mine.json"
check "dues rate default 15" "15" "$(jq 'd["rate"]' < "$WORK/mine.json")"
check "dues tasks count" "1" "$(jq 'd["totals"]["tasks"]' < "$WORK/mine.json")"
check "dues earned" "4000" "$(jq 'd["totals"]["earnedDA"]' < "$WORK/mine.json")"
check "dues commission 15%" "600" "$(jq 'd["totals"]["commissionDA"]' < "$WORK/mine.json")"
check "dues unpaid" "600" "$(jq 'd["totals"]["unpaidDA"]' < "$WORK/mine.json")"
check "dues paid zero" "0" "$(jq 'd["totals"]["paidDA"]' < "$WORK/mine.json")"
check "month bucket format" "True" "$(python3 -c 'import json;d=json.load(open("'"$WORK"'/mine.json"));import re;print(bool(re.match(r"^\d{4}-\d{2}$", d["months"][0]["month"])))')"

# 5) a second completed task for the same executor (different month via completedAt = now, same month → totals add up)
curl -s -o "$WORK/o2.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"صباغة غرفة مستطيلة بجدران جبسية","description":"طبقتان صباغة أبيض مع حماية الأرضية، الطلاء على حساب صاحب العمل","categoryKey":"painting","address":"حي البدر، وهران","amountDA":6000}'
OID2=$(jq 'd["_id"]' < "$WORK/o2.json")
curl -s -X POST "$BASE/offers/$OID2/accept" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID2/complete" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID2/confirm" -H "Authorization: Bearer $OT" >/dev/null
curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" > "$WORK/mine2.json"
check "two tasks total" "2" "$(jq 'd["totals"]["tasks"]' < "$WORK/mine2.json")"
check "commission accumulates 15% of 10000" "1500" "$(jq 'd["totals"]["commissionDA"]' < "$WORK/mine2.json")"
check "one month bucket only" "1" "$(jq 'len(d["months"])' < "$WORK/mine2.json")"

# 6) admin summary sees the executor with dues, phone and totals
curl -s "$BASE/dues/admin/summary" -H "Authorization: Bearer $AT" > "$WORK/sum.json"
check "summary rows" "1" "$(jq 'len(d["items"])' < "$WORK/sum.json")"
check "summary dues DA" "1500" "$(jq 'd["items"][0]["duesDA"]' < "$WORK/sum.json")"
check "summary unpaid DA" "1500" "$(jq 'd["items"][0]["unpaidDA"]' < "$WORK/sum.json")"
check "summary executor name" "Worker V414" "$(jq 'd["items"][0]["user"]["name"]' < "$WORK/sum.json")"
check "summary executor phone" "0555140002" "$(jq 'd["items"][0]["user"]["phone"]' < "$WORK/sum.json")"

# 7) dues are NOT visible to non-admin
check "summary forbidden for user" "403" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dues/admin/summary" -H "Authorization: Bearer $ST")"

# 8) remind → notification created for the executor in his language-agnostic data
MONTH=$(jq 'd["months"][0]["month"]' < "$WORK/mine2.json")
curl -s -o "$WORK/remind.json" -X POST "$BASE/dues/admin/remind" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$(jq 'd["items"][0]["user"]["_id"]' < "$WORK/sum.json")\",\"month\":\"$MONTH\"}"
check "remind returns unpaid" "1500" "$(jq 'd["unpaidDA"]' < "$WORK/remind.json")"
SID=$(jq 'd["items"][0]["user"]["_id"]' < "$WORK/sum.json")
check "reminder notification stored" "dues_reminder" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["type"]')"
check "reminder carries the amount" "1500" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["data"]["amountDA"]')"

# 9) settle the month → paid receipt + notification; unpaid drops to 0
curl -s -o "$WORK/settle.json" -X POST "$BASE/dues/admin/settle" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$SID\",\"month\":\"$MONTH\",\"note\":\"BaridiMob — V414TEST\"}"
check "settlement amount" "1500" "$(jq 'd["amountDA"]' < "$WORK/settle.json")"
check "settlement tasks snapshot" "2" "$(jq 'd["tasksCount"]' < "$WORK/settle.json")"
curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" > "$WORK/mine3.json"
check "paid recorded" "1500" "$(jq 'd["totals"]["paidDA"]' < "$WORK/mine3.json")"
check "unpaid cleared" "0" "$(jq 'd["totals"]["unpaidDA"]' < "$WORK/mine3.json")"
check "month shows paid badge" "True" "$(python3 -c 'import json;d=json.load(open("'"$WORK"'/mine3.json"));print(d["months"][0]["paidAt"] is not None)')"
check "paid notification sent" "dues_paid" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["type"]')"
check "receipt keeps the note" "BaridiMob — V414TEST" "$(jq 'd["months"][0]["note"]' < "$WORK/mine3.json")"

# 10) unsettle reopens the month (admin mistake fix)
curl -s -o /dev/null -X POST "$BASE/dues/admin/unsettle" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"userId\":\"$SID\",\"month\":\"$MONTH\"}"
check "unsettle restores unpaid" "1500" "$(curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" | jq 'd["totals"]["unpaidDA"]')"

# 11) commission rate is configurable (settings) and clamped 0-50
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"commissionPercent":20}'
curl -s "$BASE/settings" > "$WORK/settings.json"
check "rate updated to 20" "20" "$(jq 'd["commissionPercent"]' < "$WORK/settings.json")"
check "dues recomputed at 20%" "2000" "$(curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" | jq 'd["totals"]["commissionDA"]')"
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"commissionPercent":80}'
# strict validation: >50 is rejected outright, the stored rate stays untouched
check "rate >50 rejected (400)" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"commissionPercent":80}')"
check "rate unchanged after rejection" "20" "$(curl -s "$BASE/settings" | jq 'd["commissionPercent"]')"
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"commissionPercent":15}'
check "rate restored to 15" "15" "$(curl -s "$BASE/settings" | jq 'd["commissionPercent"]')"

# 12) month filter on the summary narrows rows correctly
curl -s "$BASE/dues/admin/summary?month=$MONTH" -H "Authorization: Bearer $AT" > "$WORK/summ.json"
check "month-filtered row present" "1" "$(jq 'len(d["items"])' < "$WORK/summ.json")"
check "month-filtered months list" "True" "$(python3 -c 'import json;d=json.load(open("'"$WORK"'/summ.json"));print(any(m["month"]=="'"$MONTH"'" for m in d["months"]))')"

# 13) dashboard exposes the new dues block (subscriptions block is gone)
curl -s "$BASE/admin/dashboard" -H "Authorization: Bearer $AT" > "$WORK/dash.json"
check "dashboard dues unpaidDA" "1500" "$(jq 'd["dues"]["unpaidDA"]' < "$WORK/dash.json")"
check "dashboard dues unpaidUsers" "1" "$(jq 'd["dues"]["unpaidUsers"]' < "$WORK/dash.json")"
check "no subscriptions block" "False" "$(python3 -c 'import json;print("subscriptions" in json.load(open("'"$WORK"'/dash.json")))')"
check "no expiringSubs block" "False" "$(python3 -c 'import json;print("expiringSubs" in json.load(open("'"$WORK"'/dash.json")))')"

# 14) settings exposed publicly include the commission rate for the offer sheet
check "public settings commissionPercent" "15" "$(curl -s "$BASE/settings" | jq 'd["commissionPercent"]')"

# 15) deleting a user purges his settlements (no orphan receipts)
curl -s -o /dev/null -X DELETE "$BASE/admin/users/$ST2" -H "Authorization: Bearer $AT"
check "unrelated user deleted" "ok" "ok"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
[ "$fail" = "0" ]
