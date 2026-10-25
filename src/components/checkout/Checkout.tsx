import { useConfirmedCartRefresh } from '../../features/cart/useConfirmedCartRefresh'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError } from '../../features/auth/api'
import { countryLabel, deliverySelection, isUsableUkAddress } from '../../features/account/addressState'
import { getAddresses, type Address } from '../../features/account/addressApi'
import { cartCheckoutBlocked, checkoutQuantity, cartTotalPence, formatGbp, lineAmountPence, priceToPence, useCart } from '../../features/cart/CartContext'
import { checkoutOrderId, captureStripeReturn, isLegacyAttempt, navigateCheckout, orderInput } from '../../features/checkout/state'
import { estimatedTotalPence, getShippingOptions, isShippingMethod, shippingCharge, type ShippingMethodCode, type ShippingOptions } from '../../features/checkout/shipping'
import { ShippingMethodSelector } from './ShippingMethodSelector'
import { OrderFinancialSummary } from './OrderFinancialSummary'
import { useCheckout } from '../../features/checkout/useCheckout'
import { parsePaymentWindow, paymentAction, paymentActionLabel } from '../../features/checkout/paymentWindow'
import { PaymentWindowNotice } from './PaymentWindowNotice'
import { sandboxCheckout } from '../../features/checkout/sandbox'
import { PayPalSandboxButtons } from './PayPalSandboxButtons'
import { StripePaymentForm } from './StripePaymentForm'
import { PreContractSummary } from '../legal/PreContractSummary'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import './Checkout.css'
import { CartItems } from '../cart/CartItems'
import { availabilityMessage, cartCopy } from '../../features/i18n/cartCopy'
import { VerificationNotice } from '../account/VerificationNotice'

export function Checkout({ onAccount, onAddresses = onAccount, addressRevision = 0 }: { onAccount: () => void; onAddresses?: () => void; addressRevision?: number }) {
  const { state, logout } = useAuth()
  const returnOrderId = checkoutOrderId(window.location.pathname)
  useLayoutEffect(() => { captureStripeReturn(returnOrderId, state.status === 'authenticated' ? state.user.id : undefined) }, [returnOrderId, state])
  const validLocation = /^\/checkout\/?$/.test(window.location.pathname) || checkoutOrderId(window.location.pathname) !== null
  return <main className="checkout" tabIndex={-1}>
    <div className="checkout__paper">
      {!validLocation ? <><h1>Checkout</h1><p role="alert">This order link is invalid. Please return to the storefront.</p></> : state.status === 'authenticated' ? <AuthenticatedCheckout key={`${state.user.id}:${state.token}`} token={state.token} userId={state.user.id} onAddresses={onAddresses} addressRevision={addressRevision} onAuthenticate={() => { logout(); onAccount() }} /> : <>
        <h1>Checkout</h1>
        {state.status === 'verificationRequired' ? <VerificationNotice token={state.token} message="Verify your email before an order can be created. Your saved checkout request will be retained." /> : <p role="status">{state.status === 'resolving' ? 'Restoring your account…' : 'Please sign in to continue your checkout.'}</p>}
        {state.status !== 'resolving' && <button onClick={onAccount}>Open account</button>}
      </>}
      <BotanicalDivider />
      <button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>
    </div>
  </main>
}

function AddressCopy({ name, line1, line2, city, postcode, country }: { name: string; line1: string; line2?: string | null; city: string; postcode: string; country: string }) {
  return <address>{name}<br />{line1}<br />{line2 && <>{line2}<br /></>}{city}<br />{postcode}<br />{countryLabel(country)}</address>
}

