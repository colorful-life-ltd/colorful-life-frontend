# Retention operations — one-person business

28 October 2026. Responsible person: Colorful Life Ltd's director. The owner has selected the simple review cadence below. This document is not evidence that maintenance is deployed or reviews have run. The general six-year necessary transaction/accounting policy is approved; any extra disposal cutoff marked **PROPOSED** still needs owner approval. No bulk disposal is authorised here.

## Three recurring tasks

- **Monthly Admin maintenance:** use the existing private ADMIN `POST /admin/payment-security/maintenance` after the reviewed grant/backend deployment. It removes expired authentication rows and security state in bounded batches (at most 1,000 per authentication table per call). Record counts and repeat bounded calls if a backlog remains. No public route, new worker or scheduler is needed. Password-recovery counters also have request-triggered cleanup; check residual counters during review.
- **Quarterly short owner review:** check resolved support mail/attachments, temporary exports, manual snapshots, unverified accounts and unnecessary diagnostic logs. Check legal/dispute holds, remove only what is no longer needed through a safe reviewed procedure, and record the result. Review unnecessary saved/basket data where identifiable without guessing activity. There is **no account-inactivity cutoff** until a reliable activity measure exists.
- **Annual financial review with the accountant:** confirm accounting periods, necessary transaction records and exceptions. Review records whose period has ended and retain only what remains justified. No automatic financial deletion is implemented.

## Retention schedule

| Category / purpose | Retention and disposal approach |
|---|---|
| Accounts/profile; operating the account | Keep while necessary to provide the account. Handle individual erasure requests promptly; no 24-month or other inactivity rule, and never infer inactivity from User.updatedAt. |
| Unverified accounts; completing signup | Quarterly review; **PROPOSED** review candidates older than 30 days, checking transactions/holds before any disposal. No automatic account deletion. |
| Saved addresses; repeat delivery | Keep while needed for the account; existing account deletion removes them. Order address snapshots are separate transaction records. |
| Authentication sessions/tokens | Enforced expiry defaults: refresh sessions 30 days, verification 24 hours, reset one hour. Monthly maintenance removes expired rows; account deletion also removes sessions/tokens after the candidate is deployed. Revoked-but-unexpired sessions remain until expiry. Expiry is not a claim of immediate physical deletion. |
| Abandoned baskets | Remove unnecessary contents during quarterly review where safely identifiable; no guessed inactivity cutoff. Candidate account deletion removes items but preserves minimal empty Cart and order provenance needed for reconciliation. Never release inventory or erase financial links as a basket-cleanup shortcut. |
| Orders, payments, refunds, invoices, necessary order-confirmation snapshots and financial/fulfilment evidence | Necessary transaction records generally retained six years from the end of the relevant accounting period, longer where an enquiry, dispute, claim or law requires it. Necessary order-confirmation snapshots follow this transaction schedule. Annual review can identify redundant duplicated fields/copies for future minimisation; do not delete required snapshots under a short email-retention rule. |
| Support correspondence/attachments | Retain necessary transaction/dispute evidence with that record. Quarterly review resolved routine correspondence and remove what is no longer necessary. No blanket six-year retention for all mail. |
| Security/audit records | Expired short-lived counters/challenges use existing bounded cleanup. Keep necessary incident/financial audit and idempotency evidence while justified, subject to holds. Review unrelated diagnostic/security material quarterly; no broad audit purge. |
| Operational logs | Inspected Sandbox Docker logs are size-capped at 10MiB × 3, not age-guaranteed. Nginx has daily rotation/14 archives and active timer. Review unnecessary temporary diagnostics quarterly or when an incident closes; do not log secrets or customer payloads. |
| Automated backups | Production RDS 35-day retention was verified; Sandbox Docker backup coverage remains to be confirmed. Erased data in backups must be beyond ordinary use and expire with the backup; do not promise immediate removal from every backup. |
| Manual snapshots and exports | Quarterly inventory purpose, owner and continued need; remove unnecessary temporary copies after their task/recovery need ends, with holds checked. Independent copies do not expire with RDS backups. Existing originals are not deleted by this document. |

## Holds and a simple review/disposal record

For each review keep a private short record: **date/operator; system/category and opaque cohort IDs; cutoff/purpose; hold check; action/counts or reason retained; failure/next review**. Avoid copied customer payloads. A hold records its reason, owner and next review date; reconsider when the complaint/dispute/enquiry closes. It does not justify keeping unrelated information indefinitely.

Preview dependencies before disposal. No blanket DELETE User/Order or cascading financial disposal. Runtime cannot delete protected financial/audit records. The first long-term financial disposal requires a separately reviewed owner-only procedure and dry run; the current yearly review is not a claim that this tooling exists.

Data-rights/erasure requests are handled individually within applicable deadlines, not delayed until the next routine review. Retain minimal evidence of erasure decisions and lawful exceptions.

## Erasure and restore records

Keep a restricted minimal erasure ledger separately from database backups (opaque record reference, decision/action and date). After restore, isolate it, keep payment/email/workers off, reapply erasure decisions, validate financial consistency and only then approve normal use. Never automatically replay uncertain financial operations. Record restored/manual copies and their disposal decisions. No restore drill is claimed.

## Deployment/adoption status

Mandatory backend order: **existing database deployment procedure applies grants → verify runtime permissions and all financial denial probes → deploy the new image**. Only RefreshSession DELETE is newly allowed. Nothing is deployed by this documentation; no scheduler is installed. Existing tombstones are not retroactively swept.

retentionPeriods remains open until the owner adopts the remaining proposed cutoff, confirms mailbox/backup coverage and the practical review/disposal procedure. transferSafeguards is separate. Neither legal gate is removed.

Sources reviewed 28 October 2026:
- https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
