# Retention operations — one-person business

29 October 2026. Responsible person: Colorful Life Ltd's director. The owner has selected the review cadence and adopted a **30-day manual-review trigger for unverified accounts**. This is not automatic deletion. The **12-month routine-support-mail review threshold** and the **six-year operational financial-record schedule** remain PROPOSED pending the approvals below; this supersedes earlier descriptions of the six-year schedule as fully approved. This document is not evidence that maintenance is deployed, reviews have run or disposal is authorised.

## Control status

- **Implemented source controls:** authentication expiry/validation, request-triggered recovery-counter cleanup and existing limited account-deletion handling. Expiry prevents use; it does not establish physical deletion from every store. Production deployment/configuration of each control has not been reverified here.
- **Separate undeployed candidate:** Backend #220 adds bounded expired-auth cleanup and session/basket minimisation. It remains a Draft; no feature is treated as deployed merely because tests passed.
- **Verified infrastructure control:** production RDS automated backup retention is 35 days, reconfirmed through read-only AWS API on 29 October. This is neither a primary-record deletion rule nor coverage for manual snapshots, exports, mailboxes or Sandbox Docker backups.
- **Owner-adopted manual procedure:** review unverified accounts after 30 days; quarterly review collects due cases. There is no automatic account purge or promise that review happens exactly on day 30.
- **Proposals:** 12-month routine-support review threshold and six-year category-level financial schedule require approval/confirmation. They are not configured timers or deletion jobs.
- **Legal requirements:** retain records actually required by applicable tax/accounting law and relevant holds, regardless of an unapproved internal proposal. GOV.UK describes company tax/accounting retention generally as six years from the end of the last company financial year concerned, with longer exceptions. The accountant/legal adviser must confirm category mapping, start dates and exceptions; this does not justify six years for every personal field or mailbox item.

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
| Orders, payments, refunds, invoices, necessary order-confirmation snapshots and financial/fulfilment evidence | **PROPOSED operational schedule:** six years from the end of the relevant company financial year, subject to accountant/legal confirmation of record categories, starting points and exceptions. Applicable tax/accounting retention and longer enquiry/dispute/claim holds remain binding; the proposal does not authorise early disposal. Necessary order-confirmation snapshots follow this transaction schedule. Annual review can identify redundant duplicated fields/copies for future minimisation; do not delete required snapshots under a short email-retention rule. |
| Support correspondence/attachments | Retain necessary transaction/dispute evidence with that record. Quarterly manual review of Google-hosted support mail at support@build-and-bloom.co.uk and its attachments/copies. **PROPOSED, NOT OWNER-APPROVED:** 12-month review threshold after resolution/last substantive contact for routine mail; confirm this starting point and exceptions before adoption. Review does not mean automatic deletion. No blanket six-year retention for all mail. Actual Workspace edition, retention/Vault/hold settings, forwarding and local/export copies remain to be verified. |
| Security/audit records | Expired short-lived counters/challenges use existing bounded cleanup. Keep necessary incident/financial audit and idempotency evidence while justified, subject to holds. Review unrelated diagnostic/security material quarterly; no broad audit purge. |
| Operational logs | Inspected Sandbox Docker logs are size-capped at 10MiB × 3, not age-guaranteed. Nginx has daily rotation/14 archives and active timer. Review unnecessary temporary diagnostics quarterly or when an incident closes; do not log secrets or customer payloads. |
| Automated backups | Production PostgreSQL RDS BackupRetentionPeriod=35 was verified by read-only AWS API and reconfirmed 29 October; Sandbox Docker backup coverage remains to be confirmed. Erased data in backups must be beyond ordinary use and expire with the backup; do not promise immediate removal from every backup. |
| Manual snapshots and exports | Quarterly inventory purpose, owner and continued need; remove unnecessary temporary copies after their task/recovery need ends, with holds checked. Independent copies do not expire with RDS backups. Existing originals are not deleted by this document. |

## Holds and a simple review/disposal record

For each review keep a private short record: **date/operator; system/category and opaque cohort IDs; cutoff/purpose; hold check; action/counts or reason retained; failure/next review**. Avoid copied customer payloads. A hold records its reason, owner and next review date; reconsider when the complaint/dispute/enquiry closes. It does not justify keeping unrelated information indefinitely.

Preview dependencies before disposal. No blanket DELETE User/Order or cascading financial disposal. Runtime cannot delete protected financial/audit records. The first long-term financial disposal requires a separately reviewed owner-only procedure and dry run; the current yearly review is not a claim that this tooling exists.

Data-rights/erasure requests are handled individually within applicable deadlines, not delayed until the next routine review. Retain minimal evidence of erasure decisions and lawful exceptions.

## Erasure and restore records

Keep a restricted minimal erasure ledger separately from database backups (opaque record reference, decision/action and date). After restore, isolate it, keep payment/email/workers off, reapply erasure decisions, validate financial consistency and only then approve normal use. Never automatically replay uncertain financial operations. Record restored/manual copies and their disposal decisions. No restore drill is claimed.

## Deployment/adoption status

Mandatory backend order: **existing database deployment procedure applies grants → verify runtime permissions and all financial denial probes → deploy the new image**. Only RefreshSession DELETE is newly allowed. Nothing is deployed by this documentation; no scheduler is installed. Existing tombstones are not retroactively swept.

### Exact remaining retentionPeriods decisions/evidence

1. Owner approves, revises or rejects the proposed routine-mail 12-month threshold, including its starting point and transaction/dispute/rights-request exceptions. The 30-day unverified-account manual trigger is already adopted and needs no repeat approval.
2. Accountant/legal confirmation and owner adoption of the proposed six-year financial schedule: required categories/fields, financial-year starting points, necessary order/invoice/email snapshots, longer statutory/claim holds and treatment of redundant copies. Mandatory legal retention is not suspended while this proposal is pending.
3. Verify actual support mailbox subscription and retention/Trash/Vault/hold settings, forwarding/download/export copies; confirm Sandbox backup coverage and inventory manual snapshots/exports and diagnostic logs. The production RDS 35-day setting is confirmed and needs no fresh approval, but does not settle these other stores.
4. Owner adopts a practical recorded review/disposal and restore/erasure procedure, with safe preview/hold checks and access, including how 30-day unverified cases are selected without destroying financial links. Verify any control relied on in production; do not count #220 cleanup as deployed. If relying on #220, its grants → runtime permissions/16 denial probes → image deployment sequence needs separate review/authorisation. A documented safe manual alternative may satisfy operational needs without inventing automation.
5. Reconcile final public wording with verified procedures and obtain owner approval before closing retentionPeriods. Updating this document alone is insufficient.

transferSafeguards remains separately open under the [provider register completion rule](privacy-provider-register.md#remaining-transfersafeguards-evidence-and-completion-rule). Neither legal gate is removed.

Sources reviewed 29 October 2026:
- https://www.gov.uk/running-a-limited-company/company-and-accounting-records
- https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
