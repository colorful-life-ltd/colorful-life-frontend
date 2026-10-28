# Privacy completion review — 28 October 2026

## Scope and evidence limits

Read-only source inventory of Backend main `32117c0131872bd84e23563162a3149eed2a9608` and frontend PR #91 (prior head cdc801c). Public provider contractual/privacy documents checked on 28 October 2026. No AWS, provider-dashboard, database or private mailbox access was used. Account-specific contracts, flags, certifications, transfer assessments, deployed retention settings and mailbox hosting have NOT been verified. No secrets were read. This review does not approve live processing or deployment.

## Actual source flows

| Flow | Personal information and source evidence | Verified / outstanding |
|---|---|---|
| Application hosting/database | Accounts, hashed passwords, saved addresses, baskets, order/address snapshots, payment IDs/statuses, refunds, audit records. Backend `prisma/schema.prisma`, `src/config/database.ts`; frontend session tokens in `src/features/auth/session.ts`. | Owner confirms AWS London. Production RDS and isolated Docker Sandbox are separate; no live infrastructure audit performed. Backups/log exports/access outside London are not inferred from region. |
| Stripe | `src/domain/payments/stripePaymentService.ts:92`: server sends amount/currency/order and attempt identifiers. Frontend `src/components/checkout/StripePaymentForm.tsx:56` submits provider-side payment confirmation. SDK/device and payment information also goes directly from browser to Stripe. Signed webhook/reconciliation records return to Backend. | Processor/controller roles distinguished by Stripe DPA. No full card data is sent to our payment controller. Verify actual Stripe entity/agreement and transfer mechanism applicability. |
| PayPal | `src/domain/payments/paypalOrderService.ts:89`: amount/currency and internal order reference/custom ID; browser SDK at `src/features/checkout/paypalSdk.ts:20`, approval/capture and signed webhook evidence. No saved delivery-recipient name is included in that create-order payload. | Current frontend labels PayPal Sandbox. Provider can collect payer/device information directly. Do not assume Sandbox means no personal data. No credential or dashboard checks performed. |
| Email | `src/services/emailService.ts`: SES sends verification/reset and order/dispatch messages. `src/domain/orderConfirmation/contract.ts:12`: durable email/invoice snapshot includes recipient email, billing/shipping addresses and purchased items. | SES API uses configured AWS_REGION; actual SES/account/message destinations were not queried. Incoming support mailbox and recipient mailbox providers/storage are unknown. Reply-To is configured through ORDER_CONFIRMATION_BUSINESS_JSON; no values read. |
| Product media | Frontend `src/components/shared/CloudinaryImage.tsx` and `src/features/images/cloudinary.ts` (where present); Backend `src/infrastructure/imageStorage/cloudinaryImageStorage.ts`. Product media is uploaded; browsers fetch CDN images. | Viewer IP/browser metadata is personal information even though media is product content. Confirm Cloudinary plan/entity, content DPA versus CDN access-data roles and onward suppliers. |
| Address lookup | `src/services/addressLookupService.ts:62`: server sends postcode to api.ideal-postcodes.co.uk when IDEAL_POSTCODES_API_KEY is configured. Full saved names/addresses are not in this request. | Activation not checked. Provider states UK/EU data centres, but actual contractual terms/onward flows require verification. |
| Delivery | Order/shipment/tracking services and carrier-reference fields; customer address copied into order snapshots. | Manual carrier processing also needs a privacy record. Carrier account/contracts, live integrations and any overseas routes were not verified. |
| Security/operational logs | Payment abuse uses HMAC-derived identifiers; sessions, recovery tokens, webhook/financial evidence and operational audits also persist. Infra Nginx route sources disable normal access logging, but diagnostic/error logs may exist. | Do not claim all IPs are hashed or counters physically auto-delete. Need actual logging/diagnostic configuration, access, expiry/cleanup and retention checks. |
| Analytics/hosting pipeline | Frontend package/index/runtime search found no separate analytics/ad/monitoring integration; Stripe/PayPal and image requests still send technical information. GitHub Actions builds/releases static assets, not a configured customer-data upload flow. | Source search is not a network audit or guarantee about provider SDK tracking. No runtime browser cookie/consent certification. Mailbox, backups and any manual spreadsheets/exports still need owner inventory. |

## Retention findings

Owner policy: necessary transaction/payment/refund/accounting records generally six years, subject to applicable law; other personal information necessary-only, then delete/anonymise where feasible and lawful. Starting points depend on record and obligation; this is not a blanket six years from order date.

Backend main has no RETENTION_ENABLED or automatic retention sweep. `src/domain/orderConfirmation/contract.ts:32` accepts a retentionPolicy statement, but this is governance text, not deletion enforcement. Existing privacy claims about 7-year automatic order anonymisation, 90-day email cleanup, 180-day carts and 35-day backup expiry were not supported and have been removed.

