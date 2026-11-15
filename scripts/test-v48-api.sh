#!/usr/bin/env bash
# v4.8 API verification:
# 1) accepting an offer removes its "new offer" broadcast for everyone except owner + worker
# 2) admin can delete an offer (document + every notification pointing to it)
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v48-test
BASE=http://127.0.0.1:3100/api

pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
# wait until port 27017 is REALLY free — a lingering mongod would silently serve stale data
for i in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || break; sleep 1; done
rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v48 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
# /settings touches the database (unlike /health) — guarantees real readiness
for i in $(seq 1 30); do curl -sf "$BASE/settings" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/settings" >/dev/null || { echo "FATAL: API not ready"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
reg() { curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"$1\",\"email\":\"$2\",\"phone\":\"$3\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"$4\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'; }
OT=$(reg "Owner V48" o48@t.dz 0555480001 owner)
S1=$(reg "Worker One" s148@t.dz 0555480002 seeker)
S2=$(reg "Worker Two" s248@t.dz 0555480003 seeker)
AT=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# both seekers are interested in cleaning -> they receive the new-offer broadcast
curl -s -o /dev/null -X PATCH "$BASE/me" -H "Authorization: Bearer $S1" -H 'Content-Type: application/json' -d '{"interests":["cleaning"]}'
curl -s -o /dev/null -X PATCH "$BASE/me" -H "Authorization: Bearer $S2" -H 'Content-Type: application/json' -d '{"interests":["cleaning"]}'

# posting offers requires an active subscription — grant one (v4.7 regression: grant also unlocks)
OWNERID=$(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["_id"])')
echo "--- grant response:"
curl -s -X POST "$BASE/admin/users/$OWNERID/grant-sub" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"days":30}' | head -c 200; echo
echo "--- raw offer create:"
curl -s -o "$WORK/offer.json" -X POST "$BASE/offers" -H "Authorization: Bearer $OT" -H 'Content-Type: application/json' -d '{"title":"تنظيف شقة كاملة","description":"شقة من 3 غرف تحتاج تنظيفاً شاملاً","categoryKey":"cleaning","wilaya":"الجزائر","amountDA":2500,"address":"حيدرة"}'
head -c 200 "$WORK/offer.json"; echo

OFFER=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/offer.json"))["_id"])')
check "offer created open" "open" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/offer.json"))["status"])')"

nm_count() { local TKN="$1" NK="$2" OID="$3"
  curl -s "$BASE/notifications" -H "Authorization: Bearer $TKN" | NK="$NK" OID="$OID" python3 -c '
import sys,json,os
items=json.load(sys.stdin).get("items",[])
k=os.environ["NK"]; oid=os.environ["OID"]
print(sum(1 for n in items if n["type"]==k and str(n.get("data",{}).get("offerId"))==oid))'; }

sleep 1
check "seeker1 got the new-offer broadcast" "1" "$(nm_count $S1 new_offer_match $OFFER)"
check "seeker2 got the new-offer broadcast" "1" "$(nm_count $S2 new_offer_match $OFFER)"
check "owner has NO new-offer broadcast" "0" "$(nm_count $OT new_offer_match $OFFER)"

# seeker1 accepts -> broadcast must vanish for seeker2, stay for seeker1 (worker) + owner gets accepted
curl -s -o /dev/null -X POST "$BASE/offers/$OFFER/accept" -H "Authorization: Bearer $S1"
sleep 1
check "accepted worker keeps the broadcast" "1" "$(nm_count $S1 new_offer_match $OFFER)"
check "other seeker's broadcast disappeared" "0" "$(nm_count $S2 new_offer_match $OFFER)"
check "owner got offer_accepted" "1" "$(nm_count $OT offer_accepted $OFFER)"

# admin deletes the offer -> document + every notification pointing to it are gone
curl -s -X DELETE "$BASE/admin/offers/$OFFER" -H "Authorization: Bearer $AT" > "$WORK/del.json"
echo "delete response: $(cat "$WORK/del.json" | head -c 120)"
check "admin delete returns ok" "True" "$(python3 -c 'import json;print(json.load(open("'"$WORK"'/del.json")).get("ok"))')"
LIST=$(curl -s "$BASE/admin/offers" -H "Authorization: Bearer $AT" | python3 -c "import sys,json;print(sum(1 for i in json.load(sys.stdin)['items'] if i['_id']=='$OFFER'))")
check "offer gone from admin list" "0" "$LIST"
check "worker's broadcast deleted with the offer" "0" "$(nm_count $S1 new_offer_match $OFFER)"
check "owner's accepted notif deleted with the offer" "0" "$(nm_count $OT offer_accepted $OFFER)"

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
