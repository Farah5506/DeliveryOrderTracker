source "$(dirname "$0")/_lib.sh"

PASS=0; FAIL=0
pass() { echo "PASS $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL $1"; echo "     $2"; FAIL=$((FAIL + 1)); }

API_URL=$(cat out/api-url.txt 2>/dev/null)
[ -z "$API_URL" ] && { echo "No API yet: run bash infra/gateway.sh"; exit 1; }
WEB=http://localhost:4566/dot-web

call() {   # call METHOD PATH [curl args] -> sets CODE and BODY
  local method=$1 path=$2; shift 2
  BODY=$(curl -s -X "$method" -w '\n%{http_code}' --max-time 30 "$@" "$API_URL$path")
  CODE=$(echo "$BODY" | tail -n1)
  BODY=$(echo "$BODY" | sed '$d')
}

call GET /api/health
echo "$BODY" | grep -q '"runtime":"lambda"' && pass "API health answers from Lambda" || fail "API health: $CODE $BODY" "Run bash infra/gateway.sh"

call GET /api/orders
[ "$CODE" = "401" ] && pass "orders without login -> 401" || fail "orders without login -> $CODE" "requireAuth missing?"

call POST /api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DISPATCHER_EMAIL\",\"password\":\"$DISPATCHER_PASSWORD\",\"turnstileToken\":\"XXXX.DUMMY.TOKEN.XXXX\"}"
TOKEN=$(echo "$BODY" | sed -n 's/.*"token":"\([a-f0-9]*\)".*/\1/p')
[ -n "$TOKEN" ] && pass "dispatcher login -> token" || fail "dispatcher login -> $CODE $BODY" "Run bash infra/s2-couriers.sh (it creates the dispatcher). 503 = Lambda cannot reach Cloudflare: run with TURNSTILE_SECRET= bash infra/setup-everything.sh"

if [ -n "$TOKEN" ]; then
  call GET /api/orders -H "Authorization: Bearer $TOKEN"
  [ "$CODE" = "200" ] && pass "orders with dispatcher token -> 200" || fail "orders with token -> $CODE $BODY" "Check dot-orders-api logs"
  call GET /api/couriers -H "Authorization: Bearer $TOKEN"
  [ "$CODE" = "200" ] && pass "couriers with dispatcher token -> 200" || fail "couriers -> $CODE $BODY" "Check dot-couriers-api logs"
fi

call GET "/api/track/DOT-ZZZZZZ?turnstileToken=XXXX.DUMMY.TOKEN.XXXX"
[ "$CODE" = "404" ] && pass "tracking an unknown order -> 404" || fail "tracking unknown order -> $CODE $BODY" "Check dot-delivery-api logs"

call DELETE /api/orders
[ "$CODE" = "404" ] && ! echo "$BODY" | grep -q '"error"' && pass "unknown route stopped by API Gateway -> 404" || fail "DELETE /api/orders -> $CODE $BODY" "Should be stopped by API Gateway"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$WEB/index.html")
[ "$CODE" = "200" ] && pass "website index.html on S3" || fail "website -> $CODE" "Run bash infra/website.sh"
curl -s "$WEB/js/config.js" | grep -q "$API_URL" && pass "website config.js points at the API" || fail "config.js" "Run bash infra/website.sh"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$WEB/.env")
[ "$CODE" != "200" ] && pass "no .env in the public bucket" || fail "a .env file is public!" "Delete it from the bucket"

echo
echo "Result: $PASS passed, $FAIL failed"
echo "Website: $WEB/index.html   Login: $WEB/login.html   ($DISPATCHER_EMAIL / $DISPATCHER_PASSWORD)"
