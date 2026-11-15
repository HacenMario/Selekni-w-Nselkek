#!/usr/bin/env bash
# Slekni API verification scenario (dev). Covers the full contract golden path.
set -u
BASE="http://127.0.0.1:3100/api"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1  --> $2"; }
check() { # name expected actual
  if [ "$2" = "$3" ]; then ok "$1"; else fail "$1" "expected=$2 got=$3"; fi
}
jqget() { echo "$1" | jq -r "$2" 2>/dev/null; }
require() { # name value — abort if empty/null (critical values)
  if [ -z "$2" ] || [ "$2" = "null" ]; then echo "  ABORT: $1 is empty/null — cascading failure guard"; echo "RESULT: PASS=$PASS FAIL=$FAIL (aborted early)"; exit 1; fi
}

echo "== 1. Health & settings defaults =="
R=$(curl -s $BASE/health); check "health" "true" "$(jqget "$R" '.ok')"
R=$(curl -s $BASE/settings); check "settings price default 500" "500" "$(jqget "$R" '.subscription.priceDA')"
check "settings has 8 categories" "8" "$(jqget "$R" '.categories | length')"

echo "== 2. Super admin login (bootstrap from env) =="
R=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@slekni.dz","password":"SlekniAdmin#2026"}')
ADMIN_TOKEN=$(jqget "$R" '.token')
require "admin token" "$ADMIN_TOKEN"
check "superadmin login" "true" "$(jqget "$R" '.user.isSuperAdmin')"
AH="Authorization: Bearer $ADMIN_TOKEN"

echo "== 3. Register owner + 2 seekers =="
R=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"name":"Owner Test","email":"owner-test@slekni.dz","phone":"0555000001","password":"Passw0rd!","wilaya":"Alger","role":"owner"}')
OWNER_TOKEN=$(jqget "$R" '.token'); OWNER_ID=$(jqget "$R" '.user._id')
require "owner token" "$OWNER_TOKEN"
check "owner registered" "owner" "$(jqget "$R" '.user.role')"
OH="Authorization: Bearer $OWNER_TOKEN"
R=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"name":"Seeker One","email":"seeker1-test@slekni.dz","phone":"0555000002","password":"Passw0rd!","wilaya":"Alger","role":"seeker"}')
SEEKER1_TOKEN=$(jqget "$R" '.token'); SEEKER1_ID=$(jqget "$R" '.user._id')
require "seeker1 token" "$SEEKER1_TOKEN"
S1H="Authorization: Bearer $SEEKER1_TOKEN"
R=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"name":"Seeker Two","email":"seeker2-test@slekni.dz","phone":"0555000003","password":"Passw0rd!","wilaya":"Oran","role":"seeker"}')
SEEKER2_TOKEN=$(jqget "$R" '.token')
require "seeker2 token" "$SEEKER2_TOKEN"
S2H="Authorization: Bearer $SEEKER2_TOKEN"
# duplicate email guard
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"name":"Dup","email":"owner-test@slekni.dz","phone":"0555000009","password":"Passw0rd!"}')
check "duplicate email -> 409" "409" "$CODE"

echo "== 4. Owner sets interests? (seeker) + me endpoints =="
R=$(curl -s -X PATCH $BASE/me -H "$S1H" -H 'Content-Type: application/json' -d '{"interests":["moving","cleaning"],"skills":"Strong arms","languages":["ar","en"]}')
check "seeker interests saved" "moving" "$(jqget "$R" '.interests[0]')"
R=$(curl -s $BASE/me -H "$S1H"); check "me returns name" "Seeker One" "$(jqget "$R" '.name')"

echo "== 5. Owner gate: no subscription -> 402 =="
IMG=$(node -e "const b=Buffer.from('fffd8ffe000104100',  'hex'); console.log(b.toString('base64'))" 2>/dev/null || echo "aGVsbG8=")
CREATE_BODY='{"title":"Carry furniture 2nd floor","description":"Need 2 strong workers to carry wardrobe and boxes from apartment 2nd floor to truck outside","categoryKey":"moving","wilaya":"Alger","address":"Cité 1200 logts, Bt 7, Alger","amountDA":3500,"images":[{"mime":"image/jpeg","dataBase64":"'$IMG'"}]}'
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X POST $BASE/offers -H "$OH" -H 'Content-Type: application/json' -d "$CREATE_BODY")
check "post offer w/o subscription -> 402" "402" "$CODE"
check "error code SUBSCRIPTION_REQUIRED" "SUBSCRIPTION_REQUIRED" "$(jqget "$(cat /tmp/resp.json)" '.code')"

