cd "$(dirname "$0")/.." || exit 1

bash infra/s3-delivery.sh               || exit 1   # Farah (builds backend/lambda.zip)
SKIP_BUILD=1 bash infra/s2-couriers.sh  || exit 1   # Malak
SKIP_BUILD=1 bash infra/s1-orders.sh    || exit 1   # Meret
bash infra/gateway.sh                   || exit 1   # Farah
bash infra/website.sh                   || exit 1   # Farah
echo
bash infra/check.sh
