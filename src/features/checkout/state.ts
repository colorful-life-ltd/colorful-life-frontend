import {customerAddressError,normalizePostcode} from '../account/customerInput'
import { parsePaymentWindow } from './paymentWindow'
import type { Address } from '../account/addressApi'
import { cartCheckoutBlocked, checkoutQuantity, type CartItem } from '../cart/CartContext'
import type { DeliveryAddress, Order, OrderInput } from './api'
import { isShippingMethod, type ShippingMethodCode } from './shipping'

export function deliverySnapshot(address: Address): DeliveryAddress {
  const country = address.country.trim().toUpperCase()
  const countryCode = ['UK', 'UNITED KINGDOM', 'GREAT BRITAIN'].includes(country) ? 'GB' : country
  // Saved addresses support country codes; never truncate arbitrary country names.
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
  if (!codes.includes(countryCode)) throw new Error('Please edit this saved address to use a valid two-letter country code, such as GB.')
  if (countryCode !== 'GB') throw new Error('Delivery is supported only in the United Kingdom.')
  const validation = customerAddressError(address)
  if (validation) throw new Error(validation)
  for (const field of ['recipientName', 'line1', 'city', 'postcode'] as const) if (!address[field].trim()) throw new Error('Please complete the required fields in your saved delivery address.')
  return { recipientName: address.recipientName.trim(), line1: address.line1.trim(), city: address.city.trim(), postcode: normalizePostcode(address.postcode), countryCode, ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}), ...(address.phone?.trim() ? { phone: address.phone.trim() } : {}) }
}
// The customer's explicit method is sent as identity only; there is deliberately no default.
export const orderInput = (items: CartItem[], address: Address, shippingMethod: ShippingMethodCode | null): OrderInput => { if (!isShippingMethod(shippingMethod)) throw new Error('Choose Standard or Express delivery before creating your order.'); if (cartCheckoutBlocked(items)) throw new Error('Please resolve unavailable items in your cart before checking out.'); return ({ shippingMethod, items: items.map(item => { const quantity = checkoutQuantity(item); if (quantity === null) throw new Error('Please refresh your cart before checking out.'); return { productListingId: item.productListingId, quantity } }).filter(item => item.quantity > 0), deliveryAddress: deliverySnapshot(address) }) }
export const isConfirmed = (order: Order) => parsePaymentWindow(order.paymentWindow)?.state === 'PAID' && ['CONFIRMED', 'DISPATCHED', 'COMPLETED'].includes(order.status)
export const isTerminal = (order: Order) => parsePaymentWindow(order.paymentWindow)?.state === 'NOT_PAYABLE'
export function checkoutOrderId(path: string): number | null {
  const match = path.match(/^\/checkout\/orders\/([1-9]\d*)\/?$/)
  const id = match ? Number(match[1]) : null
  return id !== null && Number.isSafeInteger(id) ? id : null
}
/** Capture only an actual redirect hint; preserve router state and never persist secrets. */
export function captureStripeReturn(orderId: number | null, userId?: number) {
  const url = new URL(window.location.href)
  const prior = window.history.state
  const returned = !!orderId && /^pi_[A-Za-z0-9_]+$/.test(url.searchParams.get('payment_intent') ?? '') && url.searchParams.has('redirect_status')
  const state = returned ? { ...prior, checkoutVerificationOrderId: orderId, ...(userId !== undefined ? { checkoutVerificationUserId: userId } : {}) } : prior
  for (const name of ['payment_intent', 'payment_intent_client_secret', 'redirect_status']) url.searchParams.delete(name)
  window.history.replaceState(state, '', url.pathname + url.search + url.hash)
}
/** One-shot handoff to an authenticated owned-order read, never proof of payment. */
export function consumeStripeReturn(orderId: number | null, userId: number): boolean {
  captureStripeReturn(orderId, userId)
  const prior = window.history.state
  const returned = orderId !== null && prior?.checkoutVerificationOrderId === orderId
    && (prior?.checkoutVerificationUserId === undefined || prior.checkoutVerificationUserId === userId)
  if (prior && ('checkoutVerificationOrderId' in prior || 'checkoutVerificationUserId' in prior)) {
    const state = { ...prior }
    delete state.checkoutVerificationOrderId
    delete state.checkoutVerificationUserId
    window.history.replaceState(Object.keys(state).length ? state : null, '')
  }
  return returned
}

export function navigateCheckout(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// REPLAY_REJECTED: a saved request was refused on replay; an earlier send may still have created an order.
export type CreationAttempt = { key: string; input: OrderInput; rejection?: 'EMAIL_VERIFICATION_REQUIRED' | 'REPLAY_REJECTED' }
const storageKey = (userId: number) => `colorful-life:checkout-attempt:${userId}`
export function readAttempt(userId: number): CreationAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? 'null') as CreationAttempt | null
    return value && typeof value.key === 'string' && Array.isArray(value.input?.items) ? value : null
  } catch { return null }
}
export function saveAttempt(userId: number, attempt: CreationAttempt) {
  // The exact request snapshot is necessary to safely retry an ambiguous creation after refresh.
  try { sessionStorage.setItem(storageKey(userId), JSON.stringify(attempt)) }
  catch { throw new Error('Your browser cannot save checkout recovery information. Enable session storage before continuing.') }
}
/** A request saved before shipping became mandatory must never be replayed with an invented method. */
export const isLegacyAttempt = (attempt: CreationAttempt | null) => !!attempt && !isShippingMethod(attempt.input.shippingMethod)
export function clearAttempt(userId: number) { try { sessionStorage.removeItem(storageKey(userId)) } catch { /* The durable order URL still allows recovery. */ } }
