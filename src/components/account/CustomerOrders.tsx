import { OrderProgress } from './OrderProgress'
import { countryLabel } from '../../features/account/addressState'
import { useConfirmedCartRefresh } from '../../features/cart/useConfirmedCartRefresh'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError, isVerificationRequired } from '../../features/auth/api'
import { listOrders, readOrder, type OrderSummary, type OrderDetail } from '../../features/orders/api'
import { canCheckPayment, canResumeCheckout, deliverySummary, displayDate, displayDay, orderDetailId, orderStatusLabel, paymentStatusLabel } from '../../features/orders/presentation'
import { OrderItemThumbnail } from './OrderItemThumbnail'
import { isOlderPaymentSnapshot, parsePaymentWindow, paymentActionLabel, paymentMessage } from '../../features/checkout/paymentWindow'
import { PaymentWindowNotice } from '../checkout/PaymentWindowNotice'
import { OrderFinancialSummary } from '../checkout/OrderFinancialSummary'
import { CheckoutApiError, recoverPayment } from '../../features/checkout/api'
import { isConfirmed, navigateCheckout } from '../../features/checkout/state'
import { formatGbp, priceToPence } from '../../features/cart/CartContext'
import { VerificationNotice } from './VerificationNotice'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../checkout/Checkout.css'
import './CustomerOrders.css'

type Props = { path: string; onAccount: () => void; onAuthenticate: () => void }
export function CustomerOrders({ path, onAccount, onAuthenticate }: Props) {
  const { state } = useAuth()
  const list = /^\/account\/orders\/?$/.test(path)
  const id = orderDetailId(path)
  return <main className="checkout customer-orders" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p>
    <h1>{list ? 'My Orders' : id ? `Order #${id}` : 'Order unavailable'}</h1>
    {state.status === 'authenticated' ? list || id ? <VerifiedOrders key={`${state.token}:${path}`} token={state.token} id={id} onAuthenticate={onAuthenticate} /> : <p role="alert">This order cannot be opened. Please return to My Orders.</p>
      : state.status === 'verificationRequired' ? <VerificationNotice token={state.token} message="Please verify your email to view your orders." />
      : state.status === 'resolving' ? <p role="status">Restoring your account…</p> : <><p>Please sign in to view your orders.</p><button onClick={onAccount}>Sign in</button></>}
    {!list && <button className="checkout__secondary" onClick={() => navigateCheckout('/account/orders')}>Back to My Orders</button>}
    <BotanicalDivider /><button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>
  </div></main>
}

