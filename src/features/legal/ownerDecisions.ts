/**
 * Commercial and legal choices the owner has not made yet. Pages render each one as a clearly
 * marked placeholder instead of inventing terms. `npm run legal:check` fails while any remain,
 * so the pages cannot silently go live with open decisions.
 *
 * To resolve one: write the approved wording into the page and delete its entry here.
 */
export const OWNER_DECISIONS = {
  dispatchTime: 'How many working days after payment orders are normally dispatched.',
  returnPostage: 'Who pays return postage when a customer cancels a non-faulty order (the customer, or Build & Bloom).',
  openedItems: 'How returns of opened or used sets are handled (any deduction for reduced value, and how it is assessed).',
  contractFormation: 'When the contract is formed (for example, when payment is confirmed and the confirmation email is sent, or on dispatch).',
  orderRefusal: 'Whether, and when, Build & Bloom may cancel an accepted order (for example, an obvious pricing error) and how customers are refunded.',
  northernIreland: 'Whether orders are delivered to Northern Ireland (BT postcodes), given the EU product-safety rules that apply there. Deliveries currently accept any UK address.',
  purchaserAge: 'The minimum age to open an account and buy (for example, 18), given that many products are for children.',
  retentionPeriods: 'Approve the retention periods listed in the Privacy Policy, then enable the retention sweep (RETENTION_ENABLED).',
  icoRegistration: 'The ICO data protection fee registration reference for Colorful Life Ltd.',
  transferSafeguards: 'The transfer safeguard each overseas provider relies on (UK–US data bridge, IDTA or UK Addendum), confirmed from its data processing terms.',
  complaintResponseTime: 'The target time to acknowledge and answer complaints.',
  disputeResolution: 'Whether Build & Bloom will use an alternative dispute resolution (ADR) provider, and which one.',
} as const

export type OwnerDecision = keyof typeof OWNER_DECISIONS
export const pendingOwnerDecisions = () => Object.keys(OWNER_DECISIONS) as OwnerDecision[]
