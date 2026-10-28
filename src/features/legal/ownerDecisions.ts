/**
 * Unresolved legal decisions or operational verification checks. Pages render each one as a clearly
 * marked placeholder instead of inventing terms. `npm run legal:check` fails while any remain,
 * so the pages cannot silently go live with open decisions.
 *
 * To resolve one: verify the underlying facts/implementation, write accurate approved wording and delete its entry here.
 */
export const OWNER_DECISIONS = {
  retentionPeriods: 'Verify and implement the approved six-year records policy and necessary-only retention schedule, including email snapshots, logs and backups; automatic deletion has not been verified.',
  transferSafeguards: 'Complete account-specific provider/entity and transfer-safeguard checks, applicable contracts and any required transfer assessments, including Cloudinary, payment services and email handling.',
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
