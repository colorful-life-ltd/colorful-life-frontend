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

// ---- Customer progress: one card, either the purchase journey or a full-order return journey ----
export type StepState = 'done' | 'current' | 'problem' | 'upcoming'
export type ProgressStep = { label: string; state: StepState }
export type RefundProgress = { state: 'none' | 'pending' | 'checking' | 'failed' | 'issued'; amount: string | null }
export type ProgressView =
  | { kind: 'message'; title: string; detail?: string }
  | { kind: 'journey'; journey: 'order' | 'return'; title: string; steps: ProgressStep[]; detail?: string; refund?: RefundProgress['state']; mixed?: boolean; partialReturn?: { approved: boolean } }

/** Marks the first not-done step as current, keeping explicit current/problem states. */
function sequence(steps: Array<{ label: string; done: boolean; state?: StepState }>): ProgressStep[] {
  let currentSet = steps.some(s => s.state === 'current' || s.state === 'problem')
  return steps.map(s => {
    if (s.state) return { label: s.label, state: s.state }
    if (s.done) return { label: s.label, state: 'done' }
    if (!currentSet) { currentSet = true; return { label: s.label, state: 'current' } }
    return { label: s.label, state: 'upcoming' }
  })
}

/** Messages for orders without a purchase journey; null means the journey applies. */
function orderMessage(order: OrderDetail, experience: CustomerExperience | null): Extract<ProgressView, { kind: 'message' }> | null {
  if (experience?.cancellation?.state === 'CANCELLED' || order.status === 'CANCELLED') return { kind: 'message', title: 'Order cancelled' }
  if (experience?.cancellation?.state === 'REQUESTED') return { kind: 'message', title: 'Cancellation requested', detail: 'We are reviewing your request. Your order is not cancelled yet.' }
  if (order.status === 'PENDING') return parsePaymentWindow(order.paymentWindow)?.state === 'PAID'
    ? { kind: 'message', title: 'Confirming your order', detail: 'Your payment has been recorded and the order is being confirmed.' }
    : { kind: 'message', title: 'Awaiting payment' }
  if (order.status === 'EXPIRED') return { kind: 'message', title: 'Order expired', detail: 'This order was not paid in time and has not been placed.' }
  if (order.status === 'RETURNED') return { kind: 'message', title: 'Order returned' }
  if (!['CONFIRMED', 'DISPATCHED', 'COMPLETED'].includes(order.status)) return { kind: 'message', title: 'Status unavailable', detail: 'Refresh the order for its latest status.' }
  return null
}

/** Order placed → Dispatched → Delivered. Delivered needs the backend DELIVERED stage; an admin-completed
 *  order without it ends at "Completed" rather than claiming delivery. */
export function orderJourney(order: OrderDetail, experience: CustomerExperience | null): ProgressView {
  const message = orderMessage(order, experience)
  if (message) return message
  const stage = experience?.fulfilment?.stage ?? null
  const delivered = stage === 'DELIVERED'
  const dispatched = delivered || stage === 'DISPATCHED' || stage === 'IN_TRANSIT' || ['DISPATCHED', 'COMPLETED'].includes(order.status) || !!order.dispatchedAt
  const completedOnly = order.status === 'COMPLETED' && !delivered
  const title = delivered ? 'Delivered' : completedOnly ? 'Completed' : stage === 'IN_TRANSIT' ? 'In transit' : dispatched ? 'Dispatched' : stage === 'PREPARING' ? 'Preparing your order' : 'Order placed'
  return { kind: 'journey', journey: 'order', title, steps: sequence([
    { label: 'Order placed', done: true },
    { label: 'Dispatched', done: dispatched },
    { label: completedOnly ? 'Completed' : 'Delivered', done: delivered || completedOnly },
  ]) }
}

/** Order-level refunds created since the return began. A refund is only "issued" once a confirmed Stripe success
 *  is recorded and nothing else is still pending or under review. */
