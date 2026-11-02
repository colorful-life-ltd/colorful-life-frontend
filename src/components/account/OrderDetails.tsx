import type { ReactNode } from 'react'
import { countryLabel } from '../../features/account/addressState'
import { formatGbp, priceToPence } from '../../features/cart/CartContext'
import { paymentActionLabel } from '../../features/checkout/paymentWindow'
import { navigateCheckout } from '../../features/checkout/state'
import type { OrderDetail } from '../../features/orders/api'
import { parseCustomerExperience } from '../../features/orders/experience'
import {
  deliveryView, itemReturns, orderOverview, paymentView, returnOverview, returnStageLabels, RETURN_STEPS, sameAddresses,
  type ItemReturn, type ReturnOverview,
} from '../../features/orders/orderDetailView'
import { canCheckPayment, canResumeCheckout, displayDate, displayDay } from '../../features/orders/presentation'
import { OrderFinancialSummary } from '../checkout/OrderFinancialSummary'
import { PaymentWindowNotice } from '../checkout/PaymentWindowNotice'
import { OrderItemThumbnail } from './OrderItemThumbnail'
import './OrderDetails.css'

const SUPPORT = 'support@build-and-bloom.co.uk'
const conditionLabel = (value: string) => value === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : value === 'NEW' ? 'New' : 'Condition unavailable'
const progressText: Record<(typeof RETURN_STEPS)[number], string> = {
  sent: 'We’re reviewing your request. Please don’t post anything until it’s approved.',
  approved: 'Your return instructions are in the Returns section below.',
  received: 'We’ve received your returned item. Any refund is shown under Payment.',
}

