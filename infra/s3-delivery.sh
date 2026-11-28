source "$(dirname "$0")/_lib.sh"
check_floci

echo "S3 Delivery Status & Tracking"

echo "1/4 DynamoDB table DotOrderHistory (keys: orderId + eventId, sorted by time)"
make_table DotOrderHistory \
  --attribute-definitions AttributeName=orderId,AttributeType=S AttributeName=eventId,AttributeType=S \
  --key-schema AttributeName=orderId,KeyType=HASH AttributeName=eventId,KeyType=RANGE || exit 1

echo "2/4 IAM role + least-privilege policy"
make_role dot-delivery-role infra/iam/delivery-policy.json || exit 1

echo "3/4 Lambda function dot-delivery-api"
build_zip || exit 1
deploy_function dot-delivery-api lambda-delivery.handler dot-delivery-role \
  "SERVICE_NAME=delivery,CORS_ORIGINS=$WEB_ORIGIN,NODE_ENV=production,TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET" || exit 1

echo "4/4 Test with saved events (expect 200, then 404 unknown order)"
invoke_test dot-delivery-api backend/events/health.json
invoke_test dot-delivery-api backend/events/s3-track-unknown-order.json
echo "Logs: aws logs tail /aws/lambda/dot-delivery-api --since 10m --format short"
