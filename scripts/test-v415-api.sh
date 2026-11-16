#!/usr/bin/env bash
# v4.15 API verification — dues page upgrade end-to-end:
# self-healing VAPID push key → optional description/GPS-only offers → workersNeeded
# → location privacy → payment-proof submit → admin review (approve = settle, reject)
# → official CCP/RIP coordinates editable in settings → 50 MB video cap → proof badge.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v415-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v415 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
jq() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
reg() { curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"$1\",\"email\":\"$2\",\"phone\":\"$3\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"$4\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | jq 'd["token"]'; }
OT=$(reg "Owner V415" o415@t.dz 0555150001 owner)
ST=$(reg "Worker V415" w415@t.dz 0555150002 seeker)
SW=$(reg "Stranger V415" s415@t.dz 0555150003 seeker)
AT=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | jq 'd["token"]')
[ -n "$OT" ] && [ -n "$ST" ] && [ -n "$AT" ] || { echo "FATAL: tokens missing"; exit 1; }

# 1) v4.15 — self-healing web push: the public VAPID key is served with zero env config
curl -s -o "$WORK/vapid.json" "$BASE/notifications/vapid-public"
check "vapid-public served" "True" "$(python3 -c 'import json;print(len(json.load(open("'"$WORK"'/vapid.json")).get("publicKey",""))>50)')"
VP2=$(curl -s "$BASE/notifications/vapid-public" | jq 'd["publicKey"]')
check "vapid key stable across calls" "$VP2" "$(curl -s "$BASE/notifications/vapid-public" | jq 'd["publicKey"]')"

# 2) description is OPTIONAL now
curl -s -o "$WORK/o1.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"نقل خزانة مكتبية من الطابق الثاني","categoryKey":"moving","address":"شارع ديدوش مراد 12، الجزائر الوسطى","amountDA":4000}'
check "offer WITHOUT description" "open" "$(jq 'd["status"]' < "$WORK/o1.json")"
OID=$(jq 'd["_id"]' < "$WORK/o1.json")

# 3) GPS-only offer (no address at all) is accepted, coordinates stored
curl -s -o "$WORK/o2.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"تركيب ماكينة غسيل في الشقة","description":"","categoryKey":"repair","location":{"lat":36.7538,"lng":3.0588},"workersNeeded":2,"amountDA":3000}'
check "GPS-only offer created" "open" "$(jq 'd["status"]' < "$WORK/o2.json")"
check "location stored" "36.7538" "$(jq 'd["location"]["lat"]' < "$WORK/o2.json")"
check "workersNeeded stored" "2" "$(jq 'd["workersNeeded"]' < "$WORK/o2.json")"
OID2=$(jq 'd["_id"]' < "$WORK/o2.json")

# 4) neither address nor location → rejected
check "no place at all rejected (400)" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"title":"عنوان ونص مفقودان تماما هنا","categoryKey":"other","amountDA":100}')"

# 5) privacy: a stranger sees neither address nor location; owner does
curl -s "$BASE/offers/$OID2" -H "Authorization: Bearer $SW" > "$WORK/stranger.json"
check "stranger sees no location" "None" "$(jq 'd.get("location","None")' < "$WORK/stranger.json")"
curl -s "$BASE/offers/$OID2" -H "Authorization: Bearer $OT" > "$WORK/owner.json"
check "owner sees location" "36.7538" "$(jq 'd["location"]["lat"]' < "$WORK/owner.json")"
check "feed hides location" "False" "$(curl -s "$BASE/offers/feed?scope=all" -H "Authorization: Bearer $ST" | python3 -c 'import sys,json;items=json.load(sys.stdin)["items"];print(any("location" in i for i in items))')"

# 6) complete the first task to create dues for the executor
curl -s -X POST "$BASE/offers/$OID/accept" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID/complete" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID/confirm" -H "Authorization: Bearer $OT" >/dev/null
curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" > "$WORK/mine.json"
MONTH=$(jq 'd["months"][0]["month"]' < "$WORK/mine.json")
check "dues commission 15% of 4000" "600" "$(jq 'd["totals"]["unpaidDA"]' < "$WORK/mine.json")"

# 7) the official CCP/RIP coordinates ride along /dues/mine (defaults pre-filled)
check "CCP default served" "0040740276" "$(jq 'd["payment"]["ccp"]' < "$WORK/mine.json")"
check "CCP key default served" "57" "$(jq 'd["payment"]["ccpKey"]' < "$WORK/mine.json")"
check "RIP default served" "00799999004074027657" "$(jq 'd["payment"]["rip"]' < "$WORK/mine.json")"

# 8) payment-proof flow: submit → admin sees pending → image reachable → approve settles the month
curl -s -o "$WORK/proof.json" -X POST "$BASE/dues/proof" -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' \
  -d "{\"month\":\"$MONTH\",\"image\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"},\"note\":\"BaridiMob — V415TEST\"}"
check "proof submitted" "pending" "$(jq 'd["status"]' < "$WORK/proof.json")"
PID=$(jq 'd["_id"]' < "$WORK/proof.json")

