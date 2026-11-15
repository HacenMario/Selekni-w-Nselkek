#!/usr/bin/env bash
# v4.2 API verification: ID-card verification flow, blood type, package image
# bucket fix, magic-link removal. Uses a fresh mongod + API instance.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v42-test
BASE=http://127.0.0.1:3100/api

rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done

cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v42 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"

cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi
}

PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

# --- registration validation ---
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Owner Test","email":"owner@test.dz","phone":"0555000001","password":"secret1","gender":"male","age":30,"bloodType":"O+","role":"owner"}')
check "owner+bloodType registered" 201 "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"Owner Test2","email":"owner2@test.dz","phone":"0555000002","password":"secret1","gender":"male","age":30,"role":"owner"}')
check "register without bloodType rejected" 400 "$S"

S=$(curl -s -o "$WORK/r1.json" -w '%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Seeker One\",\"email\":\"seeker1@test.dz\",\"phone\":\"0555000011\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":25,\"bloodType\":\"A+\",\"role\":\"seeker\"}")
check "seeker without idCard rejected" 400 "$S"

S=$(curl -s -o "$WORK/s1.json" -w '%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Seeker One\",\"email\":\"seeker1@test.dz\",\"phone\":\"0555000011\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":25,\"bloodType\":\"A+\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"},\"role\":\"seeker\"}")
check "seeker with idCard accepted" 201 "$S"
SEEKER1_TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s1.json"))["token"])')
SEEKER1_ID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s1.json"))["user"]["_id"])')
IV=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s1.json"))["user"].get("idVerified",""))')
check "idVerified=pending at signup" "pending" "$IV"
BT=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s1.json"))["user"].get("bloodType",""))')
check "bloodType stored" "A+" "$BT"

# --- ID card privacy: image access control ---
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/images/idcard/$SEEKER1_ID?token=$ADMIN_TOKEN")
check "admin can view ID card" 200 "$S"
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/images/idcard/$SEEKER1_ID?token=$SEEKER1_TOKEN")
check "non-admin CANNOT view ID card" 403 "$S"

# --- verify flow: image wiped from DB ---
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/admin/users/$SEEKER1_ID/verify-id" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}')
check "verify-id succeeds" 200 "$S"
IV=$(curl -s "$BASE/me?token=$SEEKER1_TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["idVerified"])')
check "idVerified=verified after confirm" "verified" "$IV"
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/images/idcard/$SEEKER1_ID?token=$ADMIN_TOKEN")
check "ID card image WIPED after verify" 404 "$S"

# --- reject flow: image wiped too, reason kept ---
S=$(curl -s -o "$WORK/s2.json" -w '%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Seeker Two\",\"email\":\"seeker2@test.dz\",\"phone\":\"0555000022\",\"password\":\"secret1\",\"gender\":\"female\",\"age\":28,\"bloodType\":\"O-\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"},\"role\":\"seeker\"}")
check "second seeker registered" 201 "$S"
SEEKER2_ID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s2.json"))["user"]["_id"])')
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/admin/users/$SEEKER2_ID/reject-id" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"reason":"صورة غير واضحة"}')
check "reject-id succeeds" 200 "$S"
IV=$(python3 -c '' )
IV=$(curl -s "$BASE/me?token=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s2.json"))["token"])')" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["idVerified"]+"|"+d.get("idRejectReason",""))')
check "idVerified=rejected + reason" "rejected|صورة غير واضحة" "$IV"
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/images/idcard/$SEEKER2_ID?token=$ADMIN_TOKEN")
check "ID card image WIPED after reject" 404 "$S"

# --- re-upload resets to pending ---
S=$(curl -s -o "$WORK/s2b.json" -w '%{http_code}' -X PATCH "$BASE/me" -H "Authorization: Bearer $(python3 -c 'import json;print(json.load(open("'"$WORK"'/s2.json"))["token"])')" -H 'Content-Type: application/json' \
  -d "{\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"}}")
check "re-upload ID card accepted" 200 "$S"
IV=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/s2b.json"))["idVerified"])')
check "re-upload sets pending again" "pending" "$IV"

# --- package image: upload to packageImages bucket, serve it back (the v4 bug) ---
S=$(curl -s -o "$WORK/pkg.json" -w '%{http_code}' -X POST "$BASE/admin/package-image" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"}")
check "package image upload" 201 "$S"
GRID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/pkg.json"))["gridId"])')
CT=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$BASE/media/package/$GRID")
check "package image served (fixed bucket)" "200 image/png" "$CT"

# --- magic link fully removed ---
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/magic/request" -H 'Content-Type: application/json' -d '{"email":"x@y.dz"}')
check "magic/request removed (404)" 404 "$S"
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/magic/consume" -H 'Content-Type: application/json' -d '{"token":"whatever-token"}')
check "magic/consume removed (404)" 404 "$S"
PR=$(curl -s "$BASE/auth/providers")
echo "$PR" | grep -q '"magic"' && { echo "FAIL [providers has no magic key]"; fail=$((fail+1)); } || { echo "PASS [providers has no magic key]"; pass=$((pass+1)); }

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
