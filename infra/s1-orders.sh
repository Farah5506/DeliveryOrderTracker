
source "$(dirname "$0")/_lib.sh"
check_floci

echo "S1 Order Management"

echo "1/4 DynamoDB table DotOrders (key: id = order number)"
make_table DotOrders \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH || exit 1

echo "2/4 IAM role + least-privilege policy"
make_role dot-orders-role infra/iam/orders-policy.json || exit 1

echo "3/4 Lambda function dot-orders-api"
build_zip || exit 1
deploy_function dot-orders-api lambda-orders.handler dot-orders-role \
  "SERVICE_NAME=orders,CORS_ORIGINS=$WEB_ORIGIN,NODE_ENV=production" || exit 1

echo "4/4 Test with saved events (expect 200, then 401)"
invoke_test dot-orders-api backend/events/health.json
invoke_test dot-orders-api backend/events/s1-list-orders-no-login.json
echo "Logs: aws logs tail /aws/lambda/dot-orders-api --since 10m --format short"
