source "$(dirname "$0")/_lib.sh"
check_floci

echo "S2 Couriers & Assignment"

echo "1/4 DynamoDB tables DotUsers (key: id) and DotSessions (key: token)"
make_table DotUsers \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH || exit 1
make_table DotSessions \
  --attribute-definitions AttributeName=token,AttributeType=S \
  --key-schema AttributeName=token,KeyType=HASH || exit 1

echo "2/4 IAM role + least-privilege policy"
make_role dot-couriers-role infra/iam/couriers-policy.json || exit 1

echo "3/4 Lambda function dot-couriers-api"
build_zip || exit 1
deploy_function dot-couriers-api lambda-couriers.handler dot-couriers-role \
  "SERVICE_NAME=couriers,CORS_ORIGINS=$WEB_ORIGIN,NODE_ENV=production,MAX_ACTIVE_ORDERS=5,TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET" || exit 1

echo "4/4 First dispatcher account + test (expect 200, then 401 wrong password)"
(cd backend && AWS_ENDPOINT_URL=http://localhost:4566 \
  node scripts/seed-user.js dispatcher "$DISPATCHER_NAME" "$DISPATCHER_EMAIL" "$DISPATCHER_PASSWORD")
invoke_test dot-couriers-api backend/events/health.json
invoke_test dot-couriers-api backend/events/s2-login-wrong-password.json
echo "Dispatcher login: $DISPATCHER_EMAIL / $DISPATCHER_PASSWORD"
echo "Logs: aws logs tail /aws/lambda/dot-couriers-api --since 10m --format short"
