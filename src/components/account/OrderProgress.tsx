import { parseCustomerExperience } from '../../features/orders/experience'
import { formatGbp, priceToPence } from '../../features/cart/CartContext'
const text = (v:string) => v.replaceAll('_',' ').toLowerCase()
export function OrderProgress({ order }: { order: unknown }) {
  const experience = parseCustomerExperience(order)
  if (!experience) return <p role="status">Delivery, refund or return information is unavailable. Refresh your order or contact us for an update.</p>
  const {refunds,cancellation,fulfilment,returns}=experience
  return <section aria-label="Order progress and after-sales">
    {cancellation?.state==='REQUESTED' && <p>Cancellation requested. We are reviewing the order and any payment refund. Your order is not yet cancelled.</p>}
    {cancellation?.state==='CANCELLED' && <p>Your order has been cancelled. Any refund is shown separately below.</p>}
    {fulfilment?.stage && <p>Delivery progress: {text(fulfilment.stage)}{fulfilment.preparingAt && fulfilment.stage==='PREPARING' ? ' · Your order is being prepared.' : ''}</p>}
    {fulfilment?.shipments.map(s=><div key={s.sequence}><p>{s.carrierName} · {s.trackingNumber ?? 'Tracking number not available'}{s.tracking && ` · ${text(s.tracking.progress)}`}</p>{s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment {s.sequence}</a>}</div>)}
    {refunds.length>0 && <section aria-label="Refund information"><h3>Refunds</h3><ul>{refunds.map(r=><li key={r.id}>{formatGbp(priceToPence(r.amount))} · {r.reviewRequired ? 'Outcome under review — contact us for an update' : r.status==='SUCCEEDED' ? 'Refund confirmed' : r.status==='PROCESSING' ? 'Refund pending — not yet confirmed' : 'Refund not completed'}</li>)}</ul><p>Bank processing times may vary after a refund is confirmed.</p></section>}
    <p>To arrange a return, contact us with your order number. Our team must confirm return authorization and shipping responsibility before you post any item.</p>
    {returns.length>0 && <section aria-label="Return information"><h3>Returns</h3><ul>{returns.map(r=><li key={r.id}>Return #{r.id} · {r.quantity} item(s) · {text(r.status)}</li>)}</ul><p>Return processing and payment refunds are separate. Approved stock inspection does not mean a refund has been paid.</p></section>}
  </section>
}
