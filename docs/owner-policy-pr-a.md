# Owner policy completion — PR A (28 October 2026)

## Scope and dependencies

Frontend policy wording only. Based on main e9ca61d. PR #88 separately owns the physical return-address formatting and the separation of cancellation correspondence from goods returns. Merge #88 first and check the combined legal pages; this branch does not duplicate its constant or form changes. Registered-office identity and customer records are unchanged.

Backend PRs #218 and #219 are open refund-remediation branches and are untouched. No Backend changes, provider calls, migrations, live data writes or infrastructure changes were made.

## Approved policies implemented

Delivery & Returns: customer-paid direct change-of-mind return costs (only when disclosed before purchase); statutory faulty-goods protection; no blanket opened/assembled-set refusal or automatic deductions; normal 2–3-working-day dispatch; UK coverage including Northern Ireland; statutory notice/return/refund windows without an additional voluntary window.

Terms: adult purchasers, dispatch-email contract acceptance, order acknowledgment is not acceptance, objectively reasonable pre-acceptance refusal and full captured-payment refund, initial complaint response target, and accurate ADR position. Checkout pre-contract copy expressly discloses return costs, adult purchasers and dispatch-email acceptance. Privacy's purchaser-age placeholder is replaced without making an unapproved minimum-account-age claim.

The product-age recommendations remain separate. No age verification/ID collection or account/checkout business logic is added.

## Remaining launch blockers — do not merge/deploy this draft yet

The owner supplied ten sales-policy decisions, but three separate privacy decisions remain in OWNER_DECISIONS:

- retentionPeriods: approve the actual published retention schedule and verify implementation/RETENTION_ENABLED separately; no runtime flag is changed here.
- icoRegistration: confirm the actual ICO fee registration reference or applicable status; do not invent a reference or exemption.
- transferSafeguards: verify the actual provider terms/safeguards for international transfers, including the current payment providers.

`npm run legal:check` deliberately still exits 1 for exactly these three. The existing gate is now mandatory in the verification job and before a deployment build. As a result GitHub verification is expected to fail at that gate until the three facts/decisions are resolved. Tests/lint/build are independent and run before the CI gate. No exception or bypass is introduced. Rollback/status workflow actions retain their existing behaviour.

## Deferred operational and policy consistency checks

- PR B requires separate approval: Backend main's `src/domain/orderConfirmation/template.ts` currently says payment received/order being prepared, but does not explicitly say acknowledgment is not acceptance or supply durable cancellation instructions/model form. `src/domain/orderConfirmation/dispatch.ts` says dispatched, but not expressly contract accepted. Customer-facing technical CONFIRMED/order-success states must not be treated as evidence that the dispatch email was sent. No payment/order transition has been changed here.
- PR C requires separate approval: Northern Ireland coverage is the owner's policy, not operational verification. Checkout fees, BT address validation, carrier contracts/services and product-safety requirements remain to be verified. No shipping rule or charge was changed.
- Privacy's remaining provider/security/retention statements need their factual owner verification; this PR does not certify them.
- Pre-acceptance refusal is a legal promise, not a claim that captured-payment refunds happen automatically. Existing safe staged cancellation/refund tooling remains in place.

## Legal source checks

- Consumer Contracts Regulations 2013, regulations 29–35: https://www.legislation.gov.uk/uksi/2013/3134 (cancellation, refund, handling, return costs).
- Digital Markets, Competition and Consumers Act 2024, section 308: https://www.legislation.gov.uk/ukpga/2024/13/section/308 (complaint outcome information about arrangements the trader is obliged to participate in).
- ADR Regulations 2015 regulation 19: https://www.legislation.gov.uk/uksi/2015/542/regulation/19 (revoked 6 April 2026; not used as the current blanket duty).

The official current section 308 and revoked regulation 19 XML were inspected on 28 October 2026. No ADR provider or voluntary membership was selected.

## Local validation

- Full frontend Vitest: 1,163 passed, 0 failed, 101 files.
- Focused legal suites: 22 passed, 0 failed.
- Full ESLint, TypeScript, shared-contract check and production build passed. Existing Vite chunk-size warning remains.
- Workflow YAML parsed; mandatory verification legal step and pre-build deployment legal step checked.
- `npm run legal:check`: exit 1, exactly retentionPeriods / icoRegistration / transferSafeguards. This is an unresolved release gate, not a passing check.
- No emails sent, no carrier/payment operations and no live deployment or infrastructure changes.
