export AWS_PROFILE=floci AWS_PAGER="" MSYS_NO_PATHCONV=1
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1

ACCOUNT=000000000000
REGION=us-east-1
WEB_ORIGIN=http://localhost:4566        

TURNSTILE_SECRET=${TURNSTILE_SECRET-1x0000000000000000000000000000000AA}

DISPATCHER_NAME=${DISPATCHER_NAME:-Dina Dispatcher}
DISPATCHER_EMAIL=${DISPATCHER_EMAIL:-dispatcher@dot.test}
DISPATCHER_PASSWORD=${DISPATCHER_PASSWORD:-Dispatcher123}

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
mkdir -p out

check_floci() {
  if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Floci is not running. Start Docker Desktop, then:"
    echo "  docker compose -f infra/floci/docker-compose.yml up -d"
    exit 1
  fi
}

make_table() {
  local name=$1; shift
  if aws dynamodb describe-table --table-name "$name" > /dev/null 2>&1; then
    echo "  table $name already exists"
  else
    aws dynamodb create-table --table-name "$name" "$@" --billing-mode PAY_PER_REQUEST > /dev/null || return 1
    aws dynamodb wait table-exists --table-name "$name"
    echo "  table $name created"
  fi
}

make_role() {
  local role=$1 policy_file=$2
  if aws iam get-role --role-name "$role" > /dev/null 2>&1; then
    echo "  role $role already exists"
  else
    aws iam create-role --role-name "$role" \
      --assume-role-policy-document file://infra/iam/trust-policy.json > /dev/null || return 1
    echo "  role $role created"
  fi
  aws iam put-role-policy --role-name "$role" --policy-name "$role-policy" \
    --policy-document "file://$policy_file" || return 1
  echo "  policy $policy_file attached to $role"
}

build_zip() {
  if [ "${SKIP_BUILD:-0}" = "1" ] && [ -f backend/lambda.zip ]; then
    echo "  using the existing backend/lambda.zip"
    return 0
  fi
  (cd backend && npm install --no-audit --no-fund --loglevel=error && npm run zip --silent)
}

deploy_function() {
  local fn=$1 handler=$2 role=$3 env=$4
  local role_arn="arn:aws:iam::$ACCOUNT:role/$role"

  if aws lambda get-function --function-name "$fn" > /dev/null 2>&1; then
    aws lambda update-function-code --function-name "$fn" --zip-file fileb://backend/lambda.zip > /dev/null || return 1
    aws lambda wait function-updated-v2 --function-name "$fn"
    aws lambda update-function-configuration --function-name "$fn" \
      --runtime nodejs24.x --handler "$handler" --role "$role_arn" --timeout 15 \
      --environment "Variables={$env}" > /dev/null || return 1
    aws lambda wait function-updated-v2 --function-name "$fn"
    echo "  function $fn updated"
  else
    aws lambda create-function --function-name "$fn" \
      --runtime nodejs24.x --handler "$handler" --role "$role_arn" --timeout 15 \
      --zip-file fileb://backend/lambda.zip \
      --environment "Variables={$env}" > /dev/null || return 1
    echo "  function $fn created"
  fi
  aws lambda wait function-active-v2 --function-name "$fn"
}

invoke_test() {
  aws lambda invoke --function-name "$1" --payload "file://$2" \
    --cli-binary-format raw-in-base64-out "out/$1.json" > /dev/null
  echo "  $(basename "$2" .json): $(cat "out/$1.json")"
}
