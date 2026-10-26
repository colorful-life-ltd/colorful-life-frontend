// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkout } from './Checkout'
import {useCheckout} from '../../features/checkout/useCheckout'
import {useConfirmedCartRefresh} from '../../features/cart/useConfirmedCartRefresh'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
import type { Order } from '../../features/checkout/api'

const mocks = vi.hoisted(() => ({ read: vi.fn(), prepare: vi.fn(), recover: vi.fn(), create: vi.fn(), confirm: vi.fn(), retrieve: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1 } }, logout: vi.fn() }) }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), getOrder: mocks.read, preparePayment: mocks.prepare, recoverPayment: mocks.recover, createOrder: mocks.create }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn() }))
vi.mock('@stripe/react-stripe-js', () => {
  const stripe = { confirmPayment: mocks.confirm, retrievePaymentIntent: mocks.retrieve }
  return { useStripe: () => stripe, useElements: () => ({}), PaymentElement: () => <input aria-label="Card number" /> }
})
// Exercise the production PaymentForm and hook without loading external Stripe.js.
vi.mock('./StripePaymentForm', async original => {
  const actual = await original<typeof import('./StripePaymentForm')>()
  return { ...actual, StripePaymentForm: actual.PaymentForm }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const pending: Order = { id: 41, status: 'PENDING', totalAmount: '20.00', reservationExpiresAt: '2000-01-01T00:00:00Z', payment: { status: 'PROCESSING', paidAt: null }, paymentWindow: windowFixture('CHECKOUT_RESUMABLE'), billingRecipientName: 'Buyer', billingLine1: '1 Road', billingLine2: null, billingCity: 'London', billingPostcode: 'T1', billingCountryCode: 'GB', deliveryRecipientName: 'Buyer', deliveryLine1: '1 Road', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'T1', deliveryCountryCode: 'GB', orderItems: [] }
const paid = { ...pending, payment: { status: 'SUCCEEDED', paidAt: '2026-10-15T12:00:00Z' }, paymentWindow: windowFixture('PAID') }
const confirmed = { ...paid, status: 'CONFIRMED' }
let root: Root, container: HTMLDivElement, cart: CartContextValue
async function mount(strict = false) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const checkout = <CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} /></CartContext.Provider>
  await act(async () => root.render(strict ? <StrictMode>{checkout}</StrictMode> : checkout))
}
const button = (label: string) => [...container.querySelectorAll('button')].find(b => b.textContent === label)
async function click(label: string) { await act(async () => { const found = button(label); expect(found).toBeTruthy(); found!.click() }) }
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); history.replaceState(null, '', '/checkout/orders/41'); sessionStorage.clear(); localStorage.clear()
  mocks.read.mockResolvedValue(pending); mocks.recover.mockResolvedValue(pending); mocks.prepare.mockResolvedValue('transient-secret'); mocks.retrieve.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } }); mocks.confirm.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
  cart = { items: [], isLoading: false, error: null, pendingItemIds: [], refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
})
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); document.body.innerHTML = '' })

describe('post-payment read-only verification', () => {
  it('continues through multiple resumable GETs after Stripe success, without offering Resume', async () => {
    await mount(); await click('Resume existing Stripe checkout'); await submit()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('verification is in progress'); expect(button('Resume existing Stripe checkout')).toBeUndefined()
    expect(container.textContent).not.toContain('An existing Stripe checkout can be resumed')
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(mocks.read).toHaveBeenCalledTimes(7) // entry, pre/post setup, pre-confirm, three verification reads
    expect(cart.refreshCart).not.toHaveBeenCalled(); expect(button('Resume existing Stripe checkout')).toBeUndefined()
    mocks.read.mockResolvedValue(confirmed)
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(container.textContent).toContain('Thank you for your order'); expect(cart.refreshCart).toHaveBeenCalledOnce()
    expect(mocks.prepare).toHaveBeenCalledOnce(); expect(mocks.recover).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0); expect(location.href).not.toContain('secret')
  })
  it('automatically verifies a realistic Stripe redirect, including StrictMode, without manual verify or mutations', async () => {
    history.replaceState(null, '', '/checkout/orders/41?payment_intent=pi_mock_return&payment_intent_client_secret=pi_mock_return_secret_private&redirect_status=succeeded&source=bank')
    await mount(true)
    expect(location.search).toBe('?source=bank'); expect(JSON.stringify(history.state)).not.toContain('secret')
    expect(mocks.read).toHaveBeenCalledTimes(2); expect(button('Resume existing Stripe checkout')).toBeUndefined()
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(mocks.read).toHaveBeenCalledTimes(4) // one entry + one bounded polling loop
    mocks.read.mockResolvedValue(confirmed)
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(container.textContent).toContain('Thank you for your order'); expect(cart.refreshCart).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.recover).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
    expect(history.state).toBeNull(); expect(sessionStorage.length).toBe(0)
  })
  it('times out after bounded reads without claiming failure or advertising another payment, even after Refresh', async () => {
    await mount(); await click('Resume existing Stripe checkout'); await submit()
    await act(async () => vi.advanceTimersByTimeAsync(29000))
    expect(container.textContent).toContain('taking longer than expected'); expect(container.textContent).toContain('does not mean payment failed')
    expect(button('Resume existing Stripe checkout')).toBeUndefined(); expect(mocks.read).toHaveBeenCalledTimes(11)
    await act(async () => vi.advanceTimersByTimeAsync(90000))
    expect(mocks.read).toHaveBeenCalledTimes(11)
    await click('Check payment status')
    expect(button('Resume existing Stripe checkout')).toBeUndefined(); expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(mocks.recover).toHaveBeenCalledExactlyOnceWith('jwt',41); expect(mocks.create).not.toHaveBeenCalled()
  })
  it('keeps payment received while fulfilment is pending, then refreshes cart once after CONFIRMED', async () => {
    mocks.read.mockResolvedValue(paid)
    await mount()
    expect(container.textContent).toContain('Payment has been recorded'); expect(cart.refreshCart).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    expect(cart.refreshCart).not.toHaveBeenCalled(); expect(button('Resume existing Stripe checkout')).toBeUndefined()
    mocks.read.mockResolvedValue(confirmed)
    await act(async () => vi.advanceTimersByTimeAsync(2000))
    expect(container.textContent).toContain('Payment confirmed'); expect(cart.refreshCart).toHaveBeenCalledOnce()
    expect(button('Check payment status')).toBeUndefined(); expect(cart.refreshCart).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.recover).not.toHaveBeenCalled()
  })
  it('reports recorded payment and pending order confirmation at timeout, retaining PAID over later stale responses', async () => {
    mocks.read.mockResolvedValue(paid); await mount()
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    mocks.read.mockResolvedValue(pending)
    await act(async () => vi.advanceTimersByTimeAsync(28000))
    expect(container.textContent).toContain('Payment was recorded, but order confirmation is still pending')
    expect(container.textContent).toContain('Payment has been recorded'); expect(cart.refreshCart).not.toHaveBeenCalled()
    expect(button('Resume existing Stripe checkout')).toBeUndefined(); expect(mocks.prepare).not.toHaveBeenCalled()
  })
})