echo "== 6. Subscription flow: request -> admin approve =="
R=$(curl -s -X POST $BASE/subscriptions -H "$OH" -H 'Content-Type: application/json' -d '{"reference":"BM-TEST-0001"}')
SUB_ID=$(jqget "$R" '._id')
require "sub id" "$SUB_ID"
check "subscription pending" "pending" "$(jqget "$R" '.status')"
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' $BASE/admin/subscriptions -H "$AH")
check "admin lists subscriptions" "200" "$CODE"
check "admin sees pending sub" "$SUB_ID" "$(jqget "$(cat /tmp/resp.json)" '.items[0]._id')"
R=$(curl -s -X POST $BASE/admin/subscriptions/$SUB_ID/decide -H "$AH" -H 'Content-Type: application/json' -d '{"action":"approve"}')
check "sub approved" "active" "$(jqget "$R" '.status')"
R=$(curl -s $BASE/subscriptions/mine -H "$OH")
check "mine shows active" "active" "$(jqget "$R" '.current.status')"

echo "== 7. Create offer + notifications to interested seekers =="
R=$(curl -s -X POST $BASE/offers -H "$OH" -H 'Content-Type: application/json' -d "$CREATE_BODY")
OFFER_ID=$(jqget "$R" '._id')
require "offer id" "$OFFER_ID"
check "offer created open" "open" "$(jqget "$R" '.status')"
check "owner address hidden in creation response? (owner sees it)" "Cité 1200 logts, Bt 7, Alger" "$(jqget "$R" '.address')"
R=$(curl -s "$BASE/notifications?page=1" -H "$S1H")
check "seeker1 got new_offer_match" "new_offer_match" "$(jqget "$R" '.items[0].type')"
R=$(curl -s "$BASE/notifications?page=1" -H "$S2H")
N=$(jqget "$R" '.total'); check "seeker2 (no interest match) got 0" "0" "$N"

echo "== 8. Feed visibility & privacy =="
R=$(curl -s "$BASE/offers/feed" -H "$S1H")
check "feed has offer" "$OFFER_ID" "$(jqget "$R" '.items[0]._id')"
check "feed hides address" "null" "$(jqget "$R" '.items[0].address')"
R=$(curl -s "$BASE/offers/feed" -H "$S2H")
check "seeker2 feed (no interests) sees it" "$OFFER_ID" "$(jqget "$R" '.items[0]._id')"
R=$(curl -s "$BASE/offers/feed?categoryKey=moving" -H "$S2H")
check "category filter works" "$OFFER_ID" "$(jqget "$R" '.items[0]._id')"
R=$(curl -s "$BASE/offers/feed?categoryKey=cleaning" -H "$S2H")
check "wrong category filter empty" "0" "$(jqget "$R" '.total')"
R=$(curl -s "$BASE/offers/feed" -H "$OH")
check "owner does not see own offer in feed" "0" "$(jqget "$R" '.total')"

echo "== 9. Offer detail privacy =="
R=$(curl -s "$BASE/offers/$OFFER_ID" -H "$S1H")
check "detail hides address for stranger" "null" "$(jqget "$R" '.address')"
R=$(curl -s "$BASE/offers/$OFFER_ID" -H "$OH")
check "detail shows address for owner" "Cité 1200 logts, Bt 7, Alger" "$(jqget "$R" '.address')"

echo "== 10. Atomic accept: first wins, second gets 409 =="
R=$(curl -s -X POST $BASE/offers/$OFFER_ID/accept -H "$S1H")
check "seeker1 accepted" "assigned" "$(jqget "$R" '.status')"
check "accepted seeker sees address" "Cité 1200 logts, Bt 7, Alger" "$(jqget "$R" '.address')"
check "accepted seeker gets owner phone" "0555000001" "$(jqget "$R" '.ownerPhone')"
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X POST $BASE/offers/$OFFER_ID/accept -H "$S2H")
check "seeker2 accept -> 409" "409" "$CODE"
check "code ALREADY_TAKEN" "ALREADY_TAKEN" "$(jqget "$(cat /tmp/resp.json)" '.code')"
R=$(curl -s "$BASE/notifications?page=1" -H "$OH")
check "owner got offer_accepted notif" "offer_accepted" "$(jqget "$R" '.items[0].type')"

