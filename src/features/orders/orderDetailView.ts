import { parsePaymentWindow } from '../checkout/paymentWindow'
import { formatGbp, priceToPence } from '../cart/CartContext'
import { parseCustomerExperience, type CustomerExperience, type CustomerRefund, type CustomerShipment } from './experience'
import type { OrderDetail } from './api'

/**
 * Customer-facing presentation of authoritative backend state for Order Details.
 * Every label maps from a backend value; nothing here infers a state the backend did not report.
 * Returns and refunds are deliberately independent: the backend has no Return→Refund association.
 */

// ---- Returns (per OrderReturn line) ----
export type ReturnStage = 'sent' | 'approved' | 'received' | 'declined' | 'withdrawn'
const stageByStatus: Record<string, ReturnStage> = {
  REQUESTED: 'sent',
  AUTHORIZED: 'approved',
  // INSPECTED and COMPLETED are internal processing steps after physical receipt.
  RECEIVED: 'received', INSPECTED: 'received', COMPLETED: 'received',
  REJECTED: 'declined',
  CANCELLED: 'withdrawn',
}
export const returnStageLabels: Record<ReturnStage, string> = {
  sent: 'Return request sent',
  approved: 'Return request approved',
  received: 'Return received',
  declined: 'Return request declined',
  withdrawn: 'Return request withdrawn',
}
export const returnStage = (status: string): ReturnStage | null => Object.hasOwn(stageByStatus, status) ? stageByStatus[status] : null
export const returnStatusLabel = (status: string) => { const stage = returnStage(status); return stage ? returnStageLabels[stage] : 'Return status unavailable' }

export const RETURN_STEPS = ['sent', 'approved', 'received'] as const
export type ItemReturn = { id: number; quantity: number; stage: ReturnStage }
export type ReturnOverview =
  | { kind: 'none' }
  | { kind: 'unavailable' }
  | { kind: 'progress'; stage: (typeof RETURN_STEPS)[number]; mixed: boolean; units: number }
  | { kind: 'closed' }

/** Return lines per order item, in backend order. Null when the order's return data is malformed. */
export function itemReturns(order: { orderItems: { id: number }[] }): Map<number, ItemReturn[]> | null {
  if (!parseCustomerExperience(order)) return null
  const result = new Map<number, ItemReturn[]>()
  for (const item of order.orderItems as Array<{ id: number; returns?: Array<{ id: number; quantity: number; status: string }> }>) {
    const lines = (item.returns ?? []).flatMap(r => { const stage = returnStage(r.status); return stage ? [{ id: r.id, quantity: r.quantity, stage }] : [] })
    if (lines.length) result.set(item.id, lines)
  }
  return result
}

/** The primary return status follows the least-advanced line still on the return path. */
export function returnOverview(order: { orderItems: { id: number }[] }): ReturnOverview {
  const byItem = itemReturns(order)
  if (!byItem) return { kind: 'unavailable' }
  const lines = [...byItem.values()].flat()
  if (!lines.length) return { kind: 'none' }
  const onPath = lines.filter(l => (RETURN_STEPS as readonly string[]).includes(l.stage))
  if (!onPath.length) return { kind: 'closed' }
  const stages = onPath.map(l => RETURN_STEPS.indexOf(l.stage as (typeof RETURN_STEPS)[number]))
  const lowest = Math.min(...stages)
  return { kind: 'progress', stage: RETURN_STEPS[lowest], mixed: new Set(stages).size > 1, units: onPath.reduce((n, l) => n + l.quantity, 0) }
}

// ---- Order / delivery progress ----
export const ORDER_STEPS = ['Confirmed', 'Preparing', 'Dispatched', 'Delivered'] as const
export type OrderOverview =
  | { kind: 'steps'; current: number; steps: string[]; title: string }
  | { kind: 'message'; title: string; detail?: string }

