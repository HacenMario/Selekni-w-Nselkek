#!/usr/bin/env bash
# dbg48 v2 — print the RAW register response to see why it fails here but worked in the real test.
set -u
ROOT=/home/z/my-project
MONGOD=$ROOT/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod
B=http://127.0.0.1:3100/api
pkill -f "mongod.*--port 27017" 2>/dev/null; pkill -f "bun src/index.ts" 2>/dev/null; sleep 1
rm -rf /tmp/dbg48 && mkdir -p /tmp/dbg48/mongo
"$MONGOD" --dbpath /tmp/dbg48/mongo --port 27017 --bind_ip 127.0.0.1 --logpath /tmp/dbg48/mongod.log </dev/null >/dev/null 2>&1 &
MP=$!
for i in $(seq 1 30); do sleep 1; (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; done
cd $ROOT/mini-services/api-server
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/dbg48 nohup bun src/index.ts > /tmp/dbg48/api.log 2>&1 </dev/null &
AP=$!
for i in $(seq 1 30); do curl -sf "$B/health" >/dev/null 2>&1 && break; sleep 1; done
echo "--- raw register response:"
curl -s -w "\nHTTP=%{http_code}\n" -X POST "$B/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"O","email":"o48d@t.dz","phone":"0555481001","password":"secret1","gender":"male","age":30,"bloodType":"B+","role":"owner"}'
kill $AP $MP 2>/dev/null
