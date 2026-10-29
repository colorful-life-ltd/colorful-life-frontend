# Privacy completion review — 29 October 2026

## Scope and evidence limits

Current PR #91 follow-up to Claude's **APPROVE WITH FIXES** review of `0505a9673411d2859320b77ad823498b1af688ac`. Source inventory originally reviewed Backend main `32117c0131872bd84e23563162a3149eed2a9608`; this correction changes no backend behaviour. Earlier proposal/two-gate statements are superseded by the formal owner decisions and gate evaluation below. No merge, deployment, production configuration change or new provider acceptance is authorised or performed.

Prior read-only AWS observations verify a production-designated RDS instance's configured 35-day backups and SES sending/domain eligibility. **They do not conclusively establish that the serving customer API uses that RDS instance.** No fixed live customer-database backup duration is published. Prior private Workspace signup/billing evidence confirms signup, not the current subscription edition, effective agreement or completed transfer coverage. Detailed account evidence is retained privately; public provider documents remain general evidence only.

## Processing inventory

| Flow | Source/observed evidence | Evidence boundary |
|---|---|---|
| AWS hosting/database/email | Backend schema, database configuration and SES email service; necessary account/address/order/payment/invoice data and verification/reset/transactional emails. | Public AWS-hosted service, production-designated RDS and isolated Docker Sandbox are distinct. Serving API database/backup mapping and actual delivery configuration need operational verification. London hosting does not prove all processing is UK-only. |
| Google support email | Owner-confirmed custom-domain Gmail at support@build-and-bloom.co.uk; private Workspace signup evidence. Messages/attachments can contain contact, order, return and rights-request information. | Current edition, contracting entity/reseller, effective agreement/CDPA, forwarding, integrations, retention/hold settings and transfer coverage remain pending. No UK-only storage or subscription coverage inferred. |
| Stripe | Stripe Elements, server amount/currency/order/attempt references, signed webhook/reconciliation evidence; public build previously observed in Stripe Sandbox/test mode. | Browser payment/device/network data is personal data even in testing. Live payment activation and account-level contractual/transfer coverage are not established. |
| Cloudinary | Source image rendering/upload adapter and public catalogue URLs. Product images are delivered publicly; viewer IP/browser/referrer information accompanies requests. | Uploaded-content processor scope and viewer/controller scope differ. Plan/entity, applicable contract and transfer mechanism still need account-specific evidence. |
| PayPal | Sandbox checkout implementation, SDK, approval/capture/webhook capability. | Current active test flows need identification; no production activation inferred. Review actual account-specific coverage where testing is used. |
| Ideal Postcodes / carriers / advisers | Optional postcode lookup and shipment/manual processing capabilities. | Not all capabilities are established as active. Identify actual services/flows before adding account-specific obligations; conditional policy wording does not prove activation. |
| Cloudflare Turnstile | Reviewed storefront source, dependencies and build configuration contain no script/widget/client integration or challenge submission. | **Not integrated; excluded from the current storefront inventory.** Backend capability alone is not an active storefront flow. Reassess before activation. |

No separate analytics/advertising integration was identified in the reviewed source; this is not a complete network/cookie audit of provider SDKs. GitHub Actions builds/deploys source assets, not a configured customer database export. See the [provider evidence register](privacy-provider-register.md) for active versus Sandbox status, public source references and exact account evidence requirements.

## Adopted retention rules and public wording

The owner has formally approved:

- Necessary financial records generally six years from the end of the relevant financial year. Extend for applicable law, open disputes, investigations or enquiries, preserving category-specific periods and exceptions. This is not a claim that every financial/tax category has the same statutory period.
- Routine support correspondence: manual review after 12 months from resolution/last substantive contact, retaining longer for necessary ongoing enquiries, disputes, legal obligations or legitimate unresolved matters. This is not automatic deletion.
- Unverified accounts: retain the adopted 30-day manual-review trigger, with due cases gathered in quarterly reviews. This is not a day-30 deletion deadline.

Quarterly manual review also covers exports, snapshots and outstanding retention cases. The notice describes backup/copy retention by recovery purpose, continued necessity and holds, without a fixed customer-backup duration or immediate/automatic erasure promise. Necessary order/invoice/email snapshots and financial provenance remain protected. See [retention operations](retention-operations.md) for the distinction between approved rules, source controls, manual responsibilities and operational verification.

Account deletion is described with its verified limitations: saved addresses and identifiers are handled, but all historical order/payment/email records are not erased. Data access remains email-based; no export endpoint or functioning self-service export is promised. Unsupported download UI is handled separately in PR #93. Google support-email disclosure and HTTPS/password-hashing/restricted-access wording are preserved.

## Independent legal-gate decisions

**retentionPeriods: resolved in this correction.** Owner policy decisions are approved; the notice now matches them, keeps category/hold exceptions, distinguishes manual review from automatic deletion, and removes the unsupported customer-backup duration. No unresolved material retention claim remains in this notice. Closing this notice gate does not certify live backup coverage or completed operational reviews.

Backend #220 grant/deployment work, denial probes and restore exercises remain separate operational readiness tasks; the notice promises none of those unimplemented mechanisms. They are not reasons to keep the approved retention wording blocked. Live database/backup mapping, mailbox/copy inventory and recorded reviews remain explicit operational follow-up, not silently declared complete.

**transferSafeguards: OPEN.** Obtain account-specific evidence for active Google, AWS, Stripe test-mode and Cloudinary flows; assess actual PayPal test processing separately where used. Identify actual optional/manual flows before adding them. Do not infer applicability from published DPAs, London region, signup emails or provider adequacy statements. Turnstile is excluded and requires reassessment before activation. See the register completion rule for entities/agreements, destinations/subprocessors, applicable UK mechanisms and any required assessment/certification evidence.

The pending ICO reference alone remains outside the gate blockers. **Keep PR #91 Draft; no merge/deployment.** Release order remains #88 → #91 → #92, with separate owner release approval and the existing other workstream dependencies. Other PRs and dirty primary worktrees are unchanged.

## Verification evidence

For reviewed commit `0505a9673411d2859320b77ad823498b1af688ac`, [GitHub run 40849730626](https://github.com/colorful-life-ltd/colorful-life-frontend/actions/runs/40849730626) recorded **1,167 tests passed across 102 test files**, plus passing lint, typecheck, contracts and build. Overall verification failed at the intentional legal gate with the then-open retentionPeriods and transferSafeguards; deployment was skipped. The earlier local-only note did not describe this completed CI full-suite result.

Current correction verification:

- Focused legal/privacy suite: **27 passed, 0 failed across 3 files**.
- Full frontend suite: **1,168 passed, 0 failed across 102 files**.
- Full ESLint, `npx tsc -b --noEmit`, shared-contract verification and production build: **passed**. Build retains the existing non-fatal chunk-size advisory; jsdom tests emit the existing navigation-not-implemented diagnostic without test failures.
- `npm run legal:check`: **exit 1 intentionally for transferSafeguards only**. retentionPeriods is explicitly resolved as explained above; the legal checker and deployment workflows are unchanged.
- Final diff contains only PR #91 privacy wording, owner-decision text, matching legal tests and related documentation. Keep Draft; no merge/deployment or production settings change.
