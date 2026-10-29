/**
 * Unresolved legal decisions or operational verification checks. Pages render each one as a clearly
 * marked placeholder instead of inventing terms. `npm run legal:check` fails while any remain,
 * so the pages cannot silently go live with open decisions.
 *
 * To resolve one: verify the underlying facts/implementation, write accurate approved wording and delete its entry here.
 */
// retentionPeriods resolved: owner adopted the financial, support-mail and unverified-account
// rules; the notice makes no fixed live-database backup or automatic-deletion claim.
// Separate operational follow-up remains in docs/retention-operations.md.
export const OWNER_DECISIONS = {
  transferSafeguards: 'Complete account-specific provider/entity and transfer-safeguard checks, applicable contracts and any required transfer assessments, including Google support-mail subscription/terms, AWS, Cloudinary, active payment services (including testing) and confirmed manual data flows. Reassess optional services before activation. Public terms alone do not establish account coverage.',
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
