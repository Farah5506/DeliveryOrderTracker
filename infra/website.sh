source "$(dirname "$0")/_lib.sh"
check_floci

BUCKET=dot-web

if [ ! -s out/api-url.txt ]; then
  echo "No API address yet. Run bash infra/gateway.sh first."
  exit 1
fi
API_URL=$(cat out/api-url.txt)

echo "Website on S3 bucket $BUCKET"

sed -i "s#^const FLOCI_API = .*#const FLOCI_API = \"$API_URL\";#" frontend/js/config.js
echo "  config.js -> $API_URL"

aws s3 mb "s3://$BUCKET" > /dev/null 2>&1 && echo "  bucket $BUCKET created" || echo "  bucket $BUCKET already exists"

aws s3 sync frontend "s3://$BUCKET" --delete \
  --exclude "package.json" --exclude "vercel.json" --exclude "node_modules/*" > /dev/null || exit 1

aws s3 cp frontend "s3://$BUCKET" --recursive --exclude "*" --include "*.html" --content-type text/html > /dev/null
aws s3 cp frontend/css "s3://$BUCKET/css" --recursive --content-type text/css > /dev/null
aws s3 cp frontend/js "s3://$BUCKET/js" --recursive --content-type text/javascript > /dev/null

aws s3 ls "s3://$BUCKET" --recursive
echo
echo "Public tracking page: http://localhost:4566/$BUCKET/index.html"
echo "Staff login:          http://localhost:4566/$BUCKET/login.html"
echo "(use localhost, not 127.0.0.1, and press Ctrl + F5 after changes)"
