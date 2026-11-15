#!/usr/bin/env bash
# Persistent manual repro environment: fresh mongod + API + one offer with a video.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/vman
BASE=http://127.0.0.1:3100/api

rm -rf "$WORK"; mkdir -p "$WORK/mongo"
nohup "$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done

cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-vman nohup bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
for i in $(seq 1 30); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/health" >/dev/null || { echo "FATAL: API not healthy"; tail -5 "$WORK/api.log"; exit 1; }

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

ffmpeg -y -loglevel error -f lavfi -i testsrc=duration=30:size=640x480:rate=30 \
  -f lavfi -i sine=frequency=440:duration=30 \
  -c:v libx264 -b:v 1200k -preset veryfast -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart "$WORK/test.mp4"

UPLOAD_ID=$(curl -s -X POST "$BASE/media/video/start" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadId"])')
split -b 4M -d "$WORK/test.mp4" "$WORK/chunk_"
for f in "$WORK"/chunk_*; do
  curl -s -X POST "$BASE/media/video/chunk?uploadId=$UPLOAD_ID" -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/octet-stream' --data-binary "@$f" >/dev/null
done
FIN=$(curl -s -X POST "$BASE/media/video/finalize?uploadId=$UPLOAD_ID&mime=video/mp4" -H "Authorization: Bearer $TOKEN")
GRID=$(echo "$FIN" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("gridId",""))')
OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{
  \"title\":\"عرض اختبار الفيديو اليدوي\",\"description\":\"تشخيص بث الفيديو مع رينج\",
  \"categoryKey\":\"other\",\"wilaya\":\"الجزائر\",\"address\":\"حي الاختبار رقم واحد\",
  \"amountDA\":1500,\"videos\":[{\"gridId\":\"$GRID\",\"mime\":\"video/mp4\"}]}")
OFFER_ID=$(echo "$OFFER" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("_id",""))')

printf '%s\n' "$TOKEN" > "$WORK/token"; printf '%s\n' "$GRID" > "$WORK/grid"; printf '%s\n' "$OFFER_ID" > "$WORK/offer"
echo "SETUP OK  size=$(stat -c%s "$WORK/test.mp4")  grid=$GRID  offer=$OFFER_ID"
echo "VURL=$BASE/media/video/$OFFER_ID/$GRID?token=$TOKEN"
