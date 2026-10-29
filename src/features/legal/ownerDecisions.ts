/**
 * Unresolved legal decisions or operational verification checks. Pages render each one as a clearly
 * marked placeholder instead of inventing terms. `npm run legal:check` fails while any remain,
 * so the pages cannot silently go live with open decisions.
 *
 * To resolve one: verify the underlying facts/implementation, write accurate approved wording and delete its entry here.
 */
export const OWNER_DECISIONS = {
  retentionPeriods: 'Confirm the proposed six-year financial schedule with the accountant/legal adviser and obtain owner adoption; decide the proposed 12-month support-mail review threshold and verify practical review/disposal, mailbox/copy/backup and restore handling. The 30-day unverified-account manual-review trigger is adopted and RDS backups are verified at 35 days; neither establishes automatic deletion.',
  transferSafeguards: 'Complete account-specific provider/entity and transfer-safeguard checks, applicable contracts and any required transfer assessments, including Google support-mail subscription/terms, AWS, Cloudinary, actual test/live payment services and optional/manual data flows. Public terms alone do not establish account coverage.',
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
