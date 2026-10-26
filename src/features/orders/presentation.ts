import type { OrderDetail, OrderSummary } from './api'
import { canRecoverPayment, parsePaymentWindow, paymentAction } from '../checkout/paymentWindow'
import { parseCustomerExperience } from './experience'

const orderLabels: Record<string, string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', DISPATCHED: 'Dispatched', COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', RETURNED: 'Returned' }
export const orderStatusLabel = (status: string) => Object.hasOwn(orderLabels, status) ? orderLabels[status] : 'Status unavailable'
export function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
export function displayDay(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Short order-history labels for the authoritative payment window; the full explanation stays on Order Detail.
const paymentLabels: Record<string, string> = {
  INITIAL_PAYMENT: 'Awaiting payment', CHECKOUT_RESUMABLE: 'Checkout can be resumed', PROCESSING: 'Payment processing',
  OUTCOME_UNRESOLVED: 'Payment outcome unresolved', RETRY_AVAILABLE: 'Unpaid · replacement payment available',
  RETRY_REQUIRES_PROVIDER_CHECK: 'Payment check required', PAID: 'Paid', NOT_PAYABLE: 'Not payable',
}
const providerNames: Record<string, string> = { PAYPAL: 'PayPal', STRIPE: 'Stripe' }
export function paymentStatusLabel(value: unknown) {
  const window = parsePaymentWindow(value)
  if (!window) return 'Payment status unavailable'
  const label = window.state === 'NOT_PAYABLE' && window.paymentOutcome === 'UNRESOLVED' ? paymentLabels.OUTCOME_UNRESOLVED : paymentLabels[window.state]
  return Object.hasOwn(providerNames, window.provider) ? `${label} · ${providerNames[window.provider]}` : label
}

// Persisted delivery method plus the backend fulfilment stage, if any; carrier and tracking stay on Order Detail.
export function deliverySummary(order: Pick<OrderSummary, 'financials'>) {
  const method = order.financials?.shipping?.method ?? 'Delivery details unavailable'
  const stage = parseCustomerExperience(order)?.fulfilment?.stage
  return stage && Object.hasOwn(stageLabels, stage) ? `${method} · ${stageLabels[stage]}` : method
}
// CONFIRMED is omitted: the order status already says so.
const stageLabels: Record<string, string> = { PREPARING: 'Preparing', DISPATCHED: 'Dispatched', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered' }

// This only controls navigation; checkout rereads and makes all payment decisions.
export const canResumeCheckout = (order: OrderDetail) => order.status === 'PENDING' && paymentAction(order.paymentWindow) !== null
export function orderDetailId(path: string): number | null {
  const match = /^\/account\/orders\/([1-9]\d*)\/?$/.exec(path)
  const id = match ? Number(match[1]) : null
  return id !== null && Number.isSafeInteger(id) ? id : null
}

export const canCheckPayment = (order: OrderDetail) => canRecoverPayment(order.paymentWindow)
