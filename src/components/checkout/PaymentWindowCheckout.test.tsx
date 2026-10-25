// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkout } from './Checkout'
import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
import { CheckoutApiError, type Order } from '../../features/checkout/api'
import { paymentActionLabel, paymentMessage, type PaymentWindow } from '../../features/checkout/paymentWindow'
const mocks = vi.hoisted(() => ({ read: vi.fn(), prepare: vi.fn(), recover: vi.fn(), create: vi.fn(), form: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1 } }, logout: vi.fn() }) }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), getOrder: mocks.read, createOrder: mocks.create, preparePayment: mocks.prepare, recoverPayment: mocks.recover }))
vi.mock('./StripePaymentForm', () => ({ StripePaymentForm: (props: { clientSecret: string }) => { mocks.form(props); return <p>Secure checkout</p> } }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const owned: Order = { id: 41, status: 'PENDING', totalAmount: '10.00', reservationExpiresAt: '2000-01-01T00:00:00Z', payment: { status: 'FAILED', paidAt: null }, billingRecipientName: 'Buyer', billingLine1: '1 Road', billingLine2: null, billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Buyer', deliveryLine1: '1 Road', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', orderItems: [] }
let root: Root
let container: HTMLDivElement
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<Checkout onAccount={vi.fn()} />)) }
async function click(text: string) { await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === text)!.click()) }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/checkout/orders/41'); mocks.prepare.mockResolvedValue('secret') })
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = '' })
const states: PaymentWindow['state'][] = ['INITIAL_PAYMENT', 'CHECKOUT_RESUMABLE', 'PROCESSING', 'OUTCOME_UNRESOLVED', 'RETRY_AVAILABLE', 'RETRY_REQUIRES_PROVIDER_CHECK', 'PAID', 'NOT_PAYABLE']
describe('payment window customer presentation', () => {
  it.each(states)('shows %s with accurate actions despite FAILED compatibility status and old reservation', async state => {
    const paymentWindow = windowFixture(state)
    mocks.read.mockResolvedValue({ ...owned, paymentWindow })
    await mount()
    expect(container.textContent).toContain(paymentMessage(paymentWindow))
    expect(container.textContent).not.toContain('Your reservation has expired')
    expect(container.textContent).not.toContain('Payment status: Failed')
    const action = [...container.querySelectorAll('button')].find(b => b.textContent === paymentActionLabel(paymentWindow))
    expect(!!action).toBe(['INITIAL_PAYMENT', 'CHECKOUT_RESUMABLE', 'RETRY_AVAILABLE', 'RETRY_REQUIRES_PROVIDER_CHECK'].includes(state))
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
    expect(container.textContent).not.toMatch(/PayPal/)
  })
  it('restores the existing Stripe form only after explicit authenticated reuse', async () => {
    mocks.read.mockResolvedValue({ ...owned, paymentWindow: windowFixture('CHECKOUT_RESUMABLE') })
    await mount(); expect(container.textContent).toContain('An existing Stripe checkout can be resumed'); await act(async () => root.render(<Checkout onAccount={vi.fn()} />))
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.form).not.toHaveBeenCalled()
    await click('Resume existing Stripe checkout')
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith('jwt', 41)
    expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'secret' }))
    expect(container.textContent).not.toContain('secret'); expect(location.href).not.toContain('secret')
    expect(sessionStorage.length).toBe(0)
  })
  it.each([undefined, null, { version: 99 }, { ...windowFixture(), paymentDeadline: 'invalid' }])('offers refresh only for unsupported payment information %j', async paymentWindow => {
    mocks.read.mockResolvedValue({ ...owned, paymentWindow })
    await mount()
    expect(container.textContent).toContain('Payment information is unavailable')
    expect(container.textContent).toContain('Check payment status')
    expect(container.textContent).not.toContain('Continue to secure payment')
    expect(container.textContent).not.toContain('Resume existing Stripe checkout')
    expect(mocks.form).not.toHaveBeenCalled()
  })
  it('does not present a conditional endpoint rejection as payment failure or guaranteed retry', async () => {
    mocks.read.mockResolvedValue({ ...owned, paymentWindow: windowFixture('RETRY_REQUIRES_PROVIDER_CHECK') })
    mocks.prepare.mockRejectedValue(new CheckoutApiError(409, 'ORDER_NOT_PAYABLE'))
    await mount(); await click('Check existing payment with Stripe')
    expect(container.textContent).toContain('A retry is not yet guaranteed')
    expect(container.textContent).toContain('Payment setup could not continue')
    expect([...container.querySelectorAll('button')].some(b => b.textContent === 'Check existing payment with Stripe')).toBe(false)
    expect(mocks.form).not.toHaveBeenCalled()
  })
  it.each(['PENDING', 'EXPIRED', 'CANCELLED', 'CONFIRMED'])('keeps verified PAID financial outcome separate from %s fulfilment', async status => {
    mocks.read.mockResolvedValue({ ...owned, status, paymentWindow: windowFixture('PAID') })
    await mount()
    expect(container.textContent).toContain('Payment has been recorded')
    expect(container.textContent?.includes('Thank you for your order')).toBe(status === 'CONFIRMED')
    expect(container.textContent).not.toContain('Continue to secure payment')
    expect(container.textContent).not.toContain('Your reservation has expired')
  })
})


