#!/usr/bin/env bash
# Debug the decide-approve flow step by step.
set -u
B=http://127.0.0.1:3100/api
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)" 2>/dev/null || echo "PARSE_FAIL"; }

TOKEN=$(curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"d47@t.dz","password":"secret1"}' | J '["token"]')
AT=$(curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}' | J '["token"]')
echo "TOKEN=${TOKEN:0:12}… AT=${AT:0:12}…"
UID=$(curl -s "$B/auth/me" -H "Authorization: Bearer $TOKEN" | J '["user"]["_id"]')
echo "UID=$UID"

echo "--- lock user:"
curl -s -X POST "$B/admin/users/$UID/sub-lock" -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"locked":true}'; echo
echo "--- request subscription DBGP2:"
curl -s -X POST "$B/subscriptions" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"reference":"DBGP2"}'; echo
echo "--- pending list:"
curl -s "$B/admin/subscriptions?status=pending" -H "Authorization: Bearer $AT"; echo
