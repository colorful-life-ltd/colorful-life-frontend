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
// transferSafeguards resolved for the reviewed flows: confirmed Workspace Business Starter,
// established AWS/Stripe service use and incorporated terms; Cloudinary's active UK Extension
// record covers technical/usage data and media delivery. See docs/privacy-provider-register.md.
// No separately signed contract or provider-infrastructure audit is asserted.
export const OWNER_DECISIONS = {
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
