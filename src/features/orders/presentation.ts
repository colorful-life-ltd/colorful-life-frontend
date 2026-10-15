import type { OrderDetail } from './api'
import { canRecoverPayment, paymentAction } from '../checkout/paymentWindow'

const orderLabels: Record<string, string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', DISPATCHED: 'Dispatched', COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', RETURNED: 'Returned' }
export const orderStatusLabel = (status: string) => Object.hasOwn(orderLabels, status) ? orderLabels[status] : 'Status unavailable'
export function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
// This only controls navigation; checkout rereads and makes all payment decisions.
export const canResumeCheckout = (order: OrderDetail) => order.status === 'PENDING' && paymentAction(order.paymentWindow) !== null
export function orderDetailId(path: string): number | null {
  const match = /^\/account\/orders\/([1-9]\d*)\/?$/.exec(path)
  const id = match ? Number(match[1]) : null
  return id !== null && Number.isSafeInteger(id) ? id : null
}

export const canCheckPayment = (order: OrderDetail) => canRecoverPayment(order.paymentWindow)
