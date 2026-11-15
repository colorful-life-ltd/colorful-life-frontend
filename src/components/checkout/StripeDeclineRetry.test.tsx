// @vitest-environment jsdom
// Regression: after a card decline the Pay now button disappeared and the customer had to use
// "Check payment status" before entering new card details. Production hook and PaymentForm, mocked API/SDK.
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkout } from './Checkout'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
import { CheckoutApiError, type Order } from '../../features/checkout/api'

const mocks = vi.hoisted(() => ({ read: vi.fn(), prepare: vi.fn(), recover: vi.fn(), create: vi.fn(), confirm: vi.fn(), retrieve: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1 } }, logout: vi.fn() }) }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), getOrder: mocks.read, preparePayment: mocks.prepare, recoverPayment: mocks.recover, createOrder: mocks.create }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn() }))
vi.mock('@stripe/react-stripe-js', () => {
  const stripe = { confirmPayment: mocks.confirm, retrievePaymentIntent: mocks.retrieve }
  return { useStripe: () => stripe, useElements: () => ({}), PaymentElement: () => <input aria-label="Card number" /> }
})
vi.mock('./StripePaymentForm', async original => {
  const actual = await original<typeof import('./StripePaymentForm')>()
  return { ...actual, StripePaymentForm: actual.PaymentForm }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const pending: Order = { id: 41, status: 'PENDING', totalAmount: '20.00', reservationExpiresAt: '2000-01-01T00:00:00Z', payment: { status: 'PROCESSING', paidAt: null }, paymentWindow: windowFixture('CHECKOUT_RESUMABLE'), billingRecipientName: 'Buyer', billingLine1: '1 Road', billingLine2: null, billingCity: 'London', billingPostcode: 'T1', billingCountryCode: 'GB', deliveryRecipientName: 'Buyer', deliveryLine1: '1 Road', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'T1', deliveryCountryCode: 'GB', orderItems: [] }
// After the verified decline the backend asks for a provider check; its retry deadline is fixed by the backend.
const declinedOrder: Order = { ...pending, payment: { status: 'FAILED', paidAt: null }, paymentWindow: windowFixture('RETRY_REQUIRES_PROVIDER_CHECK') }
const confirmed: Order = { ...pending, status: 'CONFIRMED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-15T12:00:00Z' }, paymentWindow: windowFixture('PAID') }
const decline = { error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' } }

let root: Root, container: HTMLDivElement, cart: CartContextValue
const button = (label: string) => [...container.querySelectorAll('button')].find(b => b.textContent === label)
async function click(label: string) { await act(async () => { const found = button(label); expect(found).toBeTruthy(); found!.click() }) }
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
async function openPayment() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} /></CartContext.Provider>))
  await click('Resume existing Stripe checkout')
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); history.replaceState(null, '', '/checkout/orders/41'); sessionStorage.clear(); localStorage.clear()
  mocks.read.mockResolvedValue(pending); mocks.prepare.mockResolvedValue('pi_secret_same'); mocks.retrieve.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } })
  cart = { items: [], isLoading: false, error: null, pendingItemIds: [], refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
})
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); document.body.innerHTML = '' })

