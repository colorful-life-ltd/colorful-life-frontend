// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
import type { OrderDetail } from '../../features/orders/api'
import { OrderDetails } from './OrderDetails'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const item = (id: number, title: string, returns: unknown[] = []) => ({ id, quantity: 2, unitPrice: '10.00', lineTotal: '20.00', conditionSnapshot: 'NEW', productListing: { id: 900 + id, legoProduct: { title, setNumber: `${id}00` } }, returns })
const line = (id: number, status: string, extra: Record<string, unknown> = {}) => ({ id, quantity: 1, status, requestedAt: '2026-10-20T12:00:00Z', authorizedAt: null, receivedAt: null, completedAt: null, ...extra })
const order = (patch: Record<string, unknown> = {}) => ({
  id: 41, status: 'DISPATCHED', totalAmount: '40.00', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', reservationExpiresAt: null,
  shippingCarrier: null, trackingNumber: null, dispatchedAt: '2026-10-03T12:00:00Z', completedAt: null,
  payment: { status: 'SUCCEEDED', paidAt: '2026-10-02T12:00:00Z' }, paymentWindow: windowFixture('PAID'),
  financials: { currency: 'GBP', merchandiseSubtotal: '40.00', shipping: { code: 'STANDARD', method: 'Standard Delivery', chargePence: 0, minWorkingDays: 2, maxWorkingDays: 4, estimatesFrom: 'DISPATCH' }, totalAmount: '40.00' },
  fulfilment: { stage: 'DISPATCHED', preparingAt: null, shipments: [{ sequence: 1, carrierName: 'Royal Mail', trackingNumber: 'RM123', trackingUrl: 'https://track.example/RM123', dispatchedAt: '2026-10-03T12:00:00Z' }] },
  cancellation: { state: 'NONE', cancelledAt: null }, refunds: [],
  orderItems: [item(1, 'Flowers'), item(2, 'Tree House')],
  billingRecipientName: 'Ada', billingLine1: '1 Street', billingLine2: null, billingCity: 'London', billingCounty: null, billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', billingPhone: null,
  deliveryRecipientName: 'Ada', deliveryLine1: '1 Street', deliveryLine2: null, deliveryCity: 'London', deliveryCounty: null, deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', deliveryPhone: null,
  ...patch,
}) as unknown as OrderDetail

let root: Root, host: HTMLDivElement
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = (value: OrderDetail) => act(async () => root.render(<OrderDetails order={value} checking={false} feedback="" onCheckPayment={() => {}} returns={null} />))
const text = () => host.textContent ?? ''
const statusCard = () => host.querySelector('.order-status')!

it('shows a paid order concisely, without payment-window diagnostics', async () => {
  await render(order())
  expect(statusCard().textContent).toContain('Dispatched')
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Dispatched')
  expect(text()).toContain('PaymentPaid')
  for (const hidden of ['Payment window deadline', 'Payment information checked', 'These times are informational', 'Payment has been recorded', 'PayPal']) expect(text()).not.toContain(hidden)
  expect(text()).toContain('Royal Mail · Tracking RM123')
  expect(host.querySelector('a[href="https://track.example/RM123"]')?.textContent).toBe('Track parcel')
  expect(text()).toContain('Delivery and billing address')
  expect(text()).not.toMatch(/contact (us|support) to (arrange|request) a return/i)
})

it('keeps actionable payment instructions for an unpaid order', async () => {
  await render(order({ status: 'PENDING', payment: null, dispatchedAt: null, fulfilment: { stage: null, preparingAt: null, shipments: [] }, paymentWindow: windowFixture('INITIAL_PAYMENT') }))
  expect(statusCard().textContent).toContain('Awaiting payment')
  expect(text()).toContain('Payment window deadline')
  expect([...host.querySelectorAll('button')].map(b => b.textContent)).toContain('Continue to secure payment')
  expect(text()).not.toContain('PaymentPaid')
})

it('makes an active return dominant while preserving independent order state and per-item states', async () => {
  await render(order({ orderItems: [item(1, 'Flowers', [line(10, 'RECEIVED', { receivedAt: '2026-10-25T12:00:00Z' })]), item(2, 'Tree House', [line(11, 'AUTHORIZED'), line(12, 'REJECTED')])] }))
  const card = statusCard()
  expect(card.classList.contains('order-status--return')).toBe(true)
  expect(card.querySelector('h2')?.textContent).toBe('Return request approved')
  expect(card.textContent).toContain('different stages')
  expect(card.textContent).toContain('Order status: Dispatched')
  const items = [...host.querySelectorAll('.order-detail__items > li')]
  expect(items[0].textContent).toContain('Return received')
  expect(items[1].textContent).toContain('Return request approved')
  expect(items[1].textContent).toContain('Return request declined')
})

it('keeps order-level refunds in Payment and never attributes them to a return', async () => {
  await render(order({
    orderItems: [item(1, 'Flowers', [line(10, 'COMPLETED', { receivedAt: '2026-10-25T12:00:00Z', completedAt: '2026-10-26T12:00:00Z', inspectionNote: 'PRIVATE' })]), item(2, 'Tree House')],
    refunds: [
      { id: 1, amount: '20.00', currency: 'GBP', status: 'SUCCEEDED', reviewRequired: false, createdAt: '2026-10-27T12:00:00Z', reason: 'PRIVATE' },
      { id: 2, amount: '5.00', currency: 'GBP', status: 'PROCESSING', reviewRequired: false, createdAt: '2026-10-28T12:00:00Z' },
      { id: 3, amount: '1.00', currency: 'GBP', status: 'FAILED', reviewRequired: false, createdAt: '2026-10-28T12:00:00Z' },
    ],
  }))
  expect(statusCard().textContent).not.toMatch(/refund issued|refunded/i)
  expect(host.querySelector('.order-detail__items')!.textContent).not.toMatch(/refund/i)
  const refunds = host.querySelector('[aria-label="Refunds"]')!.textContent
  expect(refunds).toContain('Refund issued£20.00')
  expect(refunds).toContain('Refund pending£5.00')
  expect(refunds).toContain('Refund not completed£1.00')
  expect(text()).toContain('Partially refunded')
  expect(text()).toContain('Your bank may take a few working days')
  expect(text()).not.toContain('PRIVATE')
})

it('shows the normal order progress when every return was declined or withdrawn', async () => {
  await render(order({ status: 'COMPLETED', orderItems: [item(1, 'Flowers', [line(10, 'REJECTED'), line(11, 'CANCELLED')])] }))
  expect(statusCard().classList.contains('order-status--return')).toBe(false)
  expect(statusCard().textContent).toContain('Completed')
  expect(text()).toContain('Return request declined')
  expect(text()).toContain('Return request withdrawn')
})

it('fails closed on malformed return data without hiding the order', async () => {
  await render(order({ orderItems: [item(1, 'Flowers', [line(10, 'SOMETHING_NEW')])] }))
  expect(text()).toContain('Return information is unavailable')
  expect(text()).not.toMatch(/Return (request|received)/)
  expect(text()).toContain('Flowers')
})

it('shows separate addresses and a pre-dispatch cancellation route only when relevant', async () => {
  await render(order({ status: 'CONFIRMED', dispatchedAt: null, fulfilment: { stage: 'CONFIRMED', preparingAt: null, shipments: [] }, billingLine1: '9 Other Road' }))
  expect(text()).toContain('Delivery address'); expect(text()).toContain('Billing address')
  expect(text()).toContain('Cancel before dispatch')
  expect(statusCard().textContent).toContain('Order confirmed')
})