curl -s "$BASE/dues/admin/proofs?status=pending" -H "Authorization: Bearer $AT" > "$WORK/proofs.json"
check "admin sees pending proof" "1" "$(jq 'len(d["items"])' < "$WORK/proofs.json")"
check "proof carries sender" "Worker V415" "$(jq 'd["items"][0]["user"]["name"]' < "$WORK/proofs.json")"
check "stranger blocked from proofs (403)" "403" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dues/admin/proofs" -H "Authorization: Bearer $ST")"
check "proof image served to admin" "70" "$(curl -s "$BASE/dues/admin/proofs/$PID/image" -H "Authorization: Bearer $AT" | wc -c | tr -d ' ')"
check "proof image blocked for user" "403" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dues/admin/proofs/$PID/image" -H "Authorization: Bearer $ST")"

check "dashboard counts pending proofs" "1" "$(curl -s "$BASE/admin/dashboard" -H "Authorization: Bearer $AT" | jq 'd["dues"]["proofsPending"]')"
check "submit notification reached admin" "dues_proof_submitted" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $AT" | jq 'd["items"][0]["type"]')"

curl -s -o "$WORK/approve.json" -X POST "$BASE/dues/admin/proofs/$PID/approve" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"note":"V415 approved"}'
check "approve settles month" "600" "$(jq 'd["settlement"]["amountDA"]' < "$WORK/approve.json")"
check "month now paid" "0" "$(curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" | jq 'd["totals"]["unpaidDA"]')"
check "approval notification sent" "dues_proof_approved" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["type"]')"
check "proof image wiped after decision (404)" "404" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dues/admin/proofs/$PID/image" -H "Authorization: Bearer $AT")"
check "proof for settled month refused (400)" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dues/proof" -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' -d "{\"month\":\"$MONTH\",\"image\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}")"

# 9) reject flow on a fresh unpaid month
curl -s -o "$WORK/o3.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"دهان سياج الحديقة المنزلي بالكامل","description":"صباغة زيتية لون أخضر","categoryKey":"painting","address":"حي النصر، قسنطينة","amountDA":2000}'
OID3=$(jq 'd["_id"]' < "$WORK/o3.json")
curl -s -X POST "$BASE/offers/$OID3/accept" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID3/complete" -H "Authorization: Bearer $ST" >/dev/null
curl -s -X POST "$BASE/offers/$OID3/confirm" -H "Authorization: Bearer $OT" >/dev/null
MONTH2=$(curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" | jq 'd["months"][0]["month"]')
P2=$(curl -s -X POST "$BASE/dues/proof" -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' -d "{\"month\":\"$MONTH2\",\"image\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | jq 'd["_id"]')
curl -s -o /dev/null -X POST "$BASE/dues/admin/proofs/$P2/reject" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"reason":"الصورة غير واضحة"}'
check "rejected status stored" "rejected" "$(curl -s "$BASE/dues/proofs/mine" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["status"]')"
check "rejection reason kept" "الصورة غير واضحة" "$(curl -s "$BASE/dues/proofs/mine" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["reviewNote"]')"
check "rejection notification sent" "dues_proof_rejected" "$(curl -s "$BASE/notifications" -H "Authorization: Bearer $ST" | jq 'd["items"][0]["type"]')"
check "month stays unpaid after reject" "300" "$(curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" | jq 'd["totals"]["unpaidDA"]')"

# 10) the administration edits the CCP/RIP coordinates from settings
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"duesPayment":{"ccp":"0040740299","ccpKey":"58","rip":"00799999004074029999"}}'
curl -s "$BASE/dues/mine" -H "Authorization: Bearer $ST" > "$WORK/mine2.json"
check "CCP editable" "0040740299" "$(jq 'd["payment"]["ccp"]' < "$WORK/mine2.json")"
check "RIP editable" "00799999004074029999" "$(jq 'd["payment"]["rip"]' < "$WORK/mine2.json")"

# 11) video cap raised to 50 MB: finalize refuses >50 MB (413) and accepts <50 MB
OT2="$OT"
UP=$(curl -s -X POST "$BASE/media/video/start" -H "Authorization: Bearer $OT2" | jq 'd["uploadId"]')
python3 -c "import sys;open('/tmp/slekni-v415-test/big.bin','wb').write(b'V'*51*1024*1024)"
dd if=/dev/zero of="$WORK/big.bin" bs=1M count=51 status=none
for i in $(seq 0 12); do
  dd if="$WORK/big.bin" of="$WORK/chunk.bin" bs=4M skip=$i count=1 status=none 2>/dev/null
  SZ=$(stat -c%s "$WORK/chunk.bin" 2>/dev/null || echo 0)
  [ "$SZ" = "0" ] && break
  curl -s -o /dev/null -X POST "$BASE/media/video/chunk?uploadId=$UP" -H "Authorization: Bearer $OT2" -H 'Content-Type: application/octet-stream' --data-binary "@$WORK/chunk.bin"
done
check "51MB video finalize refused (413)" "413" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/media/video/finalize?uploadId=$UP&mime=video/mp4" -H "Authorization: Bearer $OT2")"

UP2=$(curl -s -X POST "$BASE/media/video/start" -H "Authorization: Bearer $OT2" | jq 'd["uploadId"]')
dd if=/dev/zero of="$WORK/small.bin" bs=1M count=2 status=none
curl -s -o /dev/null -X POST "$BASE/media/video/chunk?uploadId=$UP2" -H "Authorization: Bearer $OT2" -H 'Content-Type: application/octet-stream' --data-binary "@$WORK/small.bin"
check "2MB video finalize accepted (201)" "201" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/media/video/finalize?uploadId=$UP2&mime=video/mp4" -H "Authorization: Bearer $OT2")"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
[ "$fail" = "0" ]
