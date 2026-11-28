source "$(dirname "$0")/_lib.sh"
check_floci

API_NAME=dot-http-api

echo "API Gateway $API_NAME"

# Start from a clean API every time (the new API gets a new id; website.sh picks it up)
OLD_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
if [ -n "$OLD_ID" ] && [ "$OLD_ID" != "None" ]; then
  aws apigatewayv2 delete-api --api-id "$OLD_ID"
  echo "  removed the old API $OLD_ID"
fi

API_ID=$(aws apigatewayv2 create-api --name $API_NAME --protocol-type HTTP --query ApiId --output text) || exit 1
echo "  API $API_ID created"

integration() {
  aws apigatewayv2 create-integration --api-id "$API_ID" \
    --integration-type AWS_PROXY --payload-format-version 2.0 \
    --integration-uri "arn:aws:lambda:$REGION:$ACCOUNT:function:$1" \
    --query IntegrationId --output text
}

add_routes() {
  local target=$1; shift
  for ROUTE in "$@"; do
    aws apigatewayv2 create-route --api-id "$API_ID" --route-key "$ROUTE" \
      --target "integrations/$target" --query RouteKey --output text | sed 's/^/    /'
  done
}

allow_api() {
  aws lambda remove-permission --function-name "$1" --statement-id apigw-invoke > /dev/null 2>&1
  aws lambda add-permission --function-name "$1" --statement-id apigw-invoke \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" > /dev/null
}

echo "  S1 Order Management -> dot-orders-api"
S1=$(integration dot-orders-api) || exit 1
add_routes "$S1" \
  "GET /api/health" \
  "GET /api/orders" "POST /api/orders" "OPTIONS /api/orders" \
  "GET /api/orders/{id}" "PATCH /api/orders/{id}" "OPTIONS /api/orders/{id}" \
  "PATCH /api/orders/{id}/cancel" "OPTIONS /api/orders/{id}/cancel"

echo "  S2 Couriers, Assignment and login -> dot-couriers-api"
S2=$(integration dot-couriers-api) || exit 1
add_routes "$S2" \
  "POST /api/auth/login" "OPTIONS /api/auth/login" \
  "GET /api/auth/me" "OPTIONS /api/auth/me" \
  "GET /api/couriers" "POST /api/couriers" "OPTIONS /api/couriers" \
  "PATCH /api/couriers/{id}" "OPTIONS /api/couriers/{id}" \
  "PATCH /api/orders/{id}/assignment" "DELETE /api/orders/{id}/assignment" "OPTIONS /api/orders/{id}/assignment"

echo "  S3 Delivery Status & Tracking -> dot-delivery-api"
S3=$(integration dot-delivery-api) || exit 1
add_routes "$S3" \
  "GET /api/deliveries" "OPTIONS /api/deliveries" \
  "PATCH /api/deliveries/{id}/status" "OPTIONS /api/deliveries/{id}/status" \
  "GET /api/deliveries/{id}/history" "OPTIONS /api/deliveries/{id}/history" \
  "GET /api/track/{orderNumber}" "OPTIONS /api/track/{orderNumber}"

aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy > /dev/null || exit 1

allow_api dot-orders-api
allow_api dot-couriers-api
allow_api dot-delivery-api
echo "  each function now accepts calls from this API only"

API_URL=http://$API_ID.execute-api.localhost.floci.io:4566
echo "$API_URL" > out/api-url.txt
echo
echo "API_URL=$API_URL"
echo "Test it: $API_URL/api/health"
echo "Routes:  aws apigatewayv2 get-routes --api-id $API_ID --query \"Items[].RouteKey\" --output table"
