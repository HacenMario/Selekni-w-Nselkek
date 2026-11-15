#!/usr/bin/env bash
# v4.14 e2e stack: mongod + API + built frontend (standalone). Stays alive for browser testing.
pkill -f "mongod.*--port 27017" 2>/dev/null
pkill -f "bun src/index.ts" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
sleep 1
rm -rf /tmp/slekni-e2e && mkdir -p /tmp/slekni-e2e/mongo
/home/z/my-project/db/mongodb-linux-x86_64-debian12-8.0.12/bin/mongod --dbpath /tmp/slekni-e2e/mongo --port 27017 --bind_ip 127.0.0.1 --logpath /tmp/slekni-e2e/mongod.log </dev/null >/dev/null 2>&1 &
sleep 3
cd /home/z/my-project/mini-services/api-server
PORT=3100 MONGODB_URI=mongodb://127.0.0.1:27017/slekni-e2e bun src/index.ts >/tmp/slekni-e2e/api.log 2>&1 </dev/null &
sleep 3
cd /home/z/my-project
PORT=3000 HOSTNAME=127.0.0.1 node .next/standalone/server.js >/tmp/slekni-e2e/front.log 2>&1 </dev/null &
sleep 5
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3100/api/health >/dev/null 2>&1 && break; sleep 1; done
for i in $(seq 1 20); do curl -sf -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
echo "API: $(curl -s http://127.0.0.1:3100/api/health)"
echo "FRONT: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
# keep the stack alive for the whole browser session
sleep 3600
