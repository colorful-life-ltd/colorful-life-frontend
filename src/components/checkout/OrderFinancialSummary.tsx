import { formatGbp, priceToPence } from '../../features/cart/CartContext'
import { deliveryEstimate, type OrderFinancials } from '../../features/checkout/shipping'

/** Persisted backend breakdown only. Missing shipping data is unknown, never free, and is never recalculated. */
export function OrderFinancialSummary({ order }: { order: { totalAmount: string; financials?: OrderFinancials | null } }) {
  const financials = order.financials
  if (!financials) return <div className="checkout__financials">
    <p>A detailed price breakdown is unavailable for this order.</p>
    <p className="checkout__total">Order total <strong>{formatGbp(priceToPence(order.totalAmount))}</strong></p>
  </div>
  const shipping = financials.shipping
  return <dl className="checkout__financials" aria-label="Order price breakdown">
    <div><dt>Merchandise subtotal</dt><dd>{formatGbp(priceToPence(financials.merchandiseSubtotal))}</dd></div>
    <div><dt>Delivery</dt><dd>{shipping
      ? <>{shipping.method} · {formatGbp(shipping.chargePence)}<span className="checkout__financials-note">{deliveryEstimate(shipping)}</span></>
      : <>Delivery details unavailable<span className="checkout__financials-note">This order has no recorded delivery method or charge. That does not mean delivery was free.</span></>}</dd></div>
    <div className="checkout__total"><dt>Order total</dt><dd><strong>{formatGbp(priceToPence(financials.totalAmount))}</strong></dd></div>
  </dl>
}