`src/domain/auth/accountDeletionService.ts` deletes saved addresses/verification/reset tokens and replaces email/password/name/phone on the User record. It does NOT delete baskets, scrub frozen order addresses, purge invoice/PDF/email snapshots or erase provider records. The privacy page now states the limited verified behaviour. The frontend's `src/features/account/privacyApi.ts:5` calls POST /users/me/data-export; Backend main's `src/routes/users.ts` has no such route. The page no longer promises that self-service export works. The UI/API mismatch is reported, not changed in this policy-only task.

Retention remains a real blocker: define/verify implementation or documented manual procedures covering primary data, frozen email/PDF snapshots, logs, backups, provider records, unresolved transactions, legal holds, restore handling and deletion access requests. No destructive sweep, flag change or Backend implementation is included.

## Provider-specific published safeguards

- **AWS:** [GDPR centre](https://aws.amazon.com/compliance/gdpr-center/) and [UK GDPR Addendum](https://d1.awsstatic.com/legal/aws-dpa/aws-uk-gdpr-dpa.pdf) describe automatic incorporation into relevant Service Terms and EU SCCs supplemented for UK restricted transfers. Region selection does not prove every support/control-plane/SES flow stays in London. Confirm actual services/account terms and support/onward processing.
- **Stripe:** [DPA](https://stripe.com/legal/dpa) and [DTA](https://stripe.com/legal/dta), sections 2/3/5, provide a mechanism order (DPF first where applicable, UK Addendum alternative) and controller/processor roles. This review verifies published clauses, not current certification registry status, the owner's signed terms or completion of any required assessment.
- **PayPal:** [UK Privacy Statement](https://www.paypal.com/uk/legalhub/paypal/privacy-full), UK/EEA international transfers, describes adequacy, UK IDTA/Addendum or an applicable derogation. Its BCR statement explicitly refers to EU-resident intra-group transfers; do NOT assume that alone establishes the UK merchant's mechanism. PayPal UK Ltd is identified for UK residents; verify applicable merchant entity and onward flows. No claim that all transfers rely on consent or BCRs.
- **Cloudinary:** [privacy notice](https://cloudinary.com/privacy) describes controller-side processing and claims UK Extension participation; [DPA](https://cloudinary.com/gdpr/dpa) has a distinct uploaded-content/subscription scope. Published policy covers multiple processing territories; none is assumed to host this specific account. Verify plan, accepted agreement, recipient/entity, applicable UK clauses and CDN viewer-metadata coverage. Do not equate product-only uploads with no customer personal data or assert current certification without registry evidence.
- **Ideal Postcodes:** [official support/security information](https://ideal-postcodes.co.uk/support) states UK/EU data centres. This is not proof of the complete contractual onward-transfer chain. Need terms and activation confirmation.
- **ICO:** [transfer guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/) requires correct UK clauses and any required transfer assessment; provider marketing or a published DPA alone is not company-specific completion evidence.

## ICO status and merge decision

Owner confirms application and Direct Debit setup complete; formal reference pending. No registration/application number is included. The pending reference alone no longer blocks development: icoRegistration placeholder is resolved with accurate pending-status text. No claim of completed formal registration or ICO approval is made. Follow up when the real reference arrives.

Two real checks remain in OWNER_DECISIONS: retentionPeriods (operational alignment with approved policy) and transferSafeguards (account/flow-specific contractual/transfer review). legal:check remains fail-closed. **PR #91 is not safe to merge/deploy as launch-ready.** Continue development, but retain the draft until the actual retention/transfer checks are resolved. PR #88 return-address dependency and PR B email / PR C NI requirements remain as documented in owner-policy-pr-a.md. Backend refund PRs #218/#219 are untouched.

## Validation

- Full frontend suite: 1,166 passed, 0 failed across 102 files.
- Full ESLint, TypeScript, shared-contract check and production build passed.
- Focused regression coverage rejects invented ICO details, fixed automatic-deletion claims and a false claim of completed transfer verification; includes PayPal and postcode/image flows.
- legal:check exits 1 for exactly retentionPeriods and transferSafeguards. Workflow gates are unchanged and remain mandatory; CI is expected to block publication for those checks.

## Phase 1 follow-up — proposal, not gate resolution

See [retention procedure](retention-operations.md) and [provider evidence register](privacy-provider-register.md). New retention periods remain PROPOSED pending owner adoption. Backend bounded expired-auth housekeeping and account-deletion basket/session minimisation are prepared on a separate draft branch; nothing is deployed. Both retentionPeriods and transferSafeguards remain unchanged. No Privacy Policy claim of automatic deletion or completed transfer review has been introduced.
