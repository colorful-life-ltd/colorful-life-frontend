import { COMPANY, registeredOfficeLine } from '../../features/legal/company'
import './Legal.css'

/**
 * Key pre-contract information shown at checkout before the customer orders and pays
 * (Consumer Contracts Regulations 2013 regs 13–14; E-Commerce Regulations 2002 reg 9).
 */
export function PreContractSummary({ stage }: { stage: 'order' | 'payment' }) {
  return <aside className="checkout__legal legal-notice" aria-label="Before you order">
    <p>You are buying from <strong>{COMPANY.legalName}</strong>, trading as {COMPANY.brand}, {registeredOfficeLine}. Email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.</p>
    <p>{stage === 'order'
      ? 'Creating the order reserves your items and shows the final total, including delivery. You can still change your cart or address before paying.'
      : 'Selecting Pay now places your order with an obligation to pay the total shown.'}
      {' '}Our <a href="/legal/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a> apply. You must be 18 or older to place an order. An order acknowledgment is not acceptance; the contract is formed when we send the dispatch confirmation email. You can generally give cancellation notice within 14 days after receiving your goods and then have a further 14 days to return them. For a change-of-mind cancellation, you pay the direct return cost; faulty-goods rights are unaffected (see <a href="/legal/delivery-returns" target="_blank" rel="noopener">Delivery &amp; Returns</a>), and your legal rights for faulty goods are not affected. See our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a> for how we use your data.</p>
  </aside>
}
