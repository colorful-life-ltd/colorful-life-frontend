# Customer returns V1

## Confirmed eligibility policy

Owner confirmed: Return Management begins only after confirmed dispatch on a paid order. Before dispatch, paid orders use the existing cancellation/refund/support process; unpaid orders never initiate payment refunds. Admission is enforced by Backend as well as UI. The missing selected-item/quantity pre-dispatch refund workflow is documented as a separate gap in Backend `docs/pre-dispatch-item-refund-gap.md`; this PR does not add it.


Draft implementation. No merge/deployment approval is implied.

Eligible dispatched/completed/returned orders with confirmed dispatch and paid evidence expose **Request Return / View return history** in the existing account order detail. The server decides actual available quantities from trusted deduction evidence and existing return reservations; no additional automatic age cutoff is imposed. A customer can request another product/quantity later under the same permanent order return reference. Each submission and line keeps its own request date, reason, notes, state and lifecycle.

Statutory cancellation is the default type and does not require an explanation. Customers never choose a postage payer. After administrator authorisation, the account shows the persisted return address, instructions and postage responsibility/arrangements used by the authorisation email. Receipt and completion are explicitly separate from refunds. Existing refund/payment behaviour is unchanged. Rejection reasons remain visible with a support route; the form does not replace email cancellation or narrow consumer rights.

Submission uses a UUID idempotency key. An uncertain response retains that exact key/payload for retry and locks the selection; it does not create a new key on each click. Multi-click submits are blocked. Customer cancellation requires explicit confirmation and warns against withdrawing goods already posted. Foreign/missing orders and invalid server responses fail closed.

The shared return wire contract is copied from and verified against an immutable Backend commit. Existing order/payment projections and authentication/session renewal remain intact. History is loaded on demand rather than adding a request to every order card.

## Release dependencies

Release Backend's reviewed return schema, grants and endpoints first, using the separately approved procedure. The existing browser proxy explicitly allowlists customer APIs and does **not** currently admit these paths:

- GET `/api/orders/:orderId/return-case`
- POST `/api/orders/:orderId/return-requests`
- POST `/api/orders/:orderId/return-requests/:returnId/cancel`

A separately approved narrow proxy allowlist update is required before this UI release; preserve proxy authentication headers, restrictions and admin-path denial. No infrastructure or live proxy configuration was edited in this PR. Verify the Backend durable dispatch/return-email channel, approved sender and operational readiness before promising delivered emails; queued delivery state is available to Admin and account instructions remain available.

## Acceptance

- [ ] Submit A from an owned order, then request B later; one reference, separate dates/reasons/statuses.
- [ ] Leave a statutory cancellation explanation blank; submission succeeds without a postage choice.
- [ ] Retry after a lost response; one request is created.
- [ ] Check authorisation address, instructions and postage against captured email.
- [ ] Review rejection/receipt/completion independently for each line; no implied automatic refund.
- [ ] Withdraw an outstanding unposted return only after confirmation; its quantity becomes available again.
- [ ] Expired authentication, foreign order, unavailable network and malformed response show errors safely.

All automated tests use mocked/captured local data; no customer records or live payment APIs were accessed. Claude Opus and owner release approval are required before merging.

## Independent-review correction

Claude Opus's initial read-only review approved the UI with a recoverability follow-up: definite request refusals were unnecessarily treated as uncertain and locked the selection. Known transaction/auth/validation 4xx refusals now unlock the selection and clear the rejected draft; a revised request gets a fresh key. Network/5xx/unknown outcomes still retain the original key/payload and keep the selection locked for safe retry. The regression covers 409 refusal/revision and retains the existing lost-response retry test. Full suite passes 1,193 tests. Final-head independent re-review is required before leaving Draft.
