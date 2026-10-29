import { useEffect, useState } from 'react'
import { deliveryEstimate, getShippingOptions, shippingCharge, type ShippingOptions } from '../../features/checkout/shipping'
import { COMPANY, registeredOfficeLine, returnsAddressLine } from '../../features/legal/company'
import { LegalLayout, OwnerDecisionPlaceholder } from './LegalLayout'

/** Delivery charges and estimates come from the backend catalogue, never from copy on this page. */
export function DeliveryOptionsTable() {
  const [state, setState] = useState<{ options: ShippingOptions | null; error: boolean }>({ options: null, error: false })
  useEffect(() => {
    let active = true
    getShippingOptions().then(options => { if (active) setState({ options, error: false }) }).catch(() => { if (active) setState({ options: null, error: true }) })
    return () => { active = false }
  }, [])
  if (state.error) return <p role="alert">Delivery options could not be loaded. They are always shown at checkout before you place an order.</p>
  if (!state.options) return <p role="status">Loading delivery options…</p>
  return <table className="legal-table">
    <thead><tr><th scope="col">Method</th><th scope="col">Charge</th><th scope="col">Estimated delivery</th></tr></thead>
    <tbody>{state.options.methods.map(option => <tr key={option.code}><td>{option.method}</td><td>{shippingCharge(option)}</td><td>{deliveryEstimate(option)}</td></tr>)}</tbody>
  </table>
}

export function DeliveryReturns() {
  return <LegalLayout title="Delivery & Returns" updated="24 October 2026">
    <h3>Delivery</h3>
    <p>We deliver to addresses in the United Kingdom. <OwnerDecisionPlaceholder id="northernIreland" /></p>
    <DeliveryOptionsTable />
    <p>Estimates are in working days after dispatch and are not guaranteed delivery dates. Dispatch: <OwnerDecisionPlaceholder id="dispatchTime" /> We email you when your order is dispatched, with tracking details where the carrier provides them.</p>
    <p>If your parcel arrives damaged, or does not arrive within the estimate, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number.</p>

    <h3>Your right to cancel (14 days)</h3>
    <p>You can cancel your order without giving a reason within 14 days of the day you, or someone you name (other than the carrier), receive the goods. If your order arrives in separate deliveries, the 14 days run from the day you receive the last item. You can also cancel before your order arrives.</p>
    <p><strong>To cancel</strong>, tell us clearly before the 14 days end:</p>
    <ul>
      <li>email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number, or</li>
      <li>use our <a href="/legal/cancellation-form">model cancellation form</a> (you do not have to), or</li>
      <li>write to {COMPANY.legalName}, {registeredOfficeLine}.</li>
    </ul>
    <p><strong>Returning the goods:</strong> send them to {COMPANY.legalName}, {returnsAddressLine}, without undue delay and within 14 days of telling us you are cancelling. Return postage: <OwnerDecisionPlaceholder id="returnPostage" /></p>
    <p><strong>Your refund:</strong> we refund the price you paid and the delivery charge, using your original payment method. If you chose a more expensive delivery method than our cheapest standard delivery, we refund only the cost of the cheapest standard delivery. We refund within 14 days of receiving the goods back, or of you showing us that you have sent them back, whichever is earlier. If you cancel before the goods are dispatched, we refund within 14 days of you telling us.</p>
    <p><strong>Condition of returned goods:</strong> you may handle the goods as you would in a shop, to check what they are and how they work. If they have been handled beyond that and their value has gone down, we may reduce your refund by that amount. Opened or used sets: <OwnerDecisionPlaceholder id="openedItems" /></p>

    <h3>Faulty or incorrect goods</h3>
    <p>If an item is faulty, damaged, incomplete, not as described or not what you ordered, email us with your order number and photographs where possible. You have legal rights under the Consumer Rights Act 2015, explained in our <a href="/legal/terms">Terms &amp; Conditions</a>. These include a full refund if you reject faulty goods within 30 days of delivery. For faulty goods we cover the reasonable cost of returning them. These rights are separate from, and in addition to, your 14-day right to cancel.</p>
  </LegalLayout>
}
