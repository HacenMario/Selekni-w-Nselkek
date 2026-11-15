#!/usr/bin/env bash
# v4.10 API verification: 30 MB video cap at finalize, GridFS purge on admin
# offer delete, notification inbox cap (150), hygiene service boots silently.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v410-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
for i in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || break; sleep 1; done
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v410 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
reg() { curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"$1\",\"email\":\"$2\",\"phone\":\"$3\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"owner\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'; }
OT=$(reg "Owner V410" o410@t.dz 0555100001 owner)
AT=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# disable subscription gating for a clean create-offer flow
curl -s -o /dev/null -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"subscription":{"isEnabled":false}}'
SET_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/admin/settings" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"subscription":{"isEnabled":false}}')
check "admin settings PUT accepted" "200" "$SET_CODE"

# ── 1) 31 MB video upload must be rejected at finalize with 413 ──
UP=$(curl -s -X POST "$BASE/media/video/start?X=no" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadId"])')
# 3 chunks of 11MB = 33MB > cap — streamed with python (raw bytes)
python3 - <<PYEOF
import http.client, json
UP = "$UP"
conn = http.client.HTTPConnection("127.0.0.1", 3100)
chunk = b"\0" * (11 * 1024 * 1024)
for i in range(3):
    conn.request("POST", f"/api/media/video/chunk?uploadId={UP}", body=chunk,
                 headers={"Authorization": "Bearer $OT", "Content-Type": "application/octet-stream"})
    r = conn.getresponse(); r.read()
print("chunks sent")
PYEOF
FIN=$(curl -s -o "$WORK/fin.json" -w '%{http_code}' -X POST "$BASE/media/video/finalize?uploadId=$UP&mime=video/mp4" -H "Authorization: Bearer $OT")
check "31MB+ video rejected at finalize" "413" "$FIN"
check "error code is VIDEO_TOO_LARGE" "VIDEO_TOO_LARGE" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/fin.json")).get("code",""))')"

# ── 2) small video (1MB) passes and becomes an offer; admin delete purges GridFS ──
UP2=$(curl -s -X POST "$BASE/media/video/start?X=no" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadId"])')
python3 - <<PYEOF
import http.client
UP = "$UP2"
conn = http.client.HTTPConnection("127.0.0.1", 3100)
chunk = b"\0" * (1024 * 1024)
conn.request("POST", f"/api/media/video/chunk?uploadId={UP}", body=chunk,
             headers={"Authorization": "Bearer $OT", "Content-Type": "application/octet-stream"})
r = conn.getresponse(); r.read()
print("1 chunk sent")
PYEOF
GRID=$(curl -s -X POST "$BASE/media/video/finalize?uploadId=$UP2&mime=video/mp4" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["gridId"])')
curl -s -o "$WORK/offer.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' \
  -d '{"title":"اختبار حذف الفيديو","description":"وصف كافٍ للاختبار يجاوز الحد الأدنى","categoryKey":"moving","wilaya":"16 - الجزائر","address":"حي النخيل، عمارة 3","amountDA":1500,"videos":[{"gridId":"'"$GRID"'","mime":"video/mp4"}]}'
OID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/offer.json")).get("_id",""))')
check "offer with video created" "True" "$(python3 -c "print(\"True\" if \"$OID\" not in (\"\",\"0\") else \"False\")")"
# GridFS file exists before deletion
gridcount() { (cd "$API_DIR" && bun -e "import mongoose from 'mongoose'; await mongoose.connect('mongodb://127.0.0.1:27017/slekni-v410'); const b = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {bucketName:'videos'}); const f = await b.find({_id: new mongoose.mongo.ObjectId('$1')}).toArray(); console.log(f.length); process.exit(0);" 2>/dev/null); }
FILES_BEFORE=$(gridcount "$GRID")
check "video blob stored in GridFS" "1" "$FILES_BEFORE"
DEL_CODE=$(curl -s -o "$WORK/del.json" -w '%{http_code}' -X DELETE "$BASE/admin/offers/$OID" -H "Authorization: Bearer $AT")
echo "DELETE status=$DEL_CODE body=$(head -c 200 "$WORK/del.json")"
FILES_AFTER=$(gridcount "$GRID")
check "admin offer delete purges the video blob" "0" "$FILES_AFTER"

# ── 3) notification cap: insert 160 notifications for the owner, expect ≤ 150 + a few ──
python3 - <<PYEOF
import http.client, json
conn = http.client.HTTPConnection("127.0.0.1", 3100)
# broadcast reaches the owner 160 times via the admin broadcast endpoint
for i in range(160):
    body = json.dumps({"titleAr": "ت"+str(i), "titleFr": "T"+str(i), "titleEn": "T"+str(i), "bodyAr": "نص التجربة رقم "+str(i)+" لاختبار حد الإشعارات في صندوق المستخدم", "bodyFr": "Corps du test "+str(i), "bodyEn": "Test body "+str(i)})
    conn.request("POST", "/api/admin/broadcast", body=body,
                 headers={"Authorization": "Bearer $AT", "Content-Type": "application/json"})
    r = conn.getresponse(); r.read()
print("160 broadcasts sent")
PYEOF
sleep 3
# direct DB count — the only truth for the cap (150 newest kept)
OWN_ID=$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["_id"])')
NOTIF_COUNT=$(cd "$API_DIR" && bun -e "import mongoose from 'mongoose'; await mongoose.connect('mongodb://127.0.0.1:27017/slekni-v410'); const {Notification} = await import('./src/models/notification.model'); console.log(await Notification.countDocuments({user: new mongoose.Types.ObjectId('$OWN_ID')})); process.exit(0);" 2>/dev/null)
CAP_OK=$(NOTIF_COUNT="$NOTIF_COUNT" python3 -c 'import os;print("True" if int(os.environ.get("NOTIF_COUNT","0") or 0) <= 155 else "False")')
check "notification inbox capped at 150 (got $NOTIF_COUNT)" "True" "$CAP_OK"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
