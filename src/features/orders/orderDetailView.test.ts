import { describe, expect, it } from 'vitest'
import { windowFixture } from '../checkout/paymentWindowFixtures'
import type { OrderDetail } from './api'
import { parseCustomerExperience } from './experience'
import { orderOverview, paymentView, refundView, returnOverview, returnStatusLabel, sameAddresses } from './orderDetailView'

const ret = (id: number, status: string, quantity = 1) => ({ id, quantity, status, requestedAt: '2026-10-20T12:00:00Z' })
const withReturns = (...items: Array<Array<ReturnType<typeof ret>>>) => ({ orderItems: items.map((returns, i) => ({ id: i + 1, returns })) })
const refund = (status: 'SUCCEEDED' | 'PROCESSING' | 'FAILED', amount = '10.00', reviewRequired = false) => ({ id: 1, amount, currency: 'GBP', status, reviewRequired, createdAt: '2026-10-25T12:00:00Z' })
const base = {
  id: 41, status: 'DISPATCHED', totalAmount: '20.00', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', reservationExpiresAt: null,
  shippingCarrier: null, trackingNumber: null, dispatchedAt: '2026-10-03T12:00:00Z', completedAt: null, orderItems: [],
  payment: { status: 'SUCCEEDED', paidAt: '2026-10-02T12:00:00Z' }, paymentWindow: windowFixture('PAID'),
  billingRecipientName: 'A', billingLine1: '1 St', billingLine2: null, billingCity: 'L', billingCounty: null, billingPostcode: 'P', billingCountryCode: 'GB', billingPhone: null,
  deliveryRecipientName: 'A', deliveryLine1: '1 St', deliveryLine2: null, deliveryCity: 'L', deliveryCounty: null, deliveryPostcode: 'P', deliveryCountryCode: 'GB', deliveryPhone: null,
} as unknown as OrderDetail

describe('return status mapping', () => {
  it.each([
    ['REQUESTED', 'Return request sent'], ['AUTHORIZED', 'Return request approved'],
    ['RECEIVED', 'Return received'], ['INSPECTED', 'Return received'], ['COMPLETED', 'Return received'],
    ['REJECTED', 'Return request declined'], ['CANCELLED', 'Return request withdrawn'], ['FUTURE', 'Return status unavailable'],
  ])('maps backend %s to “%s”', (status, label) => expect(returnStatusLabel(status)).toBe(label))
  it('never uses refund language for a return state', () => {
    for (const s of ['REQUESTED', 'AUTHORIZED', 'RECEIVED', 'INSPECTED', 'COMPLETED', 'REJECTED', 'CANCELLED']) expect(returnStatusLabel(s)).not.toMatch(/refund/i)
  })
})

describe('return overview across partial and multiple requests', () => {
  it('has no return when no lines exist', () => expect(returnOverview(withReturns([], []))).toEqual({ kind: 'none' }))
  it('follows the least-advanced active line and flags mixed stages', () => {
    expect(returnOverview(withReturns([ret(1, 'RECEIVED')], [ret(2, 'AUTHORIZED', 2)]))).toEqual({ kind: 'progress', stage: 'approved', mixed: true, units: 3 })
  })
  it('ignores declined and withdrawn lines when another line is active', () => {
    expect(returnOverview(withReturns([ret(1, 'REJECTED'), ret(2, 'REQUESTED')], [ret(3, 'CANCELLED')]))).toEqual({ kind: 'progress', stage: 'sent', mixed: false, units: 1 })
  })
  it('treats internal inspection and completion as received', () => {
    expect(returnOverview(withReturns([ret(1, 'INSPECTED')], [ret(2, 'COMPLETED')]))).toMatchObject({ kind: 'progress', stage: 'received', mixed: false })
  })
  it('is closed when every line was declined or withdrawn', () => {
    expect(returnOverview(withReturns([ret(1, 'REJECTED')], [ret(2, 'CANCELLED')]))).toEqual({ kind: 'closed' })
  })
  it('fails closed on malformed return data', () => {
    expect(returnOverview(withReturns([ret(1, 'NOT_A_STATE')]))).toEqual({ kind: 'unavailable' })
  })
})

describe('order-level payment and refund presentation', () => {
  const view = (order: OrderDetail) => paymentView(order, parseCustomerExperience(order))
  it.each([
    [refund('SUCCEEDED'), 'Refund issued', 'ok'], [refund('PROCESSING'), 'Refund pending', 'pending'],
    [refund('FAILED'), 'Refund not completed', 'problem'], [refund('SUCCEEDED', '10.00', true), 'Refund under review', 'pending'],
  ])('labels refunds from backend status only (%#)', (input, label, tone) => expect(refundView(input)).toMatchObject({ label, tone, amount: '£10.00' }))
  it('summarises paid, partially refunded and refunded orders from confirmed refunds only', () => {
    expect(view(base).label).toBe('Paid')
    expect(view({ ...base, refunds: [refund('SUCCEEDED', '5.00')] } as OrderDetail).label).toBe('Partially refunded')
    expect(view({ ...base, refunds: [refund('SUCCEEDED', '20.00')] } as OrderDetail).label).toBe('Refunded')
    expect(view({ ...base, refunds: [refund('PROCESSING', '20.00'), refund('SUCCEEDED', '20.00', true)] } as OrderDetail).label).toBe('Paid')
  })
  it('does not claim payment without a PAID window', () => {
    expect(view({ ...base, paymentWindow: windowFixture('PROCESSING') } as OrderDetail)).toMatchObject({ paid: false, paidAt: null })
  })
})

describe('order progress stays independent of returns', () => {
  const overview = (patch: Partial<OrderDetail> & Record<string, unknown>) => { const o = { ...base, ...patch } as OrderDetail; return orderOverview(o, parseCustomerExperience(o)) }
  it('uses the backend fulfilment stage when present', () => {
    expect(overview({ fulfilment: { stage: 'IN_TRANSIT', preparingAt: null, shipments: [] } })).toMatchObject({ kind: 'steps', current: 2, title: 'In transit' })
    expect(overview({ status: 'CONFIRMED', fulfilment: { stage: 'PREPARING', preparingAt: '2026-10-02T12:00:00Z', shipments: [] } })).toMatchObject({ current: 1, title: 'Preparing' })
  })
  it('does not invent delivery for a completed order without a delivered stage', () => {
    expect(overview({ status: 'COMPLETED' })).toMatchObject({ steps: ['Confirmed', 'Preparing', 'Dispatched', 'Completed'], title: 'Completed' })
  })
  it.each([['EXPIRED', 'Order expired'], ['CANCELLED', 'Order cancelled'], ['FUTURE', 'Status unavailable']])('shows %s as a message', (status, title) => {
    expect(overview({ status })).toMatchObject({ kind: 'message', title })
  })
  it('does not say “Awaiting payment” once the payment window reports PAID', () => {
    expect(overview({ status: 'PENDING' })).toMatchObject({ title: 'Confirming your order' })
    expect(overview({ status: 'PENDING', paymentWindow: windowFixture('INITIAL_PAYMENT') })).toMatchObject({ title: 'Awaiting payment' })
  })
  it('reports a pending cancellation without claiming it is cancelled', () => {
    expect(overview({ status: 'CONFIRMED', cancellation: { state: 'REQUESTED', cancelledAt: null } })).toMatchObject({ title: 'Cancellation requested', detail: expect.stringContaining('not cancelled yet') })
  })
})

it('groups identical delivery and billing addresses', () => {
  expect(sameAddresses(base)).toBe(true)
  expect(sameAddresses({ ...base, billingLine1: '2 St' })).toBe(false)
})