type ReadState = { phase: 'loading' } | { phase: 'ready'; orders: OrderSummary[]; detail: OrderDetail | null } | { phase: 'error' } | { phase: 'auth' } | { phase: 'verification' } | { phase: 'unavailable' }
function VerifiedOrders({ token, id, onAuthenticate }: { token: string; id: number | null; onAuthenticate: () => void }) {
  const [state, setState] = useState<ReadState>({ phase: 'loading' })
  const snapshots = useRef(new Map<number, OrderSummary | OrderDetail>())
  const recovering = useRef(false)
  const generation = useRef(0)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState('')
  useConfirmedCartRefresh(state.phase === 'ready' ? state.detail : null)
  const [revision, setRevision] = useState(0)
  const reload = () => { setFeedback(''); setState({ phase: 'loading' }); setRevision(value => value + 1) }
  useEffect(() => {
    let active = true
    generation.current += 1
    const request = id === null ? listOrders(token).then(orders => ({ orders, detail: null })) : readOrder(token, id).then(detail => ({ orders: [], detail }))
    void request.then(result => {
      if (!active) return
      const retain = <T extends OrderSummary>(next: T): T => {
        const previous = snapshots.current.get(next.id)
        if (previous && isOlderPaymentSnapshot(previous, next)) return previous as T
        snapshots.current.set(next.id, next)
        return next
      }
      setState({ phase: 'ready', orders: result.orders.map(retain), detail: result.detail ? retain(result.detail) : null })
    }, reason => {
      if (!active) return
      setState({ phase: isVerificationRequired(reason) ? 'verification' : reason instanceof AuthApiError && reason.status === 401 ? 'auth' : reason instanceof AuthApiError && [403, 404].includes(reason.status) ? 'unavailable' : 'error' })
    })
    return () => { active = false; generation.current += 1 }
  }, [token, id, revision])
  const checkPayment = async () => {
    if (recovering.current || state.phase !== 'ready' || !state.detail || !canCheckPayment(state.detail)) return
    recovering.current = true
    setChecking(true)
    setFeedback('')
    const current = generation.current
    const detail = state.detail
    try {
      const recovered = await recoverPayment(token, detail.id)
      if (generation.current !== current) return
      if (recovered.id !== detail.id || isOlderPaymentSnapshot(detail, recovered)) { setFeedback('Payment information changed. Refresh the order before continuing.'); return }
      const updated = { ...detail, ...recovered }
      snapshots.current.set(updated.id, updated)
      setState({ phase: 'ready', orders: [], detail: updated })
      setFeedback(isConfirmed(recovered) ? 'Your payment and order are confirmed.' : paymentMessage(recovered.paymentWindow))
    } catch (reason) {
      if (generation.current !== current) return
      if (reason instanceof CheckoutApiError && reason.code === 'EMAIL_VERIFICATION_REQUIRED') setState({ phase: 'verification' })
      else if (reason instanceof CheckoutApiError && reason.status === 401) setState({ phase: 'auth' })
      else if (reason instanceof CheckoutApiError && [403, 404].includes(reason.status)) setState({ phase: 'unavailable' })
      else setFeedback('We could not check your payment status. Please try again later.')
    } finally {
      recovering.current = false
      if (generation.current === current) setChecking(false)
    }
  }
  if (state.phase === 'loading') return <p role="status">{id === null ? 'Loading your orders…' : 'Loading your order…'}</p>
  if (state.phase === 'verification') return <VerificationNotice token={token} message="Please verify your email to view your orders." onVerified={reload} />
  if (state.phase === 'auth') return <><p role="alert">Please sign in again to view your orders.</p><button onClick={onAuthenticate}>Sign in</button></>
  if (state.phase === 'unavailable') return <p role="alert">We cannot display this order information for your account.</p>
  if (state.phase === 'error') return <><p role="alert">Unable to load your orders. Please try again.</p><button onClick={reload}>Retry</button></>
  return <>
    {state.detail ? <><Detail order={state.detail} checking={checking} />{canCheckPayment(state.detail) && <button disabled={checking} onClick={() => void checkPayment()}>{checking ? 'Checking payment status…' : 'Check payment status'}</button>}{feedback && <p role="status">{feedback}</p>}</> : state.orders.length ? <ol className="order-history" aria-label="Your orders, newest first">{state.orders.map(order => <OrderCard key={order.id} order={order} />)}</ol> : <p className="order-history__empty">You haven’t placed any orders yet.</p>}
    <button className="checkout__secondary" disabled={checking} onClick={reload}>Refresh {id === null ? 'orders' : 'order'}</button>
  </>
}

