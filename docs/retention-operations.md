# Retention operations — one-person business

29 October 2026, following independent review and formal owner approval. Responsible person: Colorful Life Ltd's director. **Owner-approved:** generally six years from the end of the relevant financial year for necessary financial records, with applicable category-specific periods/exceptions and longer legal/dispute/investigation/enquiry holds; 12-month manual review for routine support mail; and the existing 30-day manual-review trigger for unverified accounts. These are adopted rules, not proposals. Manual review is not automatic deletion. Approval of the rules is not evidence that reviews have run or a new cleanup service has been deployed.

## Control status

- **Implemented source controls:** authentication expiry/validation, request-triggered recovery-counter cleanup and existing limited account-deletion handling. Expiry prevents use; it does not establish physical deletion from every store. Production deployment/configuration of each control has not been reverified here.
- **Separate operational candidate:** Backend #220 adds bounded expired-auth cleanup and session/basket minimisation. It remains a Draft; no feature is treated as deployed merely because tests passed.
- **Verified infrastructure control:** production RDS automated backup retention is 35 days, reconfirmed through read-only AWS API on 29 October. **The currently serving customer API has not been conclusively verified to use that RDS instance.** Its setting is not evidence of live customer-database backup coverage, a primary-record deletion rule, or coverage for snapshots, exports, mailboxes or Docker backups. The public notice therefore specifies no customer-backup duration.
- **Owner-adopted manual procedure:** review unverified accounts after 30 days; quarterly review collects due cases. There is no automatic account purge or promise that review happens exactly on day 30.
- **Owner-approved rules:** review routine support mail after 12 months from resolution/last substantive contact, retaining it longer for ongoing enquiries, disputes, legal obligations or legitimate unresolved matters. Apply the generally applicable six-year financial rule from financial-year end, preserving category-specific requirements and exceptions. Neither rule creates a configured timer or deletion job.
- **Legal requirements:** retain records actually required by applicable tax/accounting law and relevant holds, under the adopted rule. GOV.UK describes company tax/accounting retention generally as six years from the end of the last company financial year concerned, with longer exceptions. Apply the requirements for each record category and obtain accountant/legal advice where needed; this does not justify six years for every personal field or mailbox item.

## Three recurring tasks

- **Monthly Admin maintenance:** use the existing private ADMIN `POST /admin/payment-security/maintenance` after the reviewed grant/backend deployment. The #220 candidate removes expired authentication rows and security state in bounded batches (at most 1,000 per authentication table per call). Record counts and repeat bounded calls if a backlog remains. No public route, new worker or scheduler is needed. Password-recovery counters also have request-triggered cleanup; check residual counters during review.
- **Quarterly short owner review:** check resolved support mail/attachments, temporary exports, manual snapshots, unverified accounts due under the 30-day trigger, outstanding retention/erasure cases and unnecessary diagnostic logs. Check legal/dispute holds, remove only what is no longer needed through a safe reviewed procedure, and record the result. Review unnecessary saved/basket data where identifiable without guessing activity. There is **no account-inactivity cutoff** until a reliable activity measure exists.
- **Annual financial review with the accountant:** confirm accounting periods, necessary transaction records and exceptions. Review records whose period has ended and retain only what remains justified. No automatic financial deletion is implemented.

## Retention schedule

