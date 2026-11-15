#!/usr/bin/env bash
# E2E test for the offer-video upload + streaming path (media.routes.ts)
# Starts a fresh mongod + the API server, uploads a real mp4 through the
# chunked API, then exercises every Range scenario a browser/iOS sends.
set -u
ROOT=/home/z/my-project
API_DIR=$ROOT/mini-services/api-server
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
WORK=/tmp/slekni-vtest
BASE=http://127.0.0.1:3100/api

rm -rf "$WORK"; mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port 27017 --bind_ip 127.0.0.1 --logpath "$WORK/mongod.log" </dev/null >/dev/null 2>&1 &
MONGOD_PID=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
(echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || { echo "FATAL: mongod failed"; cat "$WORK/mongod.log" 2>/dev/null | tail -5; exit 1; }

cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-vtest bun src/index.ts >"$WORK/api.log" 2>&1 </dev/null &
API_PID=$!

cleanup() { kill $API_PID 2>/dev/null; kill $MONGOD_PID 2>/dev/null; sleep 1; }
trap cleanup EXIT

# wait for health
for i in $(seq 1 60); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  sleep 1
  [ "$i" = 60 ] && { echo "FATAL: API never became healthy"; cat "$WORK/api.log"; exit 1; }
done
echo "OK: API + Mongo up"

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
[ -n "${TOKEN:-}" ] && echo "OK: logged in (token len ${#TOKEN})" || { echo "FATAL: login failed"; cat "$WORK/api.log"; exit 1; }

# realistic H.264/AAC mp4 (~8 MB → 2+ chunks), faststart like phone recordings
ffmpeg -y -loglevel error -f lavfi -i testsrc=duration=40:size=640x480:rate=30 \
  -f lavfi -i sine=frequency=440:duration=40 \
  -c:v libx264 -b:v 1500k -preset veryfast -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart "$WORK/test.mp4"
SIZE=$(stat -c%s "$WORK/test.mp4")
echo "OK: generated test.mp4 ($SIZE bytes)"
ORIG_SHA=$(sha256sum "$WORK/test.mp4" | cut -d' ' -f1)

# ---- chunked upload (client slices; 4 MB chunks like api.ts) ----
UPLOAD_ID=$(curl -s -X POST "$BASE/media/video/start" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadId"])')
[ -n "${UPLOAD_ID:-}" ] || { echo "FATAL: /video/start failed"; cat "$WORK/api.log"; exit 1; }
split -b 4M -d "$WORK/test.mp4" "$WORK/chunk_"
for f in "$WORK"/chunk_*; do
  R=$(curl -s -X POST "$BASE/media/video/chunk?uploadId=$UPLOAD_ID" -H "Authorization: Bearer $TOKEN" \
       -H 'Content-Type: application/octet-stream' --data-binary "@$f")
  echo "$R" | grep -q '"ok":true' || { echo "FATAL: chunk failed: $R"; exit 1; }
done
FIN=$(curl -s -X POST "$BASE/media/video/finalize?uploadId=$UPLOAD_ID&mime=video/mp4" -H "Authorization: Bearer $TOKEN")
GRID=$(echo "$FIN" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("gridId",""))')
[ -n "$GRID" ] && echo "OK: uploaded to GridFS ($GRID)" || { echo "FATAL: finalize failed: $FIN"; exit 1; }

# ---- create offer with the video ----
OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{
  \"title\":\"عرض اختبار الفيديو\",\"description\":\"اختبار بث الفيديو في تفاصيل العرض\",
  \"categoryKey\":\"other\",\"wilaya\":\"الجزائر\",\"address\":\"حي الاختبار رقم واحد\",
  \"amountDA\":1500,\"videos\":[{\"gridId\":\"$GRID\",\"mime\":\"video/mp4\"}]}")
OFFER_ID=$(echo "$OFFER" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("_id",""))')
[ -n "$OFFER_ID" ] && echo "OK: offer created ($OFFER_ID)" || { echo "FATAL: offer create failed: $OFFER"; exit 1; }

VURL="$BASE/media/video/$OFFER_ID/$GRID?token=$TOKEN"
pass=0; fail=0
check() { # name expected_status actual_status extra...
  local name=$1 exp=$2 act=$3
  if [ "$act" = "$exp" ]; then echo "PASS [$name] status=$act"; pass=$((pass+1));
  else echo "FAIL [$name] expected=$exp got=$act"; fail=$((fail+1)); fi
}

# 1) no Range -> 200 full
S=$(curl -s --max-time 15 -o "$WORK/full.bin" -D "$WORK/h1" -w '%{http_code} %{size_download}' "$VURL")
ACT=${S%% *}; BYTES=${S##* }
check "full-200" 200 "$ACT"
[ "$BYTES" = "$SIZE" ] && { echo "PASS [full-size] $BYTES"; pass=$((pass+1)); } || { echo "FAIL [full-size] got $BYTES want $SIZE"; fail=$((fail+1)); }
[ "$(sha256sum "$WORK/full.bin" | cut -d' ' -f1)" = "$ORIG_SHA" ] && { echo "PASS [full-sha256] identical"; pass=$((pass+1)); } || { echo "FAIL [full-sha256] mismatch"; fail=$((fail+1)); }

# helper: range request -> status bytes; verify Content-Range + byte equality
range_test() {
  local name=$1 rh=$2 want_from=$3 want_to=$4
  local S=$(curl -s --max-time 15 -o "$WORK/r.bin" -D "$WORK/hh" -w '%{http_code} %{size_download}' -H "Range: $rh" "$VURL")
  local ACT=${S%% *}; local BYTES=${S##* }
  local cr=$(grep -i '^content-range:' "$WORK/hh" | tr -d '\r' | cut -d' ' -f2-)
  local want_cr="bytes $want_from-$want_to/$SIZE"; local want_bytes=$((want_to-want_from+1))
  check "$name" 206 "$ACT"
  if [ "$cr" = "$want_cr" ]; then echo "PASS [$name-ContentRange] $cr"; pass=$((pass+1)); else echo "FAIL [$name-ContentRange] got '$cr' want '$want_cr'"; fail=$((fail+1)); fi
  if [ "$BYTES" = "$want_bytes" ]; then echo "PASS [$name-ContentLength] $BYTES"; pass=$((pass+1)); else echo "FAIL [$name-ContentLength] got $BYTES want $want_bytes"; fail=$((fail+1)); fi
  dd if="$WORK/test.mp4" bs=1 skip=$want_from count=$want_bytes 2>/dev/null | sha256sum | cut -d' ' -f1 > "$WORK/exp.sha"
  if [ -s "$WORK/r.bin" ] && [ "$(sha256sum "$WORK/r.bin" | cut -d' ' -f1)" = "$(cat "$WORK/exp.sha")" ]; then
    echo "PASS [$name-bytes] identical"; pass=$((pass+1));
  else echo "FAIL [$name-bytes] mismatch"; fail=$((fail+1)); fi
}

range_test "open-ended-0-"  "bytes=0-"             0 $((SIZE-1))          # Chrome/desktop first request
range_test "ios-probe-0-1"  "bytes=0-1"            0 1                    # iOS Safari initial probe
range_test "mid-100-499"    "bytes=100-499"        100 499
range_test "near-end"       "bytes=$((SIZE-1000))-" $((SIZE-1000)) $((SIZE-1))
range_test "suffix--500"    "bytes=-500"           $((SIZE-500)) $((SIZE-1)) # suffix range (spec)

# invalid token must 401
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/media/video/$OFFER_ID/$GRID?token=bad")
check "auth-bad-token" 401 "$S"
S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/media/video/$OFFER_ID/$GRID")
check "auth-no-token" 401 "$S"

# decoded full file must be a valid playable mp4
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,codec_type -of csv=p=0 "$WORK/full.bin" > "$WORK/probe.txt" 2>&1 \
  && { echo "PASS [ffprobe] $(cat "$WORK/probe.txt")"; pass=$((pass+1)); } || { echo "FAIL [ffprobe] $(cat "$WORK/probe.txt")"; fail=$((fail+1)); }

echo "=================================="
echo "RESULT: PASS=$pass FAIL=$fail"