echo "== 11. Complete -> confirm -> stats =="
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X POST $BASE/offers/$OFFER_ID/complete -H "$S2H")
check "seeker2 cannot complete" "403" "$CODE"   # offer found, but seeker2 is not the assigned worker
R=$(curl -s -X POST $BASE/offers/$OFFER_ID/complete -H "$S1H")
check "seeker1 marked awaiting" "awaiting_confirmation" "$(jqget "$R" '.status')"
R=$(curl -s -X POST $BASE/offers/$OFFER_ID/confirm -H "$OH")
check "owner confirmed done" "done" "$(jqget "$R" '.status')"
R=$(curl -s $BASE/stats -H "$OH"); check "owner spent 3500" "3500" "$(jqget "$R" '.owner.totalSpentDA')"
R=$(curl -s $BASE/stats -H "$S1H"); check "seeker1 earned 3500" "3500" "$(jqget "$R" '.seeker.earnedDA')"

echo "== 12. Notifications management =="
R=$(curl -s "$BASE/notifications?page=1" -H "$S1H")
UNREAD=$(jqget "$R" '.unreadCount')
R=$(curl -s -X POST $BASE/notifications/read-all -H "$S1H"); check "read-all ok" "true" "$(jqget "$R" '.ok')"
R=$(curl -s "$BASE/notifications?page=1" -H "$S1H"); check "unread now 0" "0" "$(jqget "$R" '.unreadCount')"
R=$(curl -s -X DELETE $BASE/notifications/all -H "$S1H"); check "delete-all ok" "true" "$(jqget "$R" '.ok')"
R=$(curl -s "$BASE/notifications?page=1" -H "$S1H"); check "notifications empty" "0" "$(jqget "$R" '.total')"

echo "== 13. Images =="
IMG_ID=$(curl -s "$BASE/offers/$OFFER_ID" -H "$S1H" | jq -r '.images[0]._id')
require "image id" "$IMG_ID"
HDR=$(curl -s -o /tmp/img.bin -w '%{content_type}|%{http_code}' "$BASE/images/$OFFER_ID/$IMG_ID")
check "image served" "image/jpeg|200" "$HDR"
CACHE=$(curl -s -D - -o /dev/null "$BASE/images/$OFFER_ID/$IMG_ID" | grep -i cache-control | tr -d '\r')
echo "  cache: $CACHE"

echo "== 14. Admin: users, ban, moderation, dashboard, broadcast, settings =="
R=$(curl -s "$BASE/admin/users?q=seeker1" -H "$AH")
UID1=$(jqget "$R" '.items[0]._id')
R=$(curl -s -X POST $BASE/admin/users/$UID1/ban -H "$AH")
check "ban works" "true" "$(jqget "$R" '.isBanned')"
CODE=$(curl -s -o /tmp/resp.json -w '%{http_code}' "$BASE/offers/feed" -H "$S1H")
check "banned user blocked" "403" "$CODE"
R=$(curl -s -X POST $BASE/admin/users/$UID1/unban -H "$AH")
check "unban works" "false" "$(jqget "$R" '.isBanned')"
R=$(curl -s -X POST $BASE/admin/broadcast -H "$AH" -H 'Content-Type: application/json' -d '{"title":"صيانة","body":"تحديث النظام الليلة"}')
check "broadcast sent" "3" "$(jqget "$R" '.notified')"
R=$(curl -s "$BASE/admin/dashboard" -H "$AH")
check "dashboard offers done=1" "1" "$(jqget "$R" '.offers.done')"
R=$(curl -s -X PUT $BASE/admin/settings -H "$AH" -H 'Content-Type: application/json' -d '{"subscription":{"priceDA":750,"durationDays":45,"maxActiveOffers":5}}')
check "settings updated" "750" "$(jqget "$R" '.subscription.priceDA')"
R=$(curl -s $BASE/settings); check "public settings reflect 750" "750" "$(jqget "$R" '.subscription.priceDA')"
# restore defaults
curl -s -X PUT $BASE/admin/settings -H "$AH" -H 'Content-Type: application/json' -d '{"subscription":{"priceDA":500,"durationDays":30,"maxActiveOffers":3}}' > /dev/null

echo "== 15. Guards: auth & admin only =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/dashboard" -H "$S2H")
check "seeker cannot access admin" "403" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/stats")
check "no token -> 401" "401" "$CODE"

echo
echo "======================================"
echo "RESULT: PASS=$PASS FAIL=$FAIL"
echo "======================================"