const VISIBLE_ITEMS = 3
function OrderCard({ order }: { order: OrderSummary }) {
  const units = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const hidden = order.orderItems.length - VISIBLE_ITEMS
  const title = `order-${order.id}-title`
  const milestone = order.status === 'DISPATCHED' && order.dispatchedAt ? ` · Dispatched ${displayDay(order.dispatchedAt)}` : order.status === 'COMPLETED' && order.completedAt ? ` · Completed ${displayDay(order.completedAt)}` : ''
  return <li className="order-card"><article aria-labelledby={title}>
    <header className="order-card__meta">
      <dl>
        <div><dt>Order placed</dt><dd>{displayDay(order.createdAt)}</dd></div>
        <div><dt>Total</dt><dd>{formatGbp(priceToPence(order.financials?.totalAmount ?? order.totalAmount))}</dd></div>
        <div><dt>{units} {units === 1 ? 'item' : 'items'}</dt><dd><h2 id={title}>Order #{order.id}</h2></dd></div>
      </dl>
      <button className="order-card__details" aria-describedby={title} onClick={() => navigateCheckout(`/account/orders/${order.id}`)}>View order details</button>
    </header>
    <div className="order-card__body">
      <p className="order-card__status"><strong>{orderStatusLabel(order.status)}</strong>{milestone}</p>
      <ul className="order-card__items">{order.orderItems.slice(0, VISIBLE_ITEMS).map(item => <li key={item.id}>
        <OrderItemThumbnail productId={item.productListing.legoProduct.id} />
        <span className="order-card__item-text"><span className="order-card__item-name">{item.productListing.legoProduct.title}</span><span className="order-card__item-meta">Set {item.productListing.legoProduct.setNumber} · Qty {item.quantity}</span></span>
      </li>)}</ul>
      {hidden > 0 && <p className="order-card__more">+{hidden} more {hidden === 1 ? 'product' : 'products'} in this order</p>}
      <dl className="order-card__facts">
        <div><dt>Payment</dt><dd>{paymentStatusLabel(order.paymentWindow)}</dd></div>
        <div><dt>Delivery</dt><dd>{deliverySummary(order)}</dd></div>
      </dl>
    </div>
  </article></li>
}

function Address({ order, kind }: { order: OrderDetail; kind: 'delivery' | 'billing' }) {
  return <address>{order[`${kind}RecipientName`]}<br />{order[`${kind}Line1`]}<br />
    {order[`${kind}Line2`] && <>{order[`${kind}Line2`]}<br /></>}
    {order[`${kind}City`]}<br />{order[`${kind}County`] && <>{order[`${kind}County`]}<br /></>}
    {order[`${kind}Postcode`]}<br />{countryLabel(order[`${kind}CountryCode`])}
    {order[`${kind}Phone`] && <><br />{order[`${kind}Phone`]}</>}
  </address>
}
function Detail({ order, checking }: { order: OrderDetail; checking: boolean }) {
  return <>
    <p>Placed {displayDate(order.createdAt)}</p><p>Order status: {orderStatusLabel(order.status)}</p>
    <PaymentWindowNotice value={order.paymentWindow} /><OrderProgress order={order} />
    {parsePaymentWindow(order.paymentWindow)?.state === 'PAID' && order.payment?.paidAt && <p>Paid {displayDate(order.payment.paidAt)}</p>}
    <section aria-labelledby="order-items"><h2 id="order-items">Items</h2><ul className="checkout__items">{order.orderItems.map(item => <li key={item.id}>
      <strong>{item.productListing.legoProduct.title}</strong><span>Set {item.productListing.legoProduct.setNumber} · Quantity {item.quantity}</span>
      <span>{item.conditionSnapshot === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : item.conditionSnapshot === 'NEW' ? 'New' : 'Condition unavailable'}</span>
      <span>{formatGbp(priceToPence(item.unitPrice))} each · {formatGbp(priceToPence(item.lineTotal))}</span>
    </li>)}</ul><OrderFinancialSummary order={order} /></section>
    <div className="checkout__columns"><section aria-labelledby="order-delivery"><h2 id="order-delivery">Delivery address</h2><Address order={order} kind="delivery" /></section>
      <section aria-labelledby="order-billing"><h2 id="order-billing">Billing address</h2><Address order={order} kind="billing" /></section></div>
    {order.status === 'DISPATCHED' && <p>{order.dispatchedAt && <>Dispatched {displayDate(order.dispatchedAt)}. </>}{order.shippingCarrier}{order.trackingNumber && <> · Tracking {order.trackingNumber}</>}</p>}
    {order.status === 'COMPLETED' && order.completedAt && <p>Completed {displayDate(order.completedAt)}.</p>}
    <p>Need to return something? <a href="/legal/delivery-returns">Delivery &amp; Returns</a> · <a href="mailto:support@build-and-bloom.co.uk">Contact support</a></p>
    {canResumeCheckout(order) && <button disabled={checking} onClick={() => navigateCheckout(`/checkout/orders/${order.id}`)}>{paymentActionLabel(order.paymentWindow)}</button>}
  </>
}
