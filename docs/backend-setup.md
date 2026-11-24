## Who owns what

| Owner | Backend files | Floci script | AWS services in their own service |
|---|---|---|---|
| *Meret (S1 Orders)* | routes/orders.js, controllers/orders.js, services/orderService.js, services/geocodingService.js, lambda-orders.js, infra/iam/orders-policy.json | infra/s1-orders.sh | Lambda dot-orders-api, DynamoDB DotOrders, IAM dot-orders-role, CloudWatch Logs /aws/lambda/dot-orders-api, API Gateway routes /api/orders... |
| *Malak (S2 Couriers + login)* | routes/auth.js, routes/couriers.js, routes/assignment.js, controllers/auth.js, controllers/couriers.js, controllers/assignment.js, services/authService.js, services/courierService.js, services/assignmentService.js, middleware/auth.js, lib/passwords.js, scripts/seed-user.js, lambda-couriers.js, infra/iam/couriers-policy.json | infra/s2-couriers.sh | Lambda dot-couriers-api, DynamoDB DotUsers + DotSessions, IAM dot-couriers-role, CloudWatch Logs, API Gateway routes /api/auth, /api/couriers, /assignment |
| *Farah (S3 Delivery + deployment)* | routes/deliveries.js, routes/tracking.js, controllers/deliveries.js, controllers/tracking.js, services/deliveryService.js, services/trackingService.js, services/historyService.js, middleware/turnstile.js, lambda-delivery.js, infra/iam/delivery-policy.json | infra/s3-delivery.sh, infra/gateway.sh, infra/website.sh | Lambda dot-delivery-api, DynamoDB DotOrderHistory, IAM dot-delivery-role, CloudWatch Logs, *API Gateway dot-http-api, **S3 bucket dot-web* |
| *Shared* | app.js, server.js, lib/db.js, lib/errors.js, lib/validate.js, package.json, scripts/zip-lambda.js, infra/_lib.sh, infra/setup-everything.sh, infra/check.sh, infra/floci/docker-compose.yml | | |
1. Start Floci (Lab 6 Part 1). In Git Bash, from the project folder:
   bash
   docker compose -f infra/floci/docker-compose.yml up -d
   export AWS_PROFILE=floci MSYS_NO_PATHCONV=1
   aws sts get-caller-identity --query Account --output text
   
2. Copy backend/.env.example to backend/.env. Its values already point at Floci.
3. Create the tables, roles and functions in one go:
   bash
   bash infra/setup-everything.sh
   
4. Start the API on your PC, and in a second Git Bash window the frontend:
   bash
   cd backend && npm run dev
   
   bash
   cd frontend && npm install && npm start
   
5. Open http://localhost:8080/login.html and log in with dispatcher@dot.test / Dispatcher123.

## B. Your own evidence (each person, on your own laptop)

Run *your* script and take screenshots for your individual statement:

bash
bash infra/s1-orders.sh      # Meret
bash infra/s2-couriers.sh    # Malak
bash infra/s3-delivery.sh    # Farah


Take these screenshots in Floci Dash (http://localhost:4566/_floci/ui):
- your DynamoDB table and its items
- your Lambda function's settings: handler, role, environment variables
- your IAM role and its policy
- your CloudWatch log group, with the request lines

Also screenshot the script output: the two saved-event tests at the end.

## C. The demo laptop (Farah)

bash
bash infra/setup-everything.sh


- The last line should say Result: 10 passed, 0 failed.
- *Website:* http://localhost:4566/dot-web/index.html
- *Staff login:* http://localhost:4566/dot-web/login.html

After changing *backend code*, run the owner's script again; it updates the function. For example:

bash
bash infra/s1-orders.sh


After changing *frontend files*:

bash
bash infra/website.sh


Then press Ctrl + F5 in the browser.

## D. If something fails

| Problem | Fix |
|---|---|
| Floci is not running | Start Docker Desktop and wait for "Engine running", then run docker compose -f infra/floci/docker-compose.yml up -d |
| Login answers *503 BOT_CHECK_UNAVAILABLE* | The Lambda can't reach Cloudflare. Switch the check off for the demo with TURNSTILE_SECRET= bash infra/setup-everything.sh, and list it under limitations. |
| New orders always say "address not verified" | The Lambda can't reach Nominatim (no internet inside Docker). The order is still saved, as designed. |
| API answers 500 | Read the logs: aws logs tail /aws/lambda/dot-orders-api --since 10m --format short (or dot-couriers-api, dot-delivery-api) |
| $ paths turn into C:/Program Files/... | export MSYS_NO_PATHCONV=1 (the scripts already set it) |
| Browser says "blocked by CORS" | Open the site with localhost, not 127.0.0.1 |
| Website shows old files | bash infra/website.sh, then Ctrl + F5 |

## E. Testing for the report

Open docs/dot-api-tests.http with the VS Code *REST Client* extension:
- Set @baseUrl to the API address in out/api-url.txt.
- Run the tests in order.
- Copy each result into the report's testing table.