describe('Stripe submission lifecycle', () => {
  it('keeps the same form usable after correcting validation_error, without another initiation', async () => {
    mocks.confirm.mockResolvedValueOnce({ error: { type: 'validation_error', code: 'incomplete_number' } }).mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    await mount(); await click('Resume existing Stripe checkout')
    const form = container.querySelector('form'); const input = container.querySelector('input')!
    input.value = '4242'; await submit()
    expect(container.textContent).toContain('Please complete or correct'); expect(button('Pay now')?.disabled).toBe(false)
    expect(container.querySelector('form')).toBe(form)
    input.value = '4242424242424242'; await submit()
    expect(mocks.confirm).toHaveBeenCalledTimes(2); expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('verification is in progress'); expect(mocks.recover).not.toHaveBeenCalled()
  })
  it('ignores Refresh/Recheck during an SDK submission and keeps the active form mounted', async () => {
    const result = deferred<object>(); mocks.confirm.mockImplementation(() => result.promise)
    await mount(); await click('Resume existing Stripe checkout')
    const form = container.querySelector('form')!; await submit()
    const reads = mocks.read.mock.calls.length
    expect(button('Check payment status')?.disabled).toBe(true)
    await click('Check payment status'); await click('Check payment status')
    // Dispatch a second submission even though the visible button is disabled.
    await submit()
    expect(mocks.read).toHaveBeenCalledTimes(reads); expect(mocks.recover).not.toHaveBeenCalled(); expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(container.querySelector('form')).toBe(form)
    await act(async () => result.resolve({ paymentIntent: { status: 'succeeded' } }))
    expect(container.textContent).toContain('verification is in progress'); expect(mocks.prepare).toHaveBeenCalledOnce()
  })
})

it('hides payment controls after PAID while continuing authoritative order finalization', async () => {
  mocks.read.mockResolvedValue(paid); await mount()
  expect(button('Check payment status')).toBeUndefined()
  expect(container.querySelector('form')).toBeNull()
  mocks.read.mockResolvedValue(confirmed)
  await act(async () => vi.advanceTimersByTimeAsync(4000))
  expect(container.textContent).toContain('Thank you for your order')
  expect(cart.refreshCart).toHaveBeenCalledOnce()
  expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.recover).not.toHaveBeenCalled()
})


