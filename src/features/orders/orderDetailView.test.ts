import { describe, expect, it } from 'vitest'
import { windowFixture } from '../checkout/paymentWindowFixtures'
import type { OrderDetail } from './api'
import { parseCustomerExperience } from './experience'
import { orderJourney, paymentView, progressView, refundView, returnOverview, returnStatusLabel, sameAddresses, type ProgressView } from './orderDetailView'

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

const view = (patch: Record<string, unknown>) => { const o = { ...base, ...patch } as OrderDetail; return progressView(o, parseCustomerExperience(o)) }
const states = (v: ProgressView) => v.kind === 'journey' ? v.steps.map(s => `${s.label}:${s.state}`) : []
const item = (id: number, quantity: number, returns: unknown[] = []) => ({ id, quantity, unitPrice: '10.00', lineTotal: '10.00', conditionSnapshot: 'NEW', productListing: { id, legoProduct: { id, title: `Set ${id}`, setNumber: `${id}` } }, returns })
const line = (id: number, status: string, quantity = 1, requestedAt = '2026-10-20T12:00:00Z') => ({ id, quantity, status, requestedAt })
const fullReturn = (status: string, refunds: unknown[] = []) => view({ orderItems: [item(1, 1, [line(10, status)]), item(2, 2, [line(11, status, 2)])], refunds })

describe('purchase journey: Order placed → Dispatched → Delivered', () => {
  const journey = (patch: Record<string, unknown>) => { const o = { ...base, ...patch } as OrderDetail; return orderJourney(o, parseCustomerExperience(o)) }
  it('marks only what the backend reports', () => {
    expect(states(journey({ status: 'CONFIRMED', dispatchedAt: null }))).toEqual(['Order placed:done', 'Dispatched:current', 'Delivered:upcoming'])
    expect(journey({ status: 'CONFIRMED', dispatchedAt: null, fulfilment: { stage: 'PREPARING', preparingAt: '2026-10-02T12:00:00Z', shipments: [] } }).title).toBe('Preparing your order')
    expect(states(journey({}))).toEqual(['Order placed:done', 'Dispatched:done', 'Delivered:current'])
    expect(journey({ fulfilment: { stage: 'IN_TRANSIT', preparingAt: null, shipments: [] } }).title).toBe('In transit')
    expect(states(journey({ fulfilment: { stage: 'DELIVERED', preparingAt: null, shipments: [] } }))).toEqual(['Order placed:done', 'Dispatched:done', 'Delivered:done'])
  })
  it('never invents delivery: a completed order without a delivered stage ends at “Completed”', () => {
    const v = journey({ status: 'COMPLETED' })
    expect(states(v)).toEqual(['Order placed:done', 'Dispatched:done', 'Completed:done'])
    expect(v.title).toBe('Completed')
  })
  it.each([['EXPIRED', 'Order expired'], ['CANCELLED', 'Order cancelled'], ['FUTURE', 'Status unavailable']])('shows %s as a message', (status, title) => {
    expect(journey({ status })).toMatchObject({ kind: 'message', title })
  })
  it('does not say “Awaiting payment” once the payment window reports PAID', () => {
    expect(journey({ status: 'PENDING' })).toMatchObject({ title: 'Confirming your order' })
    expect(journey({ status: 'PENDING', paymentWindow: windowFixture('INITIAL_PAYMENT') })).toMatchObject({ title: 'Awaiting payment' })
  })
  it('reports a pending cancellation without claiming it is cancelled', () => {
    expect(journey({ status: 'CONFIRMED', cancellation: { state: 'REQUESTED', cancelledAt: null } })).toMatchObject({ title: 'Cancellation requested', detail: expect.stringContaining('not cancelled yet') })
  })
})

