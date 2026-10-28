/**
 * Commercial and legal choices the owner has not made yet. Pages render each one as a clearly
 * marked placeholder instead of inventing terms. `npm run legal:check` fails while any remain,
 * so the pages cannot silently go live with open decisions.
 *
 * To resolve one: write the approved wording into the page and delete its entry here.
 */
export const OWNER_DECISIONS = {
  retentionPeriods: 'Approve the retention periods listed in the Privacy Policy, then enable the retention sweep (RETENTION_ENABLED).',
  icoRegistration: 'The ICO data protection fee registration reference for Colorful Life Ltd.',
  transferSafeguards: 'The transfer safeguard each overseas provider relies on (UK–US data bridge, IDTA or UK Addendum), confirmed from its data processing terms.',
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
