# Issue #66 local remediation and review notes

Scope: local source/tests only. No staging, commits, pushes, PRs, production access or Stripe API calls. Existing Stage 2/3 services, databases, fixtures and evidence were not changed.

## Baselines and isolation

- Frontend: `ed671535d6346048c20ce4a37e348b5d1e7abc78` (`origin/main`, merged PR #65 / Issue #64).
- Backend: `9fc8810dce915610d8638f52e087793afac0632c` (`origin/main`, merged PR #178).
- Frontend worktree: `/home/yejun_guan/projects/colorful-life-frontend-issue-66`, branch `issue-66-stage2-remediation`.
- Backend worktree: `/home/yejun_guan/projects/colorful-life-backend-issue-66`, branch `issue-66-stripe-reconciliation`.
- Disposable PostgreSQL cluster: `/tmp/colorful-life-issue66-pg`, loopback port **55466**, database `colorful_life_test`. Tests use a scrubbed environment with fake provider credentials and real-provider opt-ins disabled. Committed migrations were applied only to this disposable database.
- Separate HTTP diagnostics: backend **3086**, Vite **5187** targeting that backend. No workers. Pointer-only Vite **5186** has every API request mocked by the browser harness and external requests aborted.
- Test/reproduction logs, including unsuccessful runs: `/tmp/colorful-life-issue66-evidence`. Original `/tmp/colorful-life-e2e-64-20261015` evidence was read, never modified.

## Findings

### Stripe correlation: CONFIRMED / FIXED

Against archived, checksum-verified baseline application code and a second disposable PostgreSQL cluster on port 55467, a different PaymentIntent was adopted for a `pending:` payment using matching numeric order metadata and amount. In both LEGACY and MANAGED fixtures the payment became SUCCEEDED, the order became CONFIRMED, and reserved stock was consumed. No local creation key was supplied by the foreign event. A managed attempt ID is also sequential and is not environment ownership evidence. Unrelated metadata-only receipts could block managed admission, customer payment-window projection and database-enforced stock release. The initial implementation also locked metadata-matching orders before establishing ownership. This is a service-level defect under a shared account/event-signing context, not evidence of an unsigned webhook bypass or a demonstrated live exploit.

Mitigation:

- Fresh Stripe creation keys are random UUIDs persisted before I/O; retries reuse the persisted key. This also avoids account-wide idempotency collisions from `order-N-stripe` across databases.
- Creation metadata carries the opaque `paymentKey`, numeric order ID and, for managed payments, attempt ID. An unbound webhook must prove this persisted random identity, plus order/attempt and financial identity, before locking or binding the order.
- A bound payment uses the exact locally persisted PaymentIntent reference. Webhooks validate GBP, amount against both payment and order, and applicable metadata. Validation is repeated after acquiring the order lock.
- Provider create/retrieve responses are checked before binding or exposing a client secret. A stale asynchronous response cannot overwrite a newer local attempt.
- Unknown events remain auditable but metadata order IDs alone no longer block Stripe admission, window projection or release guards. Exact locally bound provider references still preserve legitimate unresolved/success evidence guards.
- Early receipt replay selects the exact provider reference and now works in legacy initiation too. Valid early events with the creation key can still recover a lost create response in both modes.
- Old **unbound** predictable pending keys cannot safely establish remote ownership; they fail closed for manual reconciliation. They are never automatically rotated or redispatched. Already-bound existing intents remain compatible without newly introduced metadata.
- Signature verification, customer authentication/ownership, payment-window admission, paid-state monotonicity, inventory conversion and duplicate-event uniqueness remain in place. No client secret is logged, persisted or placed in a URL.

The new backend migration replaces the two release-guard functions without changing historical migrations or business rows. It is required with the backend source fix; it has not been applied to any preserved or production database.

### Catalogue interaction: CONFIRMED / FIXED (account); bookmark hardening verified

Normal desktop account clicks on the open book hit the decorative `book-shell__cover` (reproduced at 1280×720 and 1365×768). That decorative cover now ignores pointer hits. Artwork, geometry, stacking, cover animations and paper interactions are retained.

An additional tablet tap defect was reproduced at 820×1180: synthetic hover inserted a guest hint between touch events and the click was retargeted to `user-cart-group`. Guest hints now respond to mouse pointer entry and visible keyboard focus, rather than synthetic touch hover.

Independent bookmark interception was not reproduced on this baseline. The bookmark artwork, clipping and stacking are preserved; ordinary pointer/touch navigation, including exposed tips overlapping the cover edge, is covered by the checked-in browser regression. A trial cover stacking change was removed because it was unnecessary and could change the intended visual overlap.

### Payment copy and grammar: CONFIRMED / FIXED

An active Stripe form now says it is ready for payment, instead of suggesting the customer must resume a previous checkout. A read-only existing-checkout snapshot retains the correct resume message. Processing, unresolved, verification, retry and paid messages remain backend-authoritative. Order history uses `1 item` and plural `items` for other counts.

### Initial HTTP 404: NOT REPRODUCED on current baseline

Preserved browser console evidence contains 404s for `/api/categories` on an earlier local server. The current frontend requests `/api/categories`; Vite strips `/api`; the backend mounts `GET /categories`. Twelve real initial page loads through the isolated Vite proxy and backend all returned **200** for categories, with **zero 404 responses**. No production endpoint or preserved service was contacted. There is insufficient evidence to distinguish an earlier server/proxy/version mismatch; no speculative routing change was made.

### PostgreSQL warning: CONFIRMED dependency diagnostic, documented

With installed Prisma/adapter-pg **7.9.1** and pg **8.23.0**, one awaited relational `tx.order.findFirst({ include: ... })` reproduces `client.query() when the client is already executing a query`. Sequential scalar calls on the same transaction produce zero warnings. The captured stack identifies Prisma's query-plan `Array.map` dispatch into `PgTransaction.performIO`; pg's current implementation queues those queries and emits a deprecation warning about pg 9.

This does not establish a query-result corruption defect. Application code also uses some `Promise.all` transaction reads, but removing those alone would not resolve the demonstrated single-call ORM case. No warnings were hidden and no speculative dependency upgrade or broad relation-query refactor was introduced. Dependency compatibility with a future pg major remains follow-up work.

## Repeating the pointer check

`scripts/check-catalogue-pointers.mjs` exports `checkCataloguePointers(browser, origin)` for a Playwright Browser and a dedicated loopback Vite server. It creates/closes its own contexts, mocks all API responses, blocks other origins, and uses real mouse/tap hit testing without forced clicks or DOM activation. Checks cover seven viewports, all six visible bookmarks per desktop/tablet layout, account access with the book open/closed, hidden mobile bookmarks and the normal cover animation. No new browser framework dependency was added to the app.

## Validation and limits

Actual final counts and command outcomes are recorded in the owner-facing implementation report and the evidence logs. Earlier failures are retained: baseline correlation assertions, fixture updates required by stricter response validation, a missing managed fixture operation/immutable-ledger cleanup error, browser harness setup errors and the tablet tap reproduction. They were corrected without weakening production guards.

The isolated checks mock payment providers. A signed HTTP webhook test uses Stripe's local signature generator with a fake signing secret, not Stripe infrastructure. Real Stripe Test Mode delayed delivery, 3DS and multi-listener behavior still require independent Stage 3 validation. No shared-account Stripe E2E run was initiated.

## Exact source inventory

All files below are unstaged and uncommitted. Ignored dependencies/build products are excluded.

### Frontend

- `docs/issue-66-remediation.md` (new)
- `scripts/check-catalogue-pointers.mjs` (new)
- `src/components/BookShell.css`
- `src/components/account/CustomerOrders.test.tsx`
- `src/components/account/CustomerOrders.tsx`
- `src/components/catalogue/BookOwnedUser.tsx`
- `src/components/checkout/Checkout.tsx`
- `src/components/checkout/PaymentWindowCheckout.test.tsx`
- `src/components/checkout/PaymentWindowNotice.tsx`
- `src/features/auth/session.test.tsx`

### Backend

- `docs/payment-resolution-runtime.md`
- `prisma/migrations/20261016120000_stripe_owned_inbox_correlation/migration.sql` (new)
- `src/__tests__/cartProvenance.integration.test.ts`
- `src/__tests__/checkoutPaymentHardening.integration.test.ts`
- `src/__tests__/customerPaymentWindow.integration.test.ts`
- `src/__tests__/orderCancellation.integration.test.ts`
- `src/__tests__/paymentResolutionRuntime.integration.test.ts`
- `src/__tests__/paymentSafeCancellationExpiry.integration.test.ts`
- `src/__tests__/stripePaymentHttp.integration.test.ts`
- `src/__tests__/stripePaymentService.test.ts`
- `src/__tests__/stripeReconciliation.test.ts`
- `src/domain/payments/customerPaymentWindow.ts`
- `src/domain/payments/paymentResolutionService.ts`
- `src/domain/payments/stripePaymentService.ts`
- `src/domain/payments/stripeReconciliationService.ts`

## Final validation results

| Check | Frontend | Backend |
| --- | --- | --- |
| Focused regression suites | 228 passed, 0 failed, 0 skipped (7 files) | 223 passed, 0 failed, 0 skipped (10 files) |
| Full suite | 909 passed, 0 failed, 0 skipped (64 files) | 1,385 passed, 0 failed, 3 opt-in external Stripe sandbox tests skipped (1,388 total) |
| Type checking | Passed (`tsc -b`, also included in production build) | Passed (`tsc --noEmit -p .`) |
| Lint | ESLint passed | No configured lint script or configuration; not claimed as a passing check |
| Build | TypeScript + Vite production build passed | TypeScript production build passed |
| Whitespace | `git diff --check` passed | `git diff --check` passed |

Five new frontend tests and twenty new backend tests were added; existing fixtures and assertions were strengthened for the new Stripe identity contract. The separate browser harness passed **45** account/bookmark/animation cases across seven viewports, plus mobile bookmark-visibility assertions. These are Chromium mouse/touch emulations; physical devices and Safari are untested. The HTTP initial-load diagnostic returned 12 category responses of 200, zero 404s.

Backend focused command: `/tmp/colorful-life-issue66-run node dist/testing/runTests.js run` with the compiled stripeReconciliation, stripePaymentService, stripePaymentHttp.integration, checkoutPaymentHardening.integration, paymentResolutionRuntime.integration, customerPaymentWindow.integration, customerPaymentWindow, cartProvenance.integration, orderCancellation.integration and paymentSafeCancellationExpiry.integration test files. Full command: `/tmp/colorful-life-issue66-run npm test`. The runner scrubs inherited environment variables and targets only the disposable database.

Frontend focused command: `npm run test:run --` with useCheckout.paymentWindow, PaymentWindowCheckout, Checkout, CheckoutNavigation, StripePaymentForm, CustomerOrders and auth/session test files. Full command: `npm run test:run`; other checks: `npm run lint`, `node node_modules/typescript/bin/tsc -b`, `npm run build`, `git diff --check`.

Earlier unsuccessful logs remain available alongside final logs, especially `backend-security-before.log`, `backend-security-second.log`, `backend-security-third.log`, `backend-full-first.log`, `frontend-full-first.log`, and `browser-before.txt`. Successful final logs include `backend-focused-final.log`, `backend-full-final.log`, `frontend-focused-final.log`, `frontend-full-verified.log`, `frontend-build-final.log`, `frontend-lint-verified.log` and `browser-pointer-original-stacking.json`. Baseline exploit-path evidence is in `security-baseline-stock-repro.log`; source checksums prove the tested baseline application modules match the original backend HEAD. The baseline database was separate from the remediation test database.

Final local disposition: ready for independent Claude read-only review, with the documented NOT REPRODUCED findings and dependency diagnostic above. All source changes remain **unstaged and uncommitted**. Original frontend/main staged asset changes, unstaged leaflet CSS and untracked CartRemoval test, and original backend/main untracked browser evidence remain preserved. No Stripe listener, real provider operation, production migration or shared Stage 2/3 mutation was performed. Only this task's disposable servers/clusters were stopped after validation; their data and evidence remain available for review.
