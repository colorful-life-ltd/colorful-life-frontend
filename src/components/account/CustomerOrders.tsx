import {CustomerReturns} from './CustomerReturns'
import { OrderDetails } from './OrderDetails'
import { useConfirmedCartRefresh } from '../../features/cart/useConfirmedCartRefresh'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError, isVerificationRequired } from '../../features/auth/api'
import { listOrders, readOrder, type OrderSummary, type OrderDetail } from '../../features/orders/api'
import { canCheckPayment, deliverySummary, displayDay, orderDetailId, orderStatusLabel, paymentStatusLabel } from '../../features/orders/presentation'
import { OrderItemThumbnail } from './OrderItemThumbnail'
import { isOlderPaymentSnapshot, paymentMessage } from '../../features/checkout/paymentWindow'
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
  // Order Details places its refresh action here, beside the title.
  const [headerAction, setHeaderAction] = useState<HTMLDivElement | null>(null)
  return <main className={`checkout customer-orders${list ? '' : ' customer-orders--detail'}`} tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p>
    {list || !id ? <h1>{list ? 'My Orders' : 'Order unavailable'}</h1>
      : <div className="order-detail-title"><h1>Order #{id}</h1><div className="order-detail-title__action" ref={setHeaderAction} /></div>}
    {list && <button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>}
    {state.status === 'authenticated' ? list || id ? <VerifiedOrders key={`${state.token}:${path}`} token={state.token} id={id} onAuthenticate={onAuthenticate} headerAction={headerAction} /> : <p role="alert">This order cannot be opened. Please return to My Orders.</p>
      : state.status === 'verificationRequired' ? <VerificationNotice token={state.token} message="Please verify your email to view your orders." />
      : state.status === 'resolving' ? <p role="status">Restoring your account…</p> : <><p>Please sign in to view your orders.</p><button onClick={onAccount}>Sign in</button></>}
    {list ? <><BotanicalDivider /><button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button></>
      : <nav className="order-detail-nav" aria-label="Order navigation"><button className="checkout__secondary" onClick={() => navigateCheckout('/account/orders')}>Back to My Orders</button><button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button></nav>}
  </div></main>
}

type ReadState = { phase: 'loading' } | { phase: 'ready'; orders: OrderSummary[]; detail: OrderDetail | null } | { phase: 'error' } | { phase: 'auth' } | { phase: 'verification' } | { phase: 'unavailable' }
function VerifiedOrders({ token, id, onAuthenticate, headerAction }: { token: string; id: number | null; onAuthenticate: () => void; headerAction: HTMLElement | null }) {
  const [state, setState] = useState<ReadState>({ phase: 'loading' })
  const snapshots = useRef(new Map<number, OrderSummary | OrderDetail>())
  const recovering = useRef(false)
  const generation = useRef(0)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState('')
  useConfirmedCartRefresh(state.phase === 'ready' ? state.detail : null)
  const [revision, setRevision] = useState(0)
  const reload = () => { setFeedback(''); setState({ phase: 'loading' }); setRevision(value => value + 1) }
  // Order Details refreshes in place: the same read replaces the shown order, so the view and scroll position stay put.
  // The header button uses aria-disabled (not disabled) while busy so keyboard focus stays on it; this guard ignores clicks.
  const [refreshing, setRefreshing] = useState(false)
  const [returnsRefresh, setReturnsRefresh] = useState(0)
  const refreshDetail = () => {
    if (refreshing || checking) return
    setFeedback(''); setRefreshing(true); setRevision(value => value + 1); setReturnsRefresh(value => value + 1)
  }
  // Quietly re-read the order after a return change so the status card and item badges match the Returns section.
  const syncDetail = () => {
    if (id === null) return
    const current = generation.current
    void readOrder(token, id).then(next => {
      if (generation.current !== current || recovering.current) return
      setState(previous => previous.phase === 'ready' && previous.detail?.id === next.id && !isOlderPaymentSnapshot(previous.detail, next) ? { ...previous, detail: next } : previous)
    }, () => { /* Keep the current view; the customer can refresh the order. */ })
  }
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
      setRefreshing(false)
    }, reason => {
      if (!active) return
      setRefreshing(false)
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
    {state.detail ? <OrderDetails order={state.detail} checking={checking || refreshing} feedback={feedback} onCheckPayment={() => void checkPayment()}
      returns={canRequestReturns(state.detail) && <CustomerReturns key={`${token}:${state.detail.id}`} token={token} orderId={state.detail.id} initiallyOpen={hasReturnLines(state.detail)} onChanged={syncDetail} refreshSignal={returnsRefresh} />} />
      : state.orders.length ? <ol className="order-history" aria-label="Your orders, newest first">{state.orders.map(order => <OrderCard key={order.id} order={order} />)}</ol> : <p className="order-history__empty">You haven’t placed any orders yet.</p>}
    {id === null && <button className="checkout__secondary" disabled={checking} onClick={reload}>Refresh orders</button>}
    {state.detail && headerAction && createPortal(<button type="button" className="checkout__secondary order-refresh" aria-disabled={checking || refreshing} aria-busy={refreshing}
      aria-label={`${refreshing ? 'Refreshing' : 'Refresh'} order #${state.detail.id}`} onClick={refreshDetail}>
      <svg className="order-refresh__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" /></svg>
      <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
    </button>, headerAction)}
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

// Unchanged Return V1 eligibility: paid, dispatched orders only.
const canRequestReturns = (order: OrderDetail) => ['DISPATCHED', 'COMPLETED', 'RETURNED'].includes(order.status) && !!order.dispatchedAt && order.payment?.status === 'SUCCEEDED' && !!order.payment.paidAt
const hasReturnLines = (order: OrderDetail) => order.orderItems.some(item => ((item as { returns?: unknown[] }).returns ?? []).length > 0)