export function refundProgress(experience: CustomerExperience | null, since: string): RefundProgress {
  const start = Date.parse(since)
  const refunds = (experience?.refunds ?? []).filter(r => Date.parse(r.createdAt) >= start)
  if (refunds.some(r => r.reviewRequired)) return { state: 'checking', amount: null }
  if (refunds.some(r => r.status === 'PROCESSING')) return { state: 'pending', amount: null }
  const issued = refunds.filter(r => r.status === 'SUCCEEDED').reduce((sum, r) => sum + priceToPence(r.amount), 0)
  if (issued > 0) return { state: 'issued', amount: formatGbp(issued) }
  if (refunds.some(r => r.status === 'FAILED')) return { state: 'failed', amount: null }
  return { state: 'none', amount: null }
}

const returnText: Record<'sent' | 'approved', string> = {
  sent: 'We’re reviewing your request. Please don’t post anything until it’s approved.',
  approved: 'Your return instructions are in the Returns section below.',
}
const refundText: Record<RefundProgress['state'], (amount: string | null) => string> = {
  none: () => 'Your refund hasn’t been issued yet. We’ll update this page once it has.',
  pending: () => 'Your refund has been started but isn’t confirmed yet. We’ll update this page once it is.',
  checking: () => 'We’re checking the status of your refund.',
  failed: () => 'Your refund couldn’t be completed. We’ll be in touch, or you can contact us.',
  issued: amount => `${amount} has been refunded to your original payment method. Your bank may take a few working days to show it.`,
}
const refundTitle: Record<Exclude<RefundProgress['state'], 'none'>, string> = { pending: 'Refund in progress', checking: 'Refund being checked', failed: 'Refund not completed', issued: 'Refund issued' }

/**
 * The single progress card. A full-order return (every unit on an active return line) shows
 * Return requested → Return approved → Return received → Refund issued; the order-level refund only
 * counts there because the whole order is being returned. A partial return keeps the purchase journey
 * and points to the affected items; it never shows a refund step.
 */
export function progressView(order: OrderDetail, experience: CustomerExperience | null): ProgressView {
  const byItem = itemReturns(order)
  const onPath = byItem ? [...byItem.values()].flat().filter(l => (RETURN_STEPS as readonly string[]).includes(l.stage)) : []
  if (!onPath.length || orderMessage(order, experience)) return orderJourney(order, experience)
  const covered = order.orderItems.every(item => (byItem!.get(item.id) ?? []).filter(l => (RETURN_STEPS as readonly string[]).includes(l.stage)).reduce((n, l) => n + l.quantity, 0) >= item.quantity)
  if (!covered) {
    const journey = orderJourney(order, experience) as Extract<ProgressView, { kind: 'journey' }>
    return { ...journey, partialReturn: { approved: onPath.some(l => l.stage === 'approved') } }
  }
  const indexes = onPath.map(l => RETURN_STEPS.indexOf(l.stage as (typeof RETURN_STEPS)[number]))
  const lowest = Math.min(...indexes)
  const lines = (order.orderItems as Array<{ returns?: Array<{ status: string; requestedAt: string }> }>).flatMap(i => i.returns ?? []).filter(r => (RETURN_STEPS as readonly string[]).includes(returnStage(r.status) ?? ''))
  const since = lines.map(r => r.requestedAt).sort()[0]
  const refund = refundProgress(experience, since)
  const refundState: StepState | undefined = refund.state === 'issued' ? 'done' : refund.state === 'failed' ? 'problem' : refund.state === 'none' ? undefined : 'current'
  const steps = sequence([
    { label: 'Return requested', done: true },
    { label: 'Return approved', done: lowest >= 1 },
    { label: 'Return received', done: lowest >= 2 },
    { label: 'Refund issued', done: false, ...(refundState ? { state: refundState } : {}) },
  ])
  const title = refund.state !== 'none' ? refundTitle[refund.state] : returnStageLabels[RETURN_STEPS[lowest]]
  const detail = refund.state !== 'none' || lowest === 2 ? refundText[refund.state](refund.amount) : returnText[RETURN_STEPS[lowest] as 'sent' | 'approved']
  return { kind: 'journey', journey: 'return', title, steps, detail, refund: refund.state, mixed: new Set(indexes).size > 1 }
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
