#!/usr/bin/env bash
# v4.4 API verification: avatar persistence + cache-busting, trilingual admin notifications,
# broadcast stored per-language (no mixed-language text anywhere).
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-v44-test
BASE=http://127.0.0.1:3100/api

# kill leftovers from a previous run (stale mongod would serve an old database)
pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1
pkill -f "bun src/index.ts" 2>/dev/null; sleep 1

rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-v44 nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }
echo "OK: services up"
cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; }
trap cleanup EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS [$1] = $3"; pass=$((pass+1)); else echo "FAIL [$1] expected=$2 got=$3"; fail=$((fail+1)); fi; }

# two visually different 1x1 PNGs
PNG_A='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
PNG_B='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

# --- user (owner — no ID card required) registers, uploads avatar A ---
curl -s -o "$WORK/u.json" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Avatar Tester\",\"email\":\"av@t.dz\",\"phone\":\"0555200001\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":27,\"bloodType\":\"A+\",\"avatar\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_A\"},\"role\":\"owner\"}"
TOKEN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["token"])')
USERID=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/u.json"))["user"]["_id"])')

check "avatar A served after register" "200" "$(curl -s -o "$WORK/av1.bin" -w '%{http_code}' "$BASE/images/avatar/$USERID?token=$TOKEN")"

# --- PATCH /me replaces the avatar with B → served image MUST change ---
curl -s -o "$WORK/patch.json" -X PATCH "$BASE/me" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"avatar\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG_B\"}}"
check "PATCH /me with new avatar succeeds" "200" "$(python3 -c 'import json;print(200 if json.load(open("'"$WORK"'/patch.json")).get("hasAvatar") else 500)')"
curl -s -o "$WORK/av2.bin" -w '%{http_code}' "$BASE/images/avatar/$USERID?token=$TOKEN" > "$WORK/av2.code"
check "avatar B served after update" "200" "$(cat "$WORK/av2.code")"
if cmp -s "$WORK/av1.bin" "$WORK/av2.bin"; then check "avatar bytes CHANGED after update" "DIFF" "SAME"; else check "avatar bytes CHANGED after update" "DIFF" "DIFF"; fi
UPD=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/patch.json")).get("updatedAt") is not None)')
check "PATCH response carries updatedAt (cache-buster)" "True" "$UPD"

# --- admin sends a trilingual direct message → stored per-language, no mixing ---
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -o /dev/null -X POST "$BASE/admin/notify" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"userId":"'"$USERID"'","titleAr":"رسالة عربية","titleFr":"Message français","titleEn":"English message","bodyAr":"نص عربي","bodyFr":"Texte français","bodyEn":"English body"}'
N=$(curl -s "$BASE/notifications?token=$TOKEN&limit=5")
MIXED=$(echo "$N" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=[i for i in d["items"] if i["type"]=="system"][0]["data"];print("yes" if "|" in str(x.get("titleAr","")) else "no")')
check "no mixed-language text in stored notification" "no" "$MIXED"
FRENCH=$(echo "$N" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=[i for i in d["items"] if i["type"]=="system"][0]["data"];print(x.get("titleFr",""))')
check "French reader gets French title stored" "Message français" "$FRENCH"
ARABIC=$(echo "$N" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=[i for i in d["items"] if i["type"]=="system"][0]["data"];print(x.get("titleAr",""))')
check "Arabic reader gets Arabic title stored" "رسالة عربية" "$ARABIC"

# --- broadcast to everyone → trilingual data too ---
curl -s -o "$WORK/bc.json" -X POST "$BASE/admin/notify" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"titleAr":"إعلان عام","titleFr":"Annonce générale","titleEn":"General announcement","bodyAr":"مرحبا","bodyFr":"Bonjour","bodyEn":"Hello"}'
BCN=$(python3 -c 'import json;print(json.load(open("'"$WORK"'/bc.json")).get("notified", 0))')
check "broadcast delivered to non-admin users" "1" "$BCN"
echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