type Props = {
  order: OrderDetail
  checking: boolean
  feedback: string
  onCheckPayment: () => void
  /** Rendered after the items; owned by the parent so Return V1 behaviour is unchanged. */
  returns: ReactNode
}
export function OrderDetails({ order, checking, feedback, onCheckPayment, returns }: Props) {
  const experience = parseCustomerExperience(order)
  const overview = returnOverview(order)
  const lines = itemReturns(order)
  const payment = paymentView(order, experience)
  const delivery = deliveryView(order, experience)
  const paidBeforeDispatch = order.status === 'CONFIRMED' && !order.dispatchedAt && order.payment?.status === 'SUCCEEDED'
  return <div className="order-detail">
    <p className="order-detail__meta">
      <span>Placed {displayDay(order.createdAt)}</span>
      <span>Total <strong>{formatGbp(priceToPence(order.financials?.totalAmount ?? order.totalAmount))}</strong></span>
    </p>

    <StatusCard order={order} overview={overview} experience={experience} />

    <section className="order-detail__section" aria-labelledby="order-items">
      <h2 id="order-items">Items</h2>
      <ul className="order-detail__items">{order.orderItems.map(item => <li key={item.id}>
        <OrderItemThumbnail productId={item.productListing.legoProduct.id} />
        <div className="order-detail__item-text">
          <strong>{item.productListing.legoProduct.title}</strong>
          <span className="order-detail__muted">Set {item.productListing.legoProduct.setNumber} · {conditionLabel(item.conditionSnapshot)}</span>
          <span className="order-detail__muted">Quantity {item.quantity} · {formatGbp(priceToPence(item.unitPrice))} each</span>
          {lines?.get(item.id)?.map(line => <ReturnBadge key={line.id} line={line} />)}
        </div>
        <span className="order-detail__price">{formatGbp(priceToPence(item.lineTotal))}</span>
      </li>)}</ul>
    </section>

    {returns}

    {paidBeforeDispatch && <section className="order-detail__section" aria-label="Cancellation before dispatch">
      <h2>Cancel before dispatch</h2>
      <p>This order hasn’t been dispatched yet. Email us with the items and quantities you’d like to cancel, or ask to cancel the whole order. Cancelling doesn’t automatically issue a refund; we’ll confirm by email.</p>
      <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Cancellation/refund request for order #${order.id}`)}`}>Email us about cancelling</a>
    </section>}

    <section className="order-detail__section" aria-labelledby="order-payment">
      <h2 id="order-payment">Payment</h2>
      {payment.paid
        ? <p className="order-detail__payment-status"><span className={`order-detail__pill order-detail__pill--${payment.label === 'Paid' ? 'ok' : 'info'}`}>{payment.label}</span>{payment.paidAt && <span className="order-detail__muted">Paid {displayDate(payment.paidAt)}</span>}</p>
        : <PaymentWindowNotice value={order.paymentWindow} />}
      <OrderFinancialSummary order={order} />
      {payment.refunds.length > 0 && <>
        <ul className="order-detail__refunds" aria-label="Refunds">{payment.refunds.map(r => <li key={r.id}>
          <span className={`order-detail__pill order-detail__pill--${r.tone}`}>{r.label}</span>
          <span>{r.amount}</span><span className="order-detail__muted">{displayDay(r.createdAt)}</span>
        </li>)}</ul>
        <p className="order-detail__note">
          {payment.refunds.some(r => r.label === 'Refund issued') && 'Refunds go back to your original payment method. Your bank may take a few working days to show them. '}
          {payment.refunds.some(r => r.tone !== 'ok') && <>For an update on a pending or incomplete refund, <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Refund for order #${order.id}`)}`}>contact us</a>.</>}
        </p>
      </>}
      {(canResumeCheckout(order) || canCheckPayment(order)) && <div className="order-detail__actions">
        {canResumeCheckout(order) && <button disabled={checking} onClick={() => navigateCheckout(`/checkout/orders/${order.id}`)}>{paymentActionLabel(order.paymentWindow)}</button>}
        {canCheckPayment(order) && <button className="checkout__secondary" disabled={checking} onClick={onCheckPayment}>{checking ? 'Checking payment status…' : 'Check payment status'}</button>}
      </div>}
      {feedback && <p role="status">{feedback}</p>}
    </section>

    {(delivery.method || delivery.shipments.length > 0) && <section className="order-detail__section" aria-labelledby="order-delivery-info">
      <h2 id="order-delivery-info">Delivery</h2>
      {delivery.method && <p className="order-detail__line">{delivery.method}</p>}
      {delivery.shipments.map(s => <div className="order-detail__shipment" key={s.sequence}>
        <p className="order-detail__line"><strong>{s.carrierName}</strong>{s.trackingNumber ? <> · Tracking {s.trackingNumber}</> : <span className="order-detail__muted"> · No tracking number</span>}</p>
        <p className="order-detail__muted">Dispatched {displayDay(s.dispatchedAt)}{s.tracking?.deliveredAt && <> · Delivered {displayDay(s.tracking.deliveredAt)}</>}</p>
        {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">Track parcel{delivery.shipments.length > 1 ? ` ${s.sequence}` : ''}</a>}
      </div>)}
    </section>}

    <section className="order-detail__section" aria-label="Addresses">
      <div className="order-detail__addresses">
        {sameAddresses(order)
          ? <div><h2 id="order-delivery">Delivery and billing address</h2><Address order={order} kind="delivery" /></div>
          : <>
            <div><h2 id="order-delivery">Delivery address</h2><Address order={order} kind="delivery" /></div>
            <div><h2 id="order-billing">Billing address</h2><Address order={order} kind="billing" /></div>
          </>}
      </div>
    </section>

    <p className="order-detail__help">Need help with this order? <a href="/legal/delivery-returns">Delivery &amp; Returns policy</a> · <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Order #${order.id}`)}`}>Contact support</a></p>
  </div>
}

function StatusCard({ order, overview, experience }: { order: OrderDetail; overview: ReturnOverview; experience: ReturnType<typeof parseCustomerExperience> }) {
  const orderState = orderOverview(order, experience)
  if (overview.kind === 'progress') {
    const current = RETURN_STEPS.indexOf(overview.stage)
    return <section className="order-status order-status--return" aria-labelledby="order-status-title">
      <p className="order-status__eyebrow">Return in progress</p>
      <h2 id="order-status-title">{returnStageLabels[overview.stage]}</h2>
      <Steps labels={RETURN_STEPS.map(s => returnStageLabels[s])} current={current} label="Return progress" />
      <p>{progressText[overview.stage]}</p>
      {overview.mixed && <p className="order-detail__muted">Your returned items are at different stages; each item’s status is shown below.</p>}
      <p className="order-status__secondary">Order status: {orderState.title}</p>
    </section>
  }
  return <section className="order-status" aria-labelledby="order-status-title">
    <h2 id="order-status-title">{orderState.title}</h2>
    {orderState.kind === 'steps' && <Steps labels={orderState.steps} current={orderState.current} label="Order progress" />}
    {orderState.kind === 'message' && orderState.detail && <p>{orderState.detail}</p>}
    {overview.kind === 'unavailable' && <p role="status">Return information is unavailable right now. Refresh the order to try again.</p>}
  </section>
}

/** The final step, once reached, is shown as done rather than in progress. */
function Steps({ labels, current: reached, label }: { labels: string[]; current: number; label: string }) {
  const current = reached >= labels.length - 1 ? labels.length : reached
  return <ol className="order-steps" aria-label={label}>{labels.map((text, index) =>
    <li key={text} className={index < current ? 'is-done' : index === current ? 'is-current' : undefined} aria-current={index === current ? 'step' : undefined}>
      <span className="order-steps__dot" aria-hidden="true">{index < current ? '✓' : ''}</span>
      <span className="order-steps__label">{text}<span className="visually-hidden">{index < current ? ' (done)' : index === current ? ' (current)' : ''}</span></span>
    </li>)}</ol>
}

function ReturnBadge({ line }: { line: ItemReturn }) {
  const tone = line.stage === 'declined' || line.stage === 'withdrawn' ? 'muted' : line.stage === 'received' ? 'ok' : 'info'
  return <span className={`order-detail__pill order-detail__pill--${tone}`}>{returnStageLabels[line.stage]}{line.quantity > 1 ? ` · ${line.quantity} units` : ''}</span>
}

function Address({ order, kind }: { order: OrderDetail; kind: 'delivery' | 'billing' }) {
  const street = [order[`${kind}Line1`], order[`${kind}Line2`], order[`${kind}City`], order[`${kind}County`]].filter(Boolean).join(', ')
  return <address>
    <strong>{order[`${kind}RecipientName`]}</strong><br />
    {street}<br />
    {order[`${kind}Postcode`]} · {countryLabel(order[`${kind}CountryCode`])}
    {order[`${kind}Phone`] && <><br /><span className="order-detail__muted">{order[`${kind}Phone`]}</span></>}
  </address>
}
