# Restricted customer-journey preparation — 25 October 2026

Status: owner approved deployment. API registration and narrow Nginx routes passed live readiness checks before publication of this frontend change; SES delivery to the approved owner inbox is confirmed. Full customer registration/verification/payment acceptance remains for the owner to perform in Chrome. Infra execution evidence is kept in its deployment handoff. Frontend publication uses only the existing GitHub Actions pipeline.

## Observed checkpoint

Deployed frontend: b57e082d4a6f58b9c3693350e68d6f8873fa038b (including Firefox/storybook fix).
Local preparation branch: fix/sandbox-customer-registration; worktree colorful-life-frontend-customer-journey.
API, Worker and isolated PostgreSQL reported healthy. Owner ACL remains 86.181.63.155/32; public exception remains the exact signed PayPal webhook.

At 14:39:33 UTC, Order #3 was locally PENDING, payment PENDING, PayPal APPROVED, GBP29.98, zero captures. Deadline 14:47:11 UTC. Manual capture is cancelled; leave normal Worker expiry/reconciliation untouched. This observation does not assert later expiry has already occurred.

## Blocking controls and proposed change

1. Frontend intentionally hides signup in Sandbox. A new public build-time setting, VITE_SANDBOX_REGISTRATION_ENABLED=true, opts into the existing signup form. Default remains disabled. Password confirmation, legal notice and existing authentication API are preserved. Password recovery remains hidden.
2. Restricted runtime hardcodes REGISTRATION_ENABLED=false. Enabling it needs owner approval and deployment coordination; no backend business-logic rewrite is proposed.
3. Nginx has no signup/verification routes. Add only owner-restricted POST /api/auth/signup, /api/auth/verify-email and /api/auth/resend-verification, preserving backend signup/recovery protection and all other restrictions. Do not install a catch-all proxy.
4. Signup creates an unverified account and catches delivery errors. Checkout correctly requires verified email. Current restricted containers have no SES credentials and cannot obtain IMDS credentials. Establish approved SES delivery to the owner's test inbox, including a verified sender and recipient eligibility if SES is in Sandbox. Do not auto-verify users or bypass token verification. Existing hardcoded SES sender must be checked against the approved identity before use. Any IAM/email configuration change requires approval.

## Checkout already implemented

Lazy PayPal SDK uses GBP, capture intent and Sandbox client ID. SDK createOrder calls backend initiation; onApprove invokes authenticated backend capture and checks authoritative order state. Cancel/error never assert payment success. Confirmation shows order number, total and explicit payment/order confirmation. These are source/test confirmations, not a completed browser E2E PASS.

## Focused local evidence

Six account/checkout test files: 15 passed, zero failures (account forms, default Sandbox restrictions, registration opt-in matrix, opt-in markup, PayPal SDK handlers and checkout). TypeScript build-mode check, scoped ESLint and git diff --check passed. No image build, release, live deployment or database mutation performed.

## Controlled test after approval

Coordinate exclusive deployment ownership first; preserve current storefront assets and Firefox fix. Owner registers a new account through the storefront, follows the verification email and logs in. Owner selects an in-stock real product, uses the cart and delivery/billing forms, then authorizes PayPal inside that same storefront's SDK popup. No API-created orders or standalone approval links. Observe one order, genuine signed webhook receipt, authoritative capture/order state, stock commitment and Worker effects; verify displayed order number and amount. Report each result independently; none of these future E2E steps is claimed as passed.