describe('full-order return journey: Return requested → approved → received → Refund issued', () => {
  it('shows an active return with the refund step still ahead', () => {
    const v = fullReturn('AUTHORIZED')
    expect(v).toMatchObject({ journey: 'return', title: 'Return request approved', refund: 'none' })
    expect(states(v)).toEqual(['Return requested:done', 'Return approved:done', 'Return received:current', 'Refund issued:upcoming'])
  })
  it('order #11: received with no refund yet leaves the refund step incomplete', () => {
    const v = fullReturn('COMPLETED')
    expect(states(v)).toEqual(['Return requested:done', 'Return approved:done', 'Return received:done', 'Refund issued:current'])
    expect(v).toMatchObject({ title: 'Return received', detail: expect.stringContaining('hasn’t been issued yet') })
  })
  it('completes the refund step only for a confirmed Stripe success', () => {
    const v = fullReturn('COMPLETED', [refund('SUCCEEDED', '23.98')])
    expect(states(v).at(-1)).toBe('Refund issued:done')
    expect(v).toMatchObject({ title: 'Refund issued', detail: expect.stringContaining('£23.98 has been refunded to your original payment method') })
    expect((v as { detail: string }).detail).toContain('bank may take a few working days')
  })
  it.each([
    [[refund('PROCESSING')], 'Refund in progress', 'Refund issued:current'],
    [[refund('SUCCEEDED', '23.98', true)], 'Refund being checked', 'Refund issued:current'],
    [[refund('SUCCEEDED', '10.00'), refund('PROCESSING', '13.98')], 'Refund in progress', 'Refund issued:current'],
    [[refund('FAILED')], 'Refund not completed', 'Refund issued:problem'],
  ])('reports pending, uncertain and failed refunds without claiming success (%#)', (refunds, title, last) => {
    const v = fullReturn('COMPLETED', refunds)
    expect(v.title).toBe(title)
    expect(states(v).at(-1)).toBe(last)
  })
  describe('the Stripe-confirmed refunded amount is authoritative', () => {
    const detail = (v: ProgressView) => (v as { detail: string }).detail
    it('counts a partial refund as issued and shows its exact amount without implying a full refund', () => {
      const v = fullReturn('COMPLETED', [refund('SUCCEEDED', '10.00')]) // order total £20.00
      expect(states(v).at(-1)).toBe('Refund issued:done')
      expect(detail(v)).toBe('£10.00 has been refunded to your original payment method. Your bank may take a few working days to show it.')
      expect(detail(v)).not.toMatch(/full|entire|£20\.00|outstanding|remaining/i)
    })
    it('sums several confirmed refunds', () => {
      const v = fullReturn('COMPLETED', [{ ...refund('SUCCEEDED', '10.00'), id: 1 }, { ...refund('SUCCEEDED', '3.99'), id: 2 }])
      expect(detail(v)).toContain('£13.99 has been refunded')
    })
    it('keeps the step open while a further refund is pending, reporting only the confirmed total', () => {
      const v = fullReturn('COMPLETED', [{ ...refund('SUCCEEDED', '10.00'), id: 1 }, { ...refund('PROCESSING', '13.98'), id: 2 }])
      expect(v).toMatchObject({ title: 'Refund in progress', refund: 'pending' })
      expect(states(v).at(-1)).toBe('Refund issued:current')
      expect(detail(v)).toBe('£10.00 has been refunded so far. A further refund has been started but isn’t confirmed yet.')
    })
    it('keeps the step open while a refund is under review, never counting the reviewed amount', () => {
      const v = fullReturn('COMPLETED', [{ ...refund('SUCCEEDED', '10.00'), id: 1 }, { ...refund('SUCCEEDED', '13.98', true), id: 2 }])
      expect(v).toMatchObject({ title: 'Refund being checked', refund: 'checking' })
      expect(detail(v)).toBe('£10.00 has been refunded so far. We’re checking the status of a further refund.')
    })
    it('never shows pending, unknown or failed amounts as refunded', () => {
      for (const refunds of [[refund('PROCESSING', '23.98')], [refund('SUCCEEDED', '23.98', true)], [refund('FAILED', '23.98')]]) {
        const v = fullReturn('COMPLETED', refunds)
        expect(states(v).at(-1)).not.toBe('Refund issued:done')
        expect(detail(v)).not.toMatch(/has been refunded/)
      }
    })
    it('reports only the confirmed amount when another attempt failed', () => {
      const v = fullReturn('COMPLETED', [{ ...refund('FAILED', '23.98'), id: 1 }, { ...refund('SUCCEEDED', '10.00'), id: 2 }])
      expect(states(v).at(-1)).toBe('Refund issued:done')
      expect(detail(v)).toContain('£10.00 has been refunded')
    })
  })
  it('ignores refunds recorded before the return was requested', () => {
    expect(fullReturn('COMPLETED', [{ ...refund('SUCCEEDED', '5.00'), createdAt: '2026-10-10T12:00:00Z' }])).toMatchObject({ refund: 'none', title: 'Return received' })
  })
  it('follows the least-advanced line across several requests', () => {
    const v = view({ orderItems: [item(1, 1, [line(10, 'RECEIVED')]), item(2, 1, [line(11, 'REQUESTED')])] })
    expect(v).toMatchObject({ title: 'Return request sent', mixed: true })
  })
})

describe('partial returns keep the purchase journey', () => {
  it('never shows a refund step or attributes an order refund to a line', () => {
    const v = view({ orderItems: [item(1, 2, [line(10, 'COMPLETED')]), item(2, 1)], refunds: [refund('SUCCEEDED', '10.00')] })
    expect(v).toMatchObject({ journey: 'order', title: 'Dispatched', partialReturn: { approved: false } })
    expect(states(v).join()).not.toMatch(/Refund|Return/)
  })
  it('treats declined or withdrawn lines as not returning those units', () => {
    expect(view({ orderItems: [item(1, 1, [line(10, 'RECEIVED')]), item(2, 1, [line(11, 'REJECTED')])] })).toMatchObject({ journey: 'order', partialReturn: { approved: false } })
    expect(view({ orderItems: [item(1, 1, [line(10, 'CANCELLED')])] })).toMatchObject({ journey: 'order' })
    expect((view({ orderItems: [item(1, 1, [line(10, 'CANCELLED')])] }) as { partialReturn?: unknown }).partialReturn).toBeUndefined()
  })
})

it('groups identical delivery and billing addresses', () => {
  expect(sameAddresses(base)).toBe(true)
  expect(sameAddresses({ ...base, billingLine1: '2 St' })).toBe(false)
})