describe('card decline, edit card, retry on the same checkout screen', () => {
  it('keeps the form and Pay now, re-admits through the backend and confirms the same intent again', async () => {
    mocks.confirm.mockResolvedValueOnce(decline).mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    await openPayment()
    const form = container.querySelector('form'); const card = container.querySelector('input')!
    await submit()
    expect(container.textContent).toContain('Your card was declined.'); expect(container.textContent).toContain('use a different card')
    expect(button('Pay now')?.disabled).toBe(false); expect(button('Check order status')).toBeUndefined()
    expect(container.querySelector('form')).toBe(form); expect(container.querySelector('input')).toBe(card)
    expect(mocks.prepare).toHaveBeenCalledOnce(); expect(mocks.recover).not.toHaveBeenCalled()

    // The customer edits the card and presses Pay now again; the backend now reports the verified decline.
    mocks.read.mockResolvedValue(declinedOrder)
    card.value = '4242424242424242'; await submit()
    expect(mocks.prepare).toHaveBeenCalledTimes(2); expect(mocks.prepare).toHaveBeenLastCalledWith('jwt', 41)
    // The retry confirmed the very form (and card element) the customer edited; success then moves to verification.
    expect(mocks.confirm).toHaveBeenCalledTimes(2); expect(container.textContent).toContain('verification is in progress')
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.recover).not.toHaveBeenCalled()

    mocks.read.mockResolvedValue(confirmed)
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(container.textContent).toContain('Thank you for your order'); expect(cart.refreshCart).toHaveBeenCalledOnce()
  })

  it('stays retryable after repeated declines, re-admitting every attempt', async () => {
    mocks.confirm.mockResolvedValue(decline)
    await openPayment(); await submit()
    mocks.read.mockResolvedValue(declinedOrder)
    await submit(); await submit()
    expect(mocks.prepare).toHaveBeenCalledTimes(3); expect(mocks.confirm).toHaveBeenCalledTimes(3)
    expect(button('Pay now')?.disabled).toBe(false); expect(container.textContent).toContain('Your card was declined.')
  })

  it('blocks double submission while a retry is being admitted and confirmed', async () => {
    mocks.confirm.mockResolvedValueOnce(decline)
    await openPayment(); await submit()
    mocks.read.mockResolvedValue(declinedOrder)
    let admit!: (secret: string) => void
    mocks.prepare.mockImplementationOnce(() => new Promise(resolve => { admit = resolve }))
    let finish!: (value: object) => void
    mocks.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await submit(); await submit()
    expect(mocks.prepare).toHaveBeenCalledTimes(2)
    expect(button('Processing payment…')?.disabled).toBe(true)
    await act(async () => admit('pi_secret_same')); await submit()
    expect(mocks.confirm).toHaveBeenCalledTimes(2); expect(mocks.prepare).toHaveBeenCalledTimes(2)
    await act(async () => finish({ paymentIntent: { status: 'succeeded' } }))
    expect(mocks.confirm).toHaveBeenCalledTimes(2)
  })

  it('never offers payment again once the retry deadline has closed the order', async () => {
    mocks.confirm.mockResolvedValueOnce(decline)
    await openPayment(); await submit()
    mocks.prepare.mockRejectedValueOnce(new CheckoutApiError(409, 'PAYMENT_WINDOW_CLOSED', 'This order is no longer payable.'))
    mocks.read.mockResolvedValue({ ...declinedOrder, status: 'EXPIRED', paymentWindow: windowFixture('NOT_PAYABLE') })
    await submit()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(button('Pay now')).toBeUndefined(); expect(container.querySelector('form')).toBeNull()
    expect(container.textContent).toContain('cannot currently accept a payment')
  })

  it('stops for a status check instead of confirming when the payment is processing or uncertain', async () => {
    mocks.confirm.mockResolvedValueOnce(decline)
    await openPayment(); await submit()
    mocks.read.mockResolvedValue({ ...pending, paymentWindow: windowFixture('PROCESSING') })
    await submit()
    expect(mocks.prepare).toHaveBeenCalledTimes(2); expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(button('Pay now')).toBeUndefined()
  })

  it('remounts a fresh form for a different intent and never confirms details entered against the old one', async () => {
    mocks.confirm.mockResolvedValueOnce(decline)
    await openPayment()
    const card = container.querySelector('input')!
    await submit()
    mocks.read.mockResolvedValue(declinedOrder); mocks.prepare.mockResolvedValueOnce('pi_secret_new')
    await submit()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(container.querySelector('input')).not.toBe(card); expect(button('Pay now')?.disabled).toBe(false)
  })

  it('keeps ambiguous outcomes on the status-check path without another admission', async () => {
    mocks.confirm.mockResolvedValueOnce({ error: { type: 'api_error', message: 'Something went wrong' } })
    await openPayment(); await submit()
    expect(button('Pay now')).toBeUndefined(); expect(button('Check order status')).toBeTruthy()
    expect(mocks.prepare).toHaveBeenCalledOnce()
  })
})
