# Retention procedure — Phase 1 proposal

28 October 2026. Owner: Colorful Life Ltd's director. **PROPOSED, not adopted or deployed.**
The owner has approved generally six-year necessary transaction/accounting retention and necessary-only retention for other information. All new periods/frequencies below require owner approval. No bulk disposal is authorised by this document.

## Schedule

| Data / purpose | Review/disposal rule | Status |
|---|---|---|
| Account/profile; operating the account | Retain while used. PROPOSED quarterly identify accounts with no known activity for 24 months; review/contact before closure. No last-login field is verified: do not infer inactivity from User.updatedAt alone. Erasure requests are reviewed promptly, not deferred to the quarterly cycle. | Period PROPOSED |
| Unverified accounts; completing signup | PROPOSED review after 30 days without verification, and remove only after checking linked transactions/holds. | PROPOSED |
| Saved addresses; future deliveries | Retain while account needs them; remove on account deletion. Historical order snapshots are separate. | Existing deletion verified; quarterly review PROPOSED |
| Refresh sessions, verification/reset tokens; authentication | Application already rejects expired credentials (defaults: refresh 30 days, verification 24h, reset 1h). PROPOSED daily bounded maintenance deletes expired rows; revocation without expiry remains until expiry. Account deletion removes all sessions/tokens immediately. | Code candidate, not deployed; cadence PROPOSED |
| Abandoned baskets; shopping convenience | PROPOSED quarterly review after 90 days of no basket activity. Check item activity and pending order allocations; Cart.updatedAt alone is insufficient. Remove obsolete items only, preserving order/provenance and reservations. Account deletion removes items; minimal empty cart/provenance remains linked to financial records. | Period/process PROPOSED; no automatic abandonment deletion |
| Orders, payments, refunds, invoices, necessary shipping/stock and financial evidence | Generally six years from the end of the relevant accounting period, longer when an enquiry, dispute, claim or other legal requirement justifies it. Annual review: retain only necessary evidence, assess redundant copies/fields, then safe deletion/anonymisation after holds close. Not every address/phone or duplicated payload automatically needs six years. | General policy owner-approved; implementation/review procedure awaiting adoption |
| Support email, complaints and attachments | Link necessary transaction/dispute evidence to its record. PROPOSED review routine resolved correspondence after 12 months from resolution; delete unnecessary attachments/copies. Unresolved complaints remain on hold. Mailbox and downloads included. | PROPOSED |
| Security counters/challenges | Expiry-aware bounded cleanup already exists for abuse/challenge state; password-recovery counters have request-triggered pruning. PROPOSED daily invoke maintenance, quarterly check residual recovery counters. No audit/payment admissions deleted. | Cadence PROPOSED; scheduling not verified |
| Security/operational audits | PROPOSED quarterly review standalone security events after 90 days; retain justified incident evidence through resolution. Financially linked audit/idempotency evidence follows necessary transaction retention and must not be blindly purged. | PROPOSED; no audit purge implemented |
| Docker logs | Live inspected Sandbox: 10MiB × 3 per container, size-bounded rather than fixed-age. PROPOSED quarterly check oldest retained data and investigate excessive/unnecessary logging. No secrets/customer payload logging. | Size configuration verified 28 October; age guarantee NOT verified |
| Nginx and diagnostic logs | Live daily rotation, 14 archives, active timer verified. PROPOSED close/remove temporary diagnostics after incident review, preserve only necessary redacted incident evidence. This is not exactly a guaranteed 14-day lifespan for all copies. | Rotation verified; diagnostic closure pending |
| RDS automated backups / PostgreSQL backups | Production RDS 35-day retention verified. Sandbox Docker backup policy not verified. Put erased data beyond normal use in backups and let bounded copies expire; do not restore erased records to active service. | RDS setting verified; complete backup inventory pending |
| Manual snapshots, exports, local/remote database copies | PROPOSED quarterly inventory owner, purpose and expiry; remove temporary exports within 7 days of verified completion unless a documented recovery/legal need remains. PROPOSED review incident snapshots within 30 days after closure. Existing originals are not deleted by this proposal. | PROPOSED; owner inventory required |

## Quarterly owner review (PROPOSED)

1. Record review date, systems/copies covered and next due date. Check mailbox, attachments, exports, diagnostics and provider dashboards, not just database tables.
2. Inventory candidates using counts and IDs with minimum necessary personal data. Apply accounting-period rules and open refund/dispute/chargeback/complaint/enquiry/claim holds first.
3. Preview affected rows and dependencies. No blanket DELETE User/Order or cascade-based financial disposal. Runtime cannot delete protected financial/audit records. Long-term disposal needs separately reviewed owner-only tooling, a dry run and recoverable execution.
4. Run approved expired-auth/security maintenance through existing private ADMIN POST /admin/payment-security/maintenance (confirm mount in the deployed version). Never expose it publicly. Each call removes at most 1,000 rows per auth table, with count-only results; repeat bounded calls if backlog remains. No scheduler installed by this PR. Recommend a documented daily owner invocation initially, or an approved external timer later; no new worker.
5. Log disposal results and failures. Escalate unremovable records rather than claiming deletion. Recheck retained copies and next review dates.

## Annual financial review (PROPOSED)

At year end, director/accountant confirms accounting periods and legal exceptions. Review expired periods plus duplicate email-job sources, frozen invoices/PDFs, financial webhook/evidence, shipment snapshots and exports. Preserve minimal audit/idempotency relationships needed for unresolved financial operations. Do not delete invoice snapshots merely because an account is deleted. A documented manual review is acceptable at current scale; safe disposal tooling must be reviewed before first financial cohort is due. No automatic six-year deletion is claimed.

## Holds, requests and disposal log

For a hold record: opaque record reference, reason, owner, opened date, next review date and release decision. A hold is not indefinite permission to keep unrelated data. Review promptly on closure and quarterly while open.

Disposal log template (store privately, no copied customer payloads):

| Date / operator | System / category / opaque cohort IDs | Rule and cutoff | Hold check / approval | Action and counts | Validation / failure / next review |
|---|---|---|---|---|---|

Data-access/erasure requests get individual review within applicable deadlines. Retain minimal evidence explaining lawful exceptions; do not defer requests to annual review. The unrelated data-export endpoint is outside Phase 1.

## Backups and restoration

Maintain a restricted minimal erasure ledger separate from the database backup (opaque identifiers, action/date; avoid raw contact details unless needed). After restore: isolate networking, keep workers/payment/email initiation off, apply the erasure ledger, verify suppression/deletion and financial consistency, then approve reopening. Never replay uncertain financial operations automatically. Record manual snapshots/exports and their expiry; backup retention does not automatically remove independent copies. No restore or disposal drill is claimed here.

## Implementation and adoption gates

Backend housekeeping is manual ADMIN maintenance, idempotent and bounded, not an automatic retention system. Apply its reviewed grants before using it: only RefreshSession DELETE is newly added; financial/audit protections stay intact. Empty cart rows and order provenance deliberately remain. Existing tombstones are not retroactively swept by repeated account deletion. Owner must approve proposed periods, commit to the review/invocation procedure, inventory mail/backups and establish a safe long-term disposal path before retentionPeriods can be resolved. Until then PR #91's legal gate stays open.

Sources reviewed 28 October 2026:
- https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600 — tax accounting-period rule and exceptions.
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/ — proportionate review, necessity and backup handling.