| Category / purpose | Retention and disposal approach |
|---|---|
| Accounts/profile; operating the account | Keep while necessary to provide the account. Handle individual erasure requests promptly; no 24-month or other inactivity rule, and never infer inactivity from User.updatedAt. |
| Unverified accounts; completing signup | **OWNER-ADOPTED:** manual review after 30 days from account creation while still unverified. At each quarterly review collect due cases, recheck verification/transactions/holds and record retain/recontact/disposal decisions. Review age is not a deletion deadline. No automatic account deletion or bulk user purge is implemented. |
| Saved addresses; repeat delivery | Keep while needed for the account; existing account deletion removes them. Order address snapshots are separate transaction records. |
| Authentication sessions/tokens | Enforced expiry defaults: refresh sessions 30 days, verification 24 hours, reset one hour. Monthly operator-invoked maintenance would remove expired rows after #220 deployment; account deletion also removes sessions/tokens after the candidate is deployed. Revoked-but-unexpired sessions remain until expiry. Expiry is not a claim of immediate physical deletion. |
| Abandoned baskets | Remove unnecessary contents during quarterly review where safely identifiable; no guessed inactivity cutoff. Candidate account deletion removes items but preserves minimal empty Cart and order provenance needed for reconciliation. Never release inventory or erase financial links as a basket-cleanup shortcut. |
| Orders, payments, refunds, invoices, necessary order-confirmation snapshots and financial/fulfilment evidence | **OWNER-APPROVED:** generally six years from the end of the relevant financial year, extended for applicable law, open disputes, investigations or enquiries. Financial/tax categories do not all have identical statutory periods: apply the relevant category-specific requirements and exceptions. This is not authority for early disposal of required records. Necessary order-confirmation snapshots follow this transaction schedule. Annual review can identify redundant duplicated fields/copies for future minimisation; do not delete required snapshots under a short email-retention rule. |
| Support correspondence/attachments | Retain necessary transaction/dispute evidence with that record. Quarterly manual review of Google-hosted support mail at support@build-and-bloom.co.uk and its attachments/copies. **OWNER-APPROVED:** 12-month manual-review threshold after resolution/last substantive contact for routine mail. Retain longer where necessary for ongoing enquiries, disputes, legal obligations or legitimate unresolved matters. Review does not mean automatic deletion. No blanket six-year retention for all mail. Actual Workspace edition, retention/Vault/hold settings, forwarding and local/export copies remain to be verified. |
| Security/audit records | Expired short-lived counters/challenges use existing bounded cleanup. Keep necessary incident/financial audit and idempotency evidence while justified, subject to holds. Review unrelated diagnostic/security material quarterly; no broad audit purge. |
| Operational logs | Inspected Sandbox Docker logs are size-capped at 10MiB × 3, not age-guaranteed. Nginx has daily rotation/14 archives and active timer. Review unnecessary temporary diagnostics quarterly or when an incident closes; do not log secrets or customer payloads. |
| Automated backups | Production PostgreSQL RDS BackupRetentionPeriod=35 was verified by read-only AWS API and reconfirmed 29 October; **Live API-to-database mapping and backup coverage remain unverified**, including Docker backup coverage. Do not attribute the RDS setting to customer data. Erased data in backups must be beyond ordinary use and expire with the backup; do not promise immediate removal from every backup. |
| Manual snapshots and exports | Quarterly inventory purpose, owner and continued need; remove unnecessary temporary copies after their task/recovery need ends, with holds checked. Independent copies do not expire with RDS backups. Existing originals are not deleted by this document. |

## Holds and a simple review/disposal record

For each review keep a private short record: **date/operator; system/category and opaque cohort IDs; cutoff/purpose; hold check; action/counts or reason retained; failure/next review**. Avoid copied customer payloads. A hold records its reason, owner and next review date; reconsider when the complaint/dispute/enquiry closes. It does not justify keeping unrelated information indefinitely.

Preview dependencies before disposal. No blanket DELETE User/Order or cascading financial disposal. Runtime cannot delete protected financial/audit records. The first long-term financial disposal requires a separately reviewed owner-only procedure and dry run; the current yearly review is not a claim that this tooling exists.

Data-rights/erasure requests are handled individually within applicable deadlines, not delayed until the next routine review. Retain minimal evidence of erasure decisions and lawful exceptions.

## Erasure and restore records

Keep a restricted minimal erasure ledger separately from database backups (opaque record reference, decision/action and date). After restore, isolate it, keep payment/email/workers off, reapply erasure decisions, validate financial consistency and only then approve normal use. Never automatically replay uncertain financial operations. Record restored/manual copies and their disposal decisions. No restore drill is claimed.

## Legal-gate evaluation

**retentionPeriods is resolved for this notice.** The owner has formally adopted all three retention rules. The revised public wording includes financial-year starting point/category exceptions and holds, distinguishes both manual-review triggers from deletion, and uses purpose/necessity/hold criteria for backups without a fixed duration or unimplemented erasure promise. No further retention-policy approval is required for this scoped correction. This is a notice/policy decision, not a certification that every operational control has been deployed or every copy inventoried.

**transferSafeguards is separately resolved** by the [documented provider assessment](privacy-provider-register.md#gate-decision-and-remaining-work), using confirmed service relationships, standard incorporated terms and the official Cloudinary UK Extension record. Its closure is not inferred from owner retention approval.

## Separate operational readiness tasks

- Confirm which database the serving API actually uses and verify its real backup/recovery coverage; keep this separate from the verified RDS configuration. Do not publish a backup duration without that mapping/evidence.
- Verify mailbox retention/Trash/Vault/holds, forwarding/downloads and independent copies. Maintain the quarterly review record and inventory exports, snapshots, diagnostic logs and outstanding cases. Exact subscription/agreement applicability also remains in the transfer evidence checklist.
- Use safe preview/hold checks for manual disposal; preserve financial links and necessary snapshots. Establish and record erasure/restore handling, with a separately reviewed restore exercise before relying on recovery capability. No rehearsal is asserted complete.
- Backend #220 maintenance requires separate review and deployment: existing database deployment procedure applies grants → verify runtime permissions/all 16 denial probes → deploy the image. Only RefreshSession DELETE is newly allowed. No deployment, scheduler or retroactive tombstone sweep is performed by this PR. These tasks do **not** condition the approved notice's retention gate, because it does not promise #220 behaviour or automatic cleanup.

Sources reviewed 29 October 2026:
- https://www.gov.uk/running-a-limited-company/company-and-accounting-records
- https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
