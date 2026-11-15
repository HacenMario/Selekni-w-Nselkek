#!/usr/bin/env bash
# v4.10 debug: broadcast -> notification flow, with visible responses
set -u
API_DIR=/home/z/my-project/mini-services/api-server
MONGOD=/home/z/my-project/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
pkill -f "mongod.*--port 27017" 2>/dev/null; sleep 1; pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf /tmp/slekni-ndbg; mkdir -p /tmp/slekni-ndbg/mongo
"$MONGOD" --dbpath /tmp/slekni-ndbg/mongo --port 27017 --bind_ip 127.0.0.1 --fork --logpath /tmp/slekni-ndbg/mongod.log >/dev/null 2>&1
cd "$API_DIR"
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-ndbg nohup bun src/index.ts >/tmp/slekni-ndbg/api.log 2>&1 &
sleep 6
BASE=http://127.0.0.1:3100/api
AT=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
OT=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" -d "{\"name\":\"N\",\"email\":\"ndbg@t.dz\",\"phone\":\"0555000001\",\"password\":\"secret1\",\"gender\":\"male\",\"age\":30,\"bloodType\":\"B+\",\"role\":\"owner\",\"idCard\":{\"mime\":\"image/png\",\"dataBase64\":\"$PNG\"}}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
for i in 1 2 3; do
  curl -s -X POST "$BASE/admin/broadcast" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"title\":\"ب$i\",\"body\":\"نص التجربة\"}"; echo
done
echo "ME: $(curl -s "$BASE/me" -H "Authorization: Bearer $OT" | head -c 100)"
echo "NOTIFS: $(curl -s "$BASE/notifications?limit=5" -H "Authorization: Bearer $OT" | head -c 200)"
bun -e 'import mongoose from "mongoose"; await mongoose.connect("mongodb://127.0.0.1:27017/slekni-ndbg"); const {Notification} = await import("./src/models/notification.model"); console.log("DB COUNT:", await Notification.countDocuments({})); process.exit(0);'
pkill -f "bun src/index.ts" 2>/dev/null