it('keeps existing-order verification messaging separate from rejected new order creation', async () => {
  mocks.read.mockRejectedValue(new CheckoutApiError(403, 'EMAIL_VERIFICATION_REQUIRED'))
  await mount()
  expect(container.textContent).toContain('Your existing order is retained')
  expect(container.textContent).not.toContain('No order was created')
  expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
})

it('does not put the changing checked-at timestamp in a screen-reader live region', async () => {
  mocks.read.mockResolvedValue({ ...owned, paymentWindow: windowFixture('CHECKOUT_RESUMABLE') })
  await mount()
  const liveBefore = [...container.querySelectorAll('[role="status"]')].map(node => node.textContent)
  mocks.recover.mockResolvedValue({ ...owned, paymentWindow: windowFixture('CHECKOUT_RESUMABLE', { evaluatedAt: '2026-10-15T12:01:00Z' }) })
  await click('Check payment status')
  expect(mocks.recover).toHaveBeenCalledExactlyOnceWith('jwt',41)
  expect(container.textContent).toContain(new Date('2026-10-15T12:01:00Z').toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'}))
  expect([...container.querySelectorAll('[role="status"]')].map(node => node.textContent)).toEqual(liveBefore)
  expect([...container.querySelectorAll('[role="status"]')].some(node => node.textContent?.includes('Payment information checked'))).toBe(false)
})

it('describes a freshly initialized first payment as ready, without implying a previous checkout', async () => {
  mocks.read.mockResolvedValueOnce({ ...owned, paymentWindow: windowFixture('INITIAL_PAYMENT') })
    .mockResolvedValueOnce({ ...owned, paymentWindow: windowFixture('INITIAL_PAYMENT') })
    .mockResolvedValue({ ...owned, paymentWindow: windowFixture('CHECKOUT_RESUMABLE') })
  await mount()
  expect(container.textContent).toContain('Your order is ready for an initial payment')
  await click('Continue to secure payment')
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith('jwt', 41)
  expect(container.textContent).toContain('Secure Stripe checkout is ready')
  expect(container.textContent).not.toContain('An existing Stripe checkout can be resumed')
  expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'secret' }))
})

it.each(['PAYPAL','MANUAL'] as const)('keeps the status action read-only for %s',async provider=>{
 mocks.read.mockResolvedValue({...owned,paymentWindow:windowFixture('OUTCOME_UNRESOLVED',{provider})})
 await mount();await click('Check payment status')
 expect(mocks.read).toHaveBeenCalledTimes(2);expect(mocks.recover).not.toHaveBeenCalled();expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()
})