describe('authoritative retry after bounded verification', () => {
  it.each([
    ['failed redirect', 'RETRY_REQUIRES_PROVIDER_CHECK', 'Check existing payment with Stripe'],
    ['unresolved polling', 'RETRY_AVAILABLE', 'Start verified-unpaid replacement payment'],
  ] as const)('%s allows retry only after timeout and explicit fresh read', async (entry, state, label) => {
    const unrelated = { router: { scroll: 123 }, source: 'account' }
    history.replaceState(unrelated, '', entry === 'failed redirect'
      ? '/checkout/orders/41?payment_intent=pi_failed&payment_intent_client_secret=private&redirect_status=failed'
      : '/checkout/orders/41')
    if (entry === 'unresolved polling') mocks.read.mockResolvedValue({ ...pending, paymentWindow: windowFixture('OUTCOME_UNRESOLVED') })
    await mount(true)
    if (entry === 'unresolved polling') await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(history.state).toEqual(unrelated)
    mocks.read.mockResolvedValue({ ...pending, paymentWindow: windowFixture(state) }); mocks.recover.mockResolvedValue({ ...pending, paymentWindow: windowFixture(state) })
    await act(async () => vi.advanceTimersByTimeAsync(29000))
    expect(container.textContent).toContain('does not mean payment failed')
    expect(button(label)).toBeUndefined()
    await click('Check payment status')
    expect(button(label)?.disabled).toBe(false)
    expect(container.textContent).not.toContain('Do not pay again')
    expect(history.state).toEqual(unrelated)
    await act(async () => root.unmount()); await mount(true)
    const reads = mocks.read.mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(35000))
    expect(mocks.read).toHaveBeenCalledTimes(reads); expect(button(label)?.disabled).toBe(false)
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.recover).toHaveBeenCalledTimes(state === 'RETRY_REQUIRES_PROVIDER_CHECK' ? 1 : 0); expect(mocks.create).not.toHaveBeenCalled()
  })
  it('keeps Refresh usable after network uncertainty, unlocking only a successful retry snapshot', async () => {
    history.replaceState({ router: 'preserved' }, '', '/checkout/orders/41?payment_intent=pi_failed&redirect_status=failed')
    mocks.read.mockResolvedValueOnce(pending).mockRejectedValue(new Error('offline'))
    await mount(true)
    expect(container.textContent).toContain('outcome is not yet known')
    expect(button('Check payment status')?.disabled).toBe(false)
    mocks.recover.mockRejectedValueOnce(new Error('offline'))
    await click('Check payment status')
    expect(button('Resume existing Stripe checkout')).toBeUndefined()
    mocks.recover.mockResolvedValue({ ...pending, paymentWindow: windowFixture('RETRY_AVAILABLE') })
    await click('Check payment status')
    expect(button('Start verified-unpaid replacement payment')?.disabled).toBe(false)
    expect(history.state).toEqual({ router: 'preserved' })
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.recover).toHaveBeenCalledTimes(2); expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe('delayed Stripe webhook recovery through one status action',()=>{
 it.each(['CHECKOUT_RESUMABLE','PROCESSING','OUTCOME_UNRESOLVED','RETRY_REQUIRES_PROVIDER_CHECK'] as const)('recovers %s after page reload without another initiation or browser capture',async state=>{
  mocks.read.mockResolvedValue({...pending,paymentWindow:windowFixture(state)});mocks.recover.mockResolvedValue(confirmed)
  await mount(true)
  expect([...container.querySelectorAll('button')].filter(b=>b.textContent==='Check payment status')).toHaveLength(1)
  expect(mocks.recover).not.toHaveBeenCalled()
  await click('Check payment status')
  expect(mocks.recover).toHaveBeenCalledExactlyOnceWith('jwt',41)
  expect(container.textContent).toContain('Thank you for your order');expect(cart.refreshCart).toHaveBeenCalledOnce()
  expect(button('Check payment status')).toBeUndefined()
  expect(mocks.create).not.toHaveBeenCalled();expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.confirm).not.toHaveBeenCalled()
  await act(async()=>root.unmount());mocks.read.mockResolvedValue(confirmed);await mount(true)
  expect(container.textContent).toContain('Thank you for your order');expect(mocks.recover).toHaveBeenCalledTimes(1)
 })
})

it.each([['PAID',paid],['stale PENDING',pending]] as const)('PAID verification resumes after a competing %s read without a customer button',async (_label,response)=>{
 let driver:ReturnType<typeof useCheckout>|undefined
 function Harness(){const checkout=useCheckout('jwt',1,41);useConfirmedCartRefresh(checkout.order);useEffect(()=>{driver=checkout},[checkout]);return <p>{checkout.phase}</p>}
 mocks.read.mockResolvedValue(paid)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
 await act(async()=>root.render(<CartContext.Provider value={cart}><Harness/></CartContext.Provider>))
 const competing=deferred<Order>();mocks.read.mockImplementationOnce(()=>competing.promise)
 let refresh:Promise<void>|undefined
 await act(async()=>{refresh=driver!.reloadOrder()})
 await act(async()=>vi.advanceTimersByTimeAsync(4000))
 expect(mocks.read).toHaveBeenCalledTimes(2);expect(cart.refreshCart).not.toHaveBeenCalled()
 await act(async()=>{competing.resolve(response);await refresh})
 expect(driver!.order?.paymentWindow?.state).toBe('PAID')
 mocks.read.mockResolvedValue(confirmed)
 await act(async()=>vi.advanceTimersByTimeAsync(4000))
 expect(driver!.phase).toBe('confirmed');expect(cart.refreshCart).toHaveBeenCalledOnce()
 expect(mocks.create).not.toHaveBeenCalled();expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.recover).not.toHaveBeenCalled();expect(mocks.confirm).not.toHaveBeenCalled()
 expect(container.querySelector('button')).toBeNull()
})
