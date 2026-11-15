#!/usr/bin/env bash
# Start a clean local stack for browser e2e: mongod (27017) + API (3100).
# Logs and pids under /tmp/slekni-e2e/.
set -u
mkdir -p /tmp/slekni-e2e/mongo
P="/home/z/my-project/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod"

# stop leftovers by exact pids from previous runs
[ -f /tmp/slekni-e2e/mongod.pid ] && kill "$(cat /tmp/slekni-e2e/mongod.pid)" 2>/dev/null
[ -f /tmp/slekni-e2e/api.pid ] && kill "$(cat /tmp/slekni-e2e/api.pid)" 2>/dev/null
sleep 1

rm -rf /tmp/slekni-e2e/mongo && mkdir -p /tmp/slekni-e2e/mongo
"$P" --dbpath /tmp/slekni-e2e/mongo --port 27017 --bind_ip 127.0.0.1 \
  --logpath /tmp/slekni-e2e/mongod.log </dev/null >/dev/null 2>&1 &
echo $! > /tmp/slekni-e2e/mongod.pid

for i in $(seq 1 20); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; sleep 1; done
(echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null || { echo "FATAL: mongod down"; tail -5 /tmp/slekni-e2e/mongod.log; exit 1; }
echo "MONGO_UP"

cd /home/z/my-project/mini-services/api-server
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-e2e \
  nohup bun src/index.ts >/tmp/slekni-e2e/api.log 2>&1 </dev/null &
echo $! > /tmp/slekni-e2e/api.pid

for i in $(seq 1 20); do curl -sf http://127.0.0.1:3100/api/health >/dev/null 2>&1 && break; sleep 1; done
curl -sf http://127.0.0.1:3100/api/health >/dev/null || { echo "FATAL: API down"; tail -5 /tmp/slekni-e2e/api.log; exit 1; }
echo "API_UP"