function AuthenticatedCheckout({ token, userId, onAddresses, addressRevision, onAuthenticate }: { token: string; userId: number; onAddresses: () => void; addressRevision: number; onAuthenticate: () => void }) {
  const cart = useCart()
  const copy = cartCopy()
  const orderId = checkoutOrderId(window.location.pathname)
  const checkout = useCheckout(token, userId, orderId)
  const { order, phase, message, secret, attempt } = checkout
  useConfirmedCartRefresh(order)
  const [cartChecked, setCartChecked] = useState(false)
  const refreshOnMount = useRef(cart.refreshCart)
  useEffect(() => {
    if (orderId) return
    let active = true
    void refreshOnMount.current().then(() => { if (active) setCartChecked(true) })
    return () => { active = false }
  }, [orderId])
  const blocked = cartCheckoutBlocked(cart.items)
  const reviewing = !orderId && !order && (phase === 'cart-conflict' || (!attempt && blocked))
  useEffect(() => {
    if (reviewing) document.getElementById('cart-review-title')?.focus()
  }, [reviewing])
  const availableItems = cart.items.filter(item => (checkoutQuantity(item) ?? 0) > 0)
  const [addresses, setAddresses] = useState<Address[]>([])
  const deliberateDelivery = useRef(false)
  const selectedDelivery = useRef<number | null>(null)
  const [addressId, setAddressId] = useState<number | null>(null)
  const [addressLoading, setAddressLoading] = useState(!orderId)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressAuthRequired, setAddressAuthRequired] = useState(false)
  const [reload, setReload] = useState(0)
  const [inputError, setInputError] = useState<string | null>(null)
  // Delivery prices come only from the backend catalogue. There is deliberately no default method.
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null)
  const [shippingLoading, setShippingLoading] = useState(!orderId)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [shippingReload, setShippingReload] = useState(0)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodCode | null>(null)
  const [shippingInvalid, setShippingInvalid] = useState(false)
  useEffect(() => {
    if (orderId) return
    let active = true
    void Promise.resolve().then(() => { if (active) setShippingLoading(true) })
    void getShippingOptions().then(options => {
      if (!active) return
      setShippingOptions(options); setShippingError(null)
      // A method withdrawn from the catalogue is cleared, never swapped for another.
      setShippingMethod(current => current && options.methods.some(option => option.code === current) ? current : null)
    }).catch(reason => {
      if (!active) return
      setShippingOptions(null); setShippingError(reason instanceof Error ? reason.message : 'Delivery options are unavailable right now.')
    }).finally(() => { if (active) setShippingLoading(false) })
    return () => { active = false }
  }, [orderId, shippingReload])
  useEffect(() => {
    if (orderId) return
    let active = true
    void Promise.resolve().then(() => { if (active) setAddressLoading(true) })
    void getAddresses(token).then(result => {
      if (!active) return
      const nextId = deliverySelection(result, selectedDelivery.current, deliberateDelivery.current)
      if (nextId !== selectedDelivery.current) deliberateDelivery.current = false
      selectedDelivery.current = nextId
      setAddresses(result); setAddressId(nextId); setAddressError(null); setAddressAuthRequired(false)
    }).catch(reason => {
      if (!active) return
      const authRequired = reason instanceof AuthApiError && [401, 403].includes(reason.status)
      setAddressAuthRequired(authRequired)
      setAddressError(authRequired ? 'Please sign in and verify your account to load saved addresses.' : 'Unable to load saved addresses. Please try again.')
    }).finally(() => { if (active) setAddressLoading(false) })
    return () => { active = false }
  }, [orderId, token, reload, addressRevision])
  const selected = addresses.find(address => address.id === addressId)
  const billing = addresses.find(address => address.isDefaultBilling)
  const pending = ['creating', 'loading', 'preparing', 'waiting', 'submitting', 'verifying'].includes(phase)
  const confirmed = phase === 'confirmed'
  const frozen = Boolean(attempt)
  const verificationBlocked = phase === 'verification'
  const definiteRejection = attempt?.rejection === 'EMAIL_VERIFICATION_REQUIRED'
  const legacyAttempt = isLegacyAttempt(attempt)
  // Saved requests that may already have created an order: recovery via My Orders only, never another send.
  const recoveryOnly = legacyAttempt || attempt?.rejection === 'REPLAY_REJECTED'
  const savedShipping = attempt && isShippingMethod(attempt.input.shippingMethod) ? attempt.input.shippingMethod : null
  const displayedShipping = frozen ? savedShipping : shippingMethod
  const shippingOption = shippingOptions?.methods.find(option => option.code === displayedShipping) ?? null
  const merchandisePence = cartTotalPence(availableItems.map(item => ({ ...item, quantity: checkoutQuantity(item)! })))
  const canCreate = !orderId && !order && !pending && phase !== 'terminal' && phase !== 'cart-conflict' && !verificationBlocked && (frozen ? !recoveryOnly : (Boolean(shippingOptions) && !shippingLoading && cartChecked && !blocked && availableItems.length > 0 && !cart.error && !cart.isLoading && !cart.pendingItemIds.length && Boolean(selected && isUsableUkAddress(selected) && billing && isUsableUkAddress(billing)) && !addressError && !addressLoading))

  // Ambiguous attempts must keep their exact identity/payload for recovery.
  // Definitive rejections and fresh blocked carts instead show editable review.
  if (reviewing) {
    const details = checkout.conflict?.details
    const affected = cart.items.find(item => item.productListingId === details?.productListingId)
    return <section aria-labelledby="cart-review-title">
      <h1 id="cart-review-title" tabIndex={-1}>{copy.review}</h1>
      <p id="cart-review-status" role="alert">{phase === 'cart-conflict' ? copy.conflict : copy.blocked}</p>
      {checkout.conflict && <div className="checkout__notice" role="status">
        {details?.productListingId !== undefined && <p>{copy.affected(affected?.listing.legoProduct.title ?? copy.listing(details.productListingId))}</p>}
        <p>{availabilityMessage(details?.reason ?? checkout.conflict.code, details?.availableQuantity)}</p>
        {details?.requestedQuantity !== undefined && <p>{copy.requested(details.requestedQuantity)}</p>}
        {details?.availableQuantity !== undefined && <p>{copy.capacity(details.availableQuantity)}</p>}
      </div>}
      {phase === 'cart-conflict' && blocked && <p id="cart-review-blocked">{copy.blocked}</p>}
      {(cart.isLoading || cart.pendingItemIds.length > 0) && <p id="cart-review-updating" role="status">{copy.updating}</p>}
      {!!cart.items.length && !availableItems.length && <p id="cart-review-no-fresh">{copy.freshNone}</p>}
      <CartItems items={cart.items} affectedListingId={details?.productListingId} />
      <button disabled={cart.isLoading || !!cart.pendingItemIds.length} onClick={() => void cart.refreshCart()}>{copy.refresh}</button>
      <button onClick={() => navigateCheckout('/account/orders')}>{copy.orders}</button>
      {phase === 'cart-conflict' && <button aria-describedby={`cart-review-status${cart.error ? ' cart-items-error' : ''}${blocked ? ' cart-review-blocked' : ''}${cart.isLoading || cart.pendingItemIds.length ? ' cart-review-updating' : ''}${cart.items.length && !availableItems.length ? ' cart-review-no-fresh' : ''}`} disabled={!cartChecked || blocked || cart.isLoading || !!cart.error || !!cart.pendingItemIds.length || !availableItems.length} onClick={checkout.reviewComplete}>{copy.continue}</button>}
    </section>
  }

  return <>
    <p className="checkout__eyebrow">Build &amp; Bloom · Your purchase</p>
    <h1>{confirmed ? 'Thank you for your order' : 'Checkout'}</h1>
    {orderId && <p>Order #{orderId}</p>}
    {(message || inputError || addressError) && <p className="checkout__error" role="alert">{message || inputError || addressError}</p>}
    {confirmed && order && <div className="checkout__notice" role="status"><strong>Payment confirmed · Your order #{order.id} is confirmed</strong>{order.payment?.status === 'SUCCEEDED' && order.payment.currency === 'GBP' && order.payment.amount && <p>Paid {formatGbp(priceToPence(order.payment.amount))}</p>}<p>Thank you for your purchase. Payment has been recorded. {order.status === 'DISPATCHED' ? 'Order dispatched' : order.status === 'COMPLETED' ? 'Order completed' : 'Order confirmed'}</p><a href={`/account/orders/${order.id}`}>View my order</a></div>}
    {phase === 'terminal' && <div className="checkout__notice" role="status"><p>{order ? 'This order cannot currently accept a payment. Its payment information is shown below.' : 'This checkout cannot continue.'}</p><button onClick={checkout.restart}>Return to storefront and review cart</button></div>}
    {(phase === 'auth' || addressAuthRequired) && <button onClick={onAuthenticate}>Sign in / verify account</button>}
    {verificationBlocked && <VerificationNotice token={token} message={orderId ? 'Verify your email to view this order and continue its payment flow. Your existing order is retained.' : 'Your order request was not accepted because your email is not verified. No order was created by this request. Your checkout details are saved.'} onVerified={checkout.resumeAfterVerification} />}
    {phase === 'loading' && <p role="status">Loading your order…</p>}

    {(order || !orderId) && <div className="checkout__columns">
      <section aria-labelledby="checkout-summary"><h2 id="checkout-summary">{order ? 'Order summary' : 'Items for this checkout'}</h2>
        {order ? <><ul className="checkout__items">{order.orderItems.map(item => <li key={item.id}><strong>{item.productListing.legoProduct.title}</strong><span>{item.conditionSnapshot === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : 'New'} · Quantity {item.quantity}</span><span>{formatGbp(priceToPence(item.unitPrice))} each · {formatGbp(priceToPence(item.lineTotal))}</span></li>)}</ul><OrderFinancialSummary order={order} /></> : <>
          {cart.isLoading ? <p role="status">Loading your cart…</p> : <ul className="checkout__items">{availableItems.map(item => <li key={item.productListingId}><strong>{item.listing.legoProduct.title}</strong><span>{item.listing.condition === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : 'New'} · Quantity {checkoutQuantity(item)}</span><span>{formatGbp(priceToPence(item.listing.effectivePrice))} each · {formatGbp(lineAmountPence({ ...item, quantity: checkoutQuantity(item)! }))}</span></li>)}</ul>}
          {!cart.items.length && !cart.isLoading && <p>Your cart is empty. Add an item before checking out.</p>}
          <dl className="checkout__financials" aria-label="Estimated price breakdown">
            <div><dt>Merchandise subtotal</dt><dd>{formatGbp(merchandisePence)}</dd></div>
            <div><dt>Delivery</dt><dd>{shippingOption ? `${shippingOption.method} · ${shippingCharge(shippingOption)}` : displayedShipping ? 'Confirmed when your order is reserved' : 'Choose a delivery method'}</dd></div>
            <div className="checkout__total"><dt>Estimated total</dt><dd><strong>{shippingOption && !frozen ? formatGbp(estimatedTotalPence(merchandisePence, shippingOption)) : frozen ? 'Confirmed when your order is reserved' : 'Shown after you choose delivery'}</strong></dd></div>
          </dl>
          <p>Final prices, delivery charge and availability are confirmed when your order is reserved.</p>
          {!!cart.items.length && !availableItems.length && !cart.isLoading && !cart.error && <p id="checkout-no-fresh">{copy.freshNone} <button onClick={() => navigateCheckout('/account/orders')}>{copy.orders}</button></p>}
          {cart.error && <p role="alert">{cart.error}</p>}
        </>}
      </section>
      <section aria-labelledby="checkout-delivery"><h2 id="checkout-delivery">Delivery address</h2>
        {order ? <AddressCopy name={order.deliveryRecipientName} line1={order.deliveryLine1} line2={order.deliveryLine2} city={order.deliveryCity} postcode={order.deliveryPostcode} country={order.deliveryCountryCode} /> : <>
          {frozen ? <><p>{definiteRejection ? 'Your checkout request is saved. Continuing after verification uses the same items and delivery address.' : 'A checkout request is saved. Retry uses the original items, delivery address and delivery method, even if your cart has since changed.'}</p><ul>{attempt?.input.items.map(item => <li key={item.productListingId}>Listing #{item.productListingId} · Quantity {item.quantity}</li>)}</ul>{attempt?.input.deliveryAddress && <AddressCopy name={attempt.input.deliveryAddress.recipientName} line1={attempt.input.deliveryAddress.line1} line2={attempt.input.deliveryAddress.line2} city={attempt.input.deliveryAddress.city} postcode={attempt.input.deliveryAddress.postcode} country={attempt.input.deliveryAddress.countryCode} />}</> : addressLoading ? <p role="status">Loading addresses…</p> : <>
            {addresses.length === 0 ? <><p>You need a delivery address before continuing.</p><button disabled={pending} onClick={onAddresses}>Add delivery address</button></> : <><label>Saved delivery address<select value={addressId ?? ''} onChange={event => { deliberateDelivery.current = true; selectedDelivery.current = Number(event.target.value); setAddressId(selectedDelivery.current); setInputError(null) }} disabled={pending}><option value="" disabled>Choose an address</option>{addresses.map(address => <option key={address.id} value={address.id}>{address.recipientName} · {address.line1} · {address.postcode}</option>)}</select></label>
            {(!selected || !isUsableUkAddress(selected)) && <p>Please add or update a valid United Kingdom delivery address before continuing.</p>}{selected && <AddressCopy name={selected.recipientName} line1={selected.line1} line2={selected.line2} city={selected.city} postcode={selected.postcode} country={selected.country} />}</>}
          </>}
          {(addresses.length > 0 || frozen) && <button className="checkout__secondary" disabled={pending} onClick={onAddresses}>Manage saved addresses in My Account</button>}
          {addressError && <button className="checkout__secondary" disabled={pending} onClick={() => { setAddressLoading(true); setReload(value => value + 1) }}>Try loading addresses again</button>}
        </>}
        <h2>Billing address</h2>
        {order ? <AddressCopy name={order.billingRecipientName} line1={order.billingLine1} line2={order.billingLine2} city={order.billingCity} postcode={order.billingPostcode} country={order.billingCountryCode} /> : billing && isUsableUkAddress(billing) ? <AddressCopy name={billing.recipientName} line1={billing.line1} line2={billing.line2} city={billing.city} postcode={billing.postcode} country={billing.country} /> : !addressLoading && <><p>You need a default billing address before continuing.</p>{addresses.length > 0 && <button disabled={pending} onClick={onAddresses}>Set up billing address</button>}</>}
        {!order && <p>Your saved default billing address will be used. Delivery selection does not change it.</p>}
      </section>
    </div>}
    {!orderId && !order && phase !== 'terminal' && <ShippingMethodSelector options={shippingOptions} loading={shippingLoading} error={shippingError} selected={displayedShipping} locked={frozen}
      disabled={pending} invalid={shippingInvalid && !frozen && !shippingMethod} onRetry={() => setShippingReload(value => value + 1)}
      onSelect={code => { setShippingMethod(code); setShippingInvalid(false); setInputError(null) }} />}
    {!orderId && recoveryOnly && <div className="checkout__notice" role="status"><p>{legacyAttempt ? 'This saved checkout request was made before delivery options were introduced, so it cannot be sent again. An order may already exist: check My Orders before starting again.' : 'An order may already exist from this saved checkout request. Check My Orders before starting a new checkout.'}</p><button onClick={() => navigateCheckout('/account/orders')}>View My Orders</button><button className="checkout__secondary" onClick={checkout.restart}>Leave saved checkout and review cart</button></div>}
    {!orderId && phase !== 'terminal' && <PreContractSummary stage="order" />}
    {!orderId && phase !== 'terminal' && <button aria-describedby={!frozen && cart.items.length && !availableItems.length && !cart.isLoading && !cart.error ? 'checkout-no-fresh' : undefined} disabled={!canCreate} onClick={() => {
      if (!frozen && !shippingMethod) { setShippingInvalid(true); document.querySelector<HTMLInputElement>('input[name="shipping-method"]')?.focus(); return }
      try { const input = attempt?.input ?? (selected ? orderInput(cart.items, selected, shippingMethod) : null); if (input) { setInputError(null); void checkout.create(input) } }
      catch (reason) { setInputError(reason instanceof Error ? reason.message : 'Please check your delivery address.') }
    }}>{phase === 'creating' ? 'Reserving your order…' : verificationBlocked ? 'Verify email before creating order' : definiteRejection ? 'Continue saved checkout' : frozen ? 'Retry saved order request' : 'Create order and review total'}</button>}
    {!orderId && frozen && !recoveryOnly && !definiteRejection && !pending && phase !== 'terminal' && <p>Retry first if the previous response was lost. Starting again abandons recovery of that request. <button className="checkout__secondary" onClick={checkout.restart}>Leave saved checkout and review cart</button></p>}
    {order && !confirmed && <section className="checkout__payment" aria-labelledby="checkout-payment"><h2 id="checkout-payment">Payment</h2>
      <PaymentWindowNotice checkoutActive={phase === 'payment' || phase === 'submitting'} value={order.paymentWindow} verification={['verifying', 'waiting'].includes(phase) ? 'active' : phase === 'verification-timeout' ? 'timeout' : undefined} />
      {parsePaymentWindow(order.paymentWindow)?.state === 'PAID' && !confirmed && <p>Payment is recorded, but this order is not yet confirmed for fulfilment. Please wait for an update or contact us; do not pay again.</p>}
      {order.paymentWindow?.provider === 'STRIPE' && order.status === 'PENDING' && paymentAction(order.paymentWindow) && !checkout.actionRejected && !['auth', 'verification', 'terminal', 'loading', 'preparing', 'waiting', 'payment', 'submitting', 'verifying', 'verification-timeout'].includes(phase) && <button onClick={() => void checkout.prepare()}>{paymentActionLabel(order.paymentWindow)}</button>}
      {phase === 'preparing' && <p role="status">Checking your payment window and preparing secure payment…</p>}
      {order.paymentWindow?.provider === 'STRIPE' && ['payment', 'submitting'].includes(phase) && secret && <PreContractSummary stage="payment" />}
      {order.paymentWindow?.provider === 'STRIPE' && ['payment', 'submitting'].includes(phase) && secret && <StripePaymentForm key={secret} clientSecret={secret} orderId={order.id} onVerify={checkout.paymentSubmitted} onRecheck={() => void checkout.recheck()} beforeConfirm={checkout.beforeConfirm} onSubmissionSettled={checkout.submissionSettled} />}
      {['waiting', 'verifying'].includes(phase) && <p role="status">Payment is being verified. Confirming your order…</p>}

      {sandboxCheckout && order.status === 'PENDING' && order.paymentWindow?.provider === 'PAYPAL' && paymentAction(order.paymentWindow) && !['verifying','verification-timeout','waiting'].includes(phase) && <PayPalSandboxButtons token={token} orderId={order.id} onVerification={() => checkout.paymentSubmitted()} onRefresh={() => { void checkout.reloadOrder() }} />}
      {sandboxCheckout && !['PAYPAL', 'STRIPE'].includes(order.paymentWindow?.provider ?? '') && order.paymentWindow?.state !== 'PAID' && <p role="status">Sandbox payment is unavailable. Refresh the order; live payments are disabled.</p>}
      {order.status === 'PENDING' && !['PAID', 'NOT_PAYABLE'].includes(parsePaymentWindow(order.paymentWindow)?.state ?? '') && !['auth', 'verification'].includes(phase) && <button disabled={pending} onClick={() => void checkout.reloadOrder()}>Check payment status</button>}
    </section>}
    {orderId && !order && phase === 'failure' && <button onClick={() => void checkout.reloadOrder()}>Retry loading order</button>}
  </>
}
