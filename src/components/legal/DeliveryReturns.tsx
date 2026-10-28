import { useEffect, useState } from 'react'
import { deliveryEstimate, getShippingOptions, shippingCharge, type ShippingOptions } from '../../features/checkout/shipping'
import { COMPANY, returnsAddressLine } from '../../features/legal/company'
import { LegalLayout } from './LegalLayout'

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
  return <table className="legal-table delivery-options-table">
    <thead><tr><th scope="col">Method</th><th scope="col">Charge</th><th scope="col">Estimated delivery</th></tr></thead>
    <tbody>{state.options.methods.map(option => <tr key={option.code}><td>{option.method}</td><td>{shippingCharge(option)}</td><td>{deliveryEstimate(option)}</td></tr>)}</tbody>
  </table>
}

export function DeliveryReturns() {
  return <LegalLayout title="Delivery & Returns" updated="28 October 2026">
    <h3>Delivery</h3>
    <p>Our delivery area is England, Scotland, Wales and Northern Ireland.</p>
    <DeliveryOptionsTable />
    <p>Estimates are in working days after dispatch and are not guaranteed delivery dates. We normally dispatch within 2–3 working days after order confirmation. This is dispatch time, not delivery time. If a genuine exception delays dispatch, we will contact you promptly. We email you when your order is dispatched, with tracking details where the carrier provides them. Unless we agree otherwise, we deliver without undue delay and within 30 days of the contract being made. Your statutory rights if delivery is late are unaffected.</p>
    <p>If your parcel arrives damaged, or does not arrive within the estimate, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number.</p>

    <h3>Your right to cancel (14 days)</h3>
    <p>We do not offer an additional voluntary change-of-mind return window. This does not limit your statutory rights, any applicable exceptions, or any longer cancellation period required by law if the required information was not provided.</p>
    <p>You can cancel your order without giving a reason within 14 days of the day you, or someone you name (other than the carrier), receive the goods. If your order arrives in separate deliveries, the 14 days run from the day you receive the last item. You can also cancel before your order arrives.</p>
    <p><strong>To cancel</strong>, tell us clearly before the 14 days end:</p>
    <ul>
      <li>email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number, or</li>
      <li>use our <a href="/legal/cancellation-form">model cancellation form</a> (you do not have to), or</li>
      <li>write to {COMPANY.legalName}, {returnsAddressLine}.</li>
    </ul>
    <p><strong>Returning the goods:</strong> send them to {COMPANY.legalName}, {returnsAddressLine}, without undue delay and within 14 days of telling us you are cancelling. For a statutory change-of-mind cancellation, you pay the direct cost of returning the goods, provided we disclosed this before you bought them. If we failed to disclose this, we bear that cost. Faulty, misdescribed or otherwise non-conforming goods are covered by your statutory rights, including our responsibility for reasonable return costs where applicable.</p>
    <p><strong>Your refund:</strong> we refund the price you paid and the delivery charge, using your original payment method. If you chose a more expensive delivery method than our cheapest standard delivery, we refund only the cost of the cheapest standard delivery. We refund without undue delay and within 14 days of receiving the goods back, or of you showing us that you have sent them back, whichever is earlier. If you cancel before the goods are dispatched, we refund without undue delay and within 14 days of you telling us. We do not charge a refund fee.</p>
    <p><strong>Condition of returned goods:</strong> you may handle the goods as you would in a shop, to check what they are and how they work. If they have been handled beyond that and their value has gone down, we may reduce your refund by that amount. Opening the box alone does not remove your statutory right to cancel. We do not automatically refuse opened or assembled sets or apply an automatic deduction. Any lawful deduction reflects only actual diminished value caused by handling beyond what is necessary to establish the nature, characteristics and functioning of the goods; no such deduction applies if we failed to give the required cancellation information.</p>

    <h3>Faulty or incorrect goods</h3>
    <p>If an item is faulty, damaged, incomplete, not as described or not what you ordered, email us with your order number and photographs where possible. You have legal rights under the Consumer Rights Act 2015, explained in our <a href="/legal/terms">Terms &amp; Conditions</a>. These include a full refund if you reject faulty goods within 30 days of delivery. For faulty goods we cover the reasonable cost of returning them. These rights are separate from, and in addition to, your 14-day right to cancel.</p>
  </LegalLayout>
}