const stageIndex: Record<string, number> = { CONFIRMED: 0, PREPARING: 1, DISPATCHED: 2, IN_TRANSIT: 2, DELIVERED: 3 }
export function orderOverview(order: OrderDetail, experience: CustomerExperience | null): OrderOverview {
  if (experience?.cancellation?.state === 'CANCELLED' || order.status === 'CANCELLED') return { kind: 'message', title: 'Order cancelled' }
  if (experience?.cancellation?.state === 'REQUESTED') return { kind: 'message', title: 'Cancellation requested', detail: 'We are reviewing your request. Your order is not cancelled yet.' }
  if (order.status === 'PENDING') return parsePaymentWindow(order.paymentWindow)?.state === 'PAID'
    ? { kind: 'message', title: 'Confirming your order', detail: 'Your payment has been recorded and the order is being confirmed.' }
    : { kind: 'message', title: 'Awaiting payment' }
  if (order.status === 'EXPIRED') return { kind: 'message', title: 'Order expired', detail: 'This order was not paid in time and has not been placed.' }
  if (order.status === 'RETURNED') return { kind: 'message', title: 'Order returned' }
  if (!['CONFIRMED', 'DISPATCHED', 'COMPLETED'].includes(order.status)) return { kind: 'message', title: 'Status unavailable', detail: 'Refresh the order for its latest status.' }
  const stage = experience?.fulfilment?.stage
  const steps: string[] = [...ORDER_STEPS]
  let current = stage && Object.hasOwn(stageIndex, stage) ? stageIndex[stage] : order.status === 'DISPATCHED' ? 2 : 0
  if (order.status === 'COMPLETED' && stage !== 'DELIVERED') { steps[3] = 'Completed'; current = 3 }
  const title = stage === 'IN_TRANSIT' ? 'In transit' : steps[current]
  return { kind: 'steps', current, steps, title: current === 0 ? 'Order confirmed' : title }
}

// ---- Delivery ----
export type DeliveryView = { method: string | null; shipments: CustomerShipment[] }
export function deliveryView(order: OrderDetail, experience: CustomerExperience | null): DeliveryView {
  const method = order.financials?.shipping?.method ?? null
  const shipments = experience?.fulfilment?.shipments ?? []
  if (shipments.length || !order.dispatchedAt || !order.shippingCarrier) return { method, shipments }
  // Legacy orders recorded carrier/tracking directly on the order.
  return { method, shipments: [{ sequence: 1, carrierName: order.shippingCarrier, trackingNumber: order.trackingNumber, trackingUrl: null, dispatchedAt: order.dispatchedAt }] }
}

// ---- Payment and refunds (order level only) ----
export type RefundView = { id: number; amount: string; label: string; createdAt: string; tone: 'ok' | 'pending' | 'problem' }
export function refundView(refund: CustomerRefund): RefundView {
  const base = { id: refund.id, amount: formatGbp(priceToPence(refund.amount)), createdAt: refund.createdAt }
  if (refund.reviewRequired) return { ...base, label: 'Refund under review', tone: 'pending' }
  if (refund.status === 'SUCCEEDED') return { ...base, label: 'Refund issued', tone: 'ok' }
  if (refund.status === 'PROCESSING') return { ...base, label: 'Refund pending', tone: 'pending' }
  return { ...base, label: 'Refund not completed', tone: 'problem' }
}
export type PaymentView = { paid: boolean; label: string; paidAt: string | null; refunds: RefundView[] }
export function paymentView(order: OrderDetail, experience: CustomerExperience | null): PaymentView {
  const window = parsePaymentWindow(order.paymentWindow)
  const paid = window?.state === 'PAID'
  const refunds = (experience?.refunds ?? []).map(refundView)
  const issued = (experience?.refunds ?? []).filter(r => r.status === 'SUCCEEDED' && !r.reviewRequired).reduce((sum, r) => sum + priceToPence(r.amount), 0)
  const total = priceToPence(order.financials?.totalAmount ?? order.totalAmount)
  const label = !paid ? 'Not paid' : issued > 0 && issued >= total ? 'Refunded' : issued > 0 ? 'Partially refunded' : 'Paid'
  return { paid, label, paidAt: paid ? order.payment?.paidAt ?? null : null, refunds }
}

// ---- Addresses ----
const addressFields = ['RecipientName', 'Line1', 'Line2', 'City', 'County', 'Postcode', 'CountryCode', 'Phone'] as const
export const sameAddresses = (order: OrderDetail) => addressFields.every(f => (order[`delivery${f}`] ?? null) === (order[`billing${f}`] ?? null))
