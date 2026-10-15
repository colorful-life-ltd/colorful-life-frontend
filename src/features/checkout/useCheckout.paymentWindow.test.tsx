// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutApiError, createOrder, getOrder, preparePayment, recoverPayment, type Order } from './api'
import { useCheckout } from './useCheckout'
import { captureStripeReturn } from './state'
import { windowFixture } from './paymentWindowFixtures'
import type { PaymentWindow } from './paymentWindow'
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), createOrder: vi.fn(), getOrder: vi.fn(), preparePayment: vi.fn(), recoverPayment: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const order = (state: PaymentWindow['state'] = 'INITIAL_PAYMENT', overrides: Partial<Order> = {}): Order => ({ id: 41, status: 'PENDING', totalAmount: '20.00', reservationExpiresAt: '2000-01-01T00:00:00Z', payment: null, paymentWindow: windowFixture(state), billingRecipientName: 'Buyer', billingLine1: '1 Road', billingLine2: null, billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Buyer', deliveryLine1: '1 Road', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', orderItems: [], ...overrides })
let root: Root
let current: ReturnType<typeof useCheckout>
function Harness({ id = 41, token = 'customer' }: { id?: number; token?: string }) { const hook = useCheckout(token, 1, id); useEffect(() => { current = hook }, [hook]); return <p>{hook.phase}</p> }
async function mount() { const container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<Harness />)) }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); history.replaceState({}, '', '/checkout/orders/41'); vi.mocked(getOrder).mockResolvedValue(order()); vi.mocked(preparePayment).mockResolvedValue('transient_secret') })
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers() })

describe('authoritative payment operations', () => {
  it.each(['INITIAL_PAYMENT', 'CHECKOUT_RESUMABLE', 'RETRY_AVAILABLE', 'RETRY_REQUIRES_PROVIDER_CHECK'] as const)('executes one explicit %s handshake and rechecks its result', async state => {
    vi.mocked(getOrder).mockResolvedValueOnce(order(state)).mockResolvedValueOnce(order(state)).mockResolvedValue(order(state === 'RETRY_REQUIRES_PROVIDER_CHECK' ? state : 'CHECKOUT_RESUMABLE'))
    await mount()
    expect(preparePayment).not.toHaveBeenCalled()
    await act(async () => { void current.prepare(); void current.prepare() })
    expect(preparePayment).toHaveBeenCalledExactlyOnceWith('customer', 41)
    expect(getOrder).toHaveBeenCalledTimes(3)
    expect(current.phase).toBe('payment'); expect(current.secret).toBe('transient_secret')
    expect(createOrder).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0)
    expect(location.href).not.toContain('secret')
  })
  it('repeated refresh, navigation and rerenders never initialize or replace payment', async () => {
    vi.mocked(getOrder).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
    await mount(); await act(async () => root.render(<Harness />))
    await act(async () => current.reloadOrder()); await act(async () => current.reloadOrder())
    await act(async () => root.unmount()); await mount()
    expect(preparePayment).not.toHaveBeenCalled(); expect(current.secret).toBeNull()
  })
  it.each(['PROCESSING', 'OUTCOME_UNRESOLVED', 'PAID', 'NOT_PAYABLE'] as const)('never initiates for %s, irrespective of compatibility status/deadline', async state => {
    vi.mocked(getOrder).mockResolvedValue(order(state, { payment: { status: 'FAILED', paidAt: null } }))
    await mount(); await act(async () => current.prepare())
    expect(preparePayment).not.toHaveBeenCalled(); expect(current.secret).toBeNull()
  })
  it.each([undefined, null, { version: 2 }, { ...windowFixture(), resumeEligibility: 'ELIGIBLE' }])('fails closed for invalid contract %j', async paymentWindow => {
    vi.mocked(getOrder).mockResolvedValue(order('INITIAL_PAYMENT', { paymentWindow: paymentWindow as PaymentWindow }))
    await mount(); await act(async () => current.prepare()); await act(async () => current.recheck())
    expect(current.phase).toBe('pending'); expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('polls processing beyond the reservation deadline and accepts delayed backend success', async () => {
    vi.useFakeTimers()
    vi.mocked(getOrder).mockResolvedValueOnce(order('PROCESSING')).mockResolvedValueOnce(order('PROCESSING')).mockResolvedValue(order('PAID', { status: 'CONFIRMED', payment: { status: 'PROCESSING', paidAt: null } }))
    await mount(); expect(current.phase).toBe('pending')
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
    expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('recognizes retry-deadline closure only from the backend snapshot', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order('RETRY_AVAILABLE')).mockResolvedValue(order('NOT_PAYABLE', { paymentWindow: windowFixture('NOT_PAYABLE', { paymentOutcome: 'UNPAID', reason: 'WINDOW_CLOSED', retryDeadline: '2026-10-15T12:00:00Z' }) }))
    await mount(); await act(async () => current.prepare())
    expect(current.phase).toBe('terminal'); expect(preparePayment).not.toHaveBeenCalled()
  })
  it('does not silently turn resume into a replacement after preflight capability changes', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order('CHECKOUT_RESUMABLE')).mockResolvedValue(order('RETRY_AVAILABLE'))
    await mount(); await act(async () => current.prepare())
    expect(preparePayment).not.toHaveBeenCalled(); expect(current.order?.paymentWindow?.state).toBe('RETRY_AVAILABLE')
  })
  it.each(['ORDER_NOT_PAYABLE', 'ORDER_EXPIRED', 'PAYMENT_ALREADY_COMPLETED', 'PAYMENT_ADMISSION_CLOSED'])('refreshes after %s and never blindly repeats the mutation', async code => {
    vi.mocked(getOrder).mockResolvedValueOnce(order('CHECKOUT_RESUMABLE')).mockResolvedValueOnce(order('CHECKOUT_RESUMABLE')).mockResolvedValue(order('OUTCOME_UNRESOLVED'))
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(409, code))
    await mount(); await act(async () => current.prepare()); await act(async () => current.prepare())
    expect(preparePayment).toHaveBeenCalledTimes(1); expect(current.actionRejected).toBe(true)
    expect(current.order?.paymentWindow?.state).toBe('OUTCOME_UNRESOLVED'); expect(current.secret).toBeNull()
  })
  it('discards a successful setup secret if a later backend read is paid', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order()).mockResolvedValueOnce(order()).mockResolvedValue(order('PAID', { status: 'CONFIRMED' }))
    await mount(); await act(async () => current.prepare())
    expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
  })
  it('does not expose a secret when the post-handshake order read fails', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order()).mockResolvedValueOnce(order()).mockRejectedValue(new Error('offline'))
    await mount(); await act(async () => current.prepare())
    expect(current.secret).toBeNull(); expect(current.actionRejected).toBe(true)
  })
  it('revalidates the backend before Stripe confirmation and blocks changed eligibility', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order()).mockResolvedValueOnce(order()).mockResolvedValueOnce(order('CHECKOUT_RESUMABLE')).mockResolvedValue(order('PROCESSING'))
    await mount(); await act(async () => current.prepare())
    await act(async () => expect(await current.beforeConfirm()).toBe(false))
    expect(current.secret).toBeNull(); expect(current.order?.paymentWindow?.state).toBe('PROCESSING')
  })
  it('permits confirmation only in the same freshly validated checkout capability', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order()).mockResolvedValueOnce(order()).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
    await mount(); await act(async () => current.prepare())
    await act(async () => expect(await current.beforeConfirm()).toBe(true))
    expect(preparePayment).toHaveBeenCalledTimes(1)
  })
  it('ignores an older initial read that arrives after a paid refresh', async () => {
    const initial = deferred<Order>()
    vi.mocked(getOrder).mockImplementationOnce(() => initial.promise).mockResolvedValue(order('PAID', { status: 'CONFIRMED' }))
    await mount(); await act(async () => current.reloadOrder())
    await act(async () => initial.resolve(order('CHECKOUT_RESUMABLE')))
    expect(current.phase).toBe('confirmed'); expect(current.order?.paymentWindow?.state).toBe('PAID')
  })
  it('ignores out-of-order evaluatedAt snapshots during polling', async () => {
    vi.useFakeTimers()
    const currentWindow = windowFixture('PROCESSING', { evaluatedAt: '2026-10-15T12:05:00Z' })
    vi.mocked(getOrder).mockResolvedValueOnce(order('PROCESSING', { paymentWindow: currentWindow })).mockResolvedValueOnce(order('CHECKOUT_RESUMABLE')).mockResolvedValue(order('PAID', { status: 'CONFIRMED', paymentWindow: windowFixture('PAID', { evaluatedAt: '2026-10-15T12:06:00Z' }) }))
    await mount(); await act(async () => { void current.verify() })
    expect(current.order?.paymentWindow).toEqual(currentWindow)
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(current.phase).toBe('confirmed')
  })
  it('discards a delayed Stripe setup result after navigating to another order', async () => {
    const setup = deferred<string>()
    vi.mocked(preparePayment).mockImplementation(() => setup.promise)
    await mount(); await act(async () => { void current.prepare() })
    vi.mocked(getOrder).mockResolvedValue(order('PAID', { id: 42, status: 'CONFIRMED' }))
    await act(async () => root.render(<Harness id={42} token="other-session" />))
    await act(async () => setup.resolve('old_secret'))
    expect(current.order?.id).toBe(42); expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
  })
  it.each([401, 403, 404])('preserves initiation auth/ownership rejection %s without exposing a form', async status => {
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(status))
    await mount(); await act(async () => current.prepare())
    expect(current.phase).toBe(status === 404 ? 'terminal' : 'auth'); expect(current.secret).toBeNull()
    expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('strips redirect secrets before the first order read settles', async () => {
    history.replaceState({}, '', '/checkout/orders/41?payment_intent_client_secret=private&redirect_status=succeeded')
    vi.mocked(getOrder).mockImplementation(() => new Promise(() => {}))
    await mount(); expect(location.search).toBe(''); expect(current.phase).toBe('loading')
    expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0)
  })
})

describe('payment polling authorization and stale recovery', () => {
  it('retains the newest snapshot and leaves waiting state after older recovery data', async () => {
    const currentWindow = windowFixture('PROCESSING', { evaluatedAt: '2026-10-15T12:05:00Z' })
    vi.mocked(getOrder).mockResolvedValue(order('PROCESSING', { paymentWindow: currentWindow }))
    vi.mocked(recoverPayment).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
    await mount(); await act(async () => current.recheck())
    expect(current.order?.paymentWindow).toEqual(currentWindow)
    expect(current.phase).toBe('pending'); expect(current.secret).toBeNull()
  })
  it('does not restart background polling after an auth/ownership failure', async () => {
    vi.useFakeTimers()
    vi.mocked(getOrder).mockResolvedValueOnce(order('PROCESSING')).mockRejectedValue(new CheckoutApiError(401))
    await mount(); await act(async () => current.verify())
    expect(current.phase).toBe('auth')
    const calls = vi.mocked(getOrder).mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(35000))
    expect(getOrder).toHaveBeenCalledTimes(calls); expect(current.phase).toBe('auth')
  })
  it('bounds read-only polling without repeated initialization or financial failure', async () => {
    vi.useFakeTimers(); vi.mocked(getOrder).mockResolvedValue(order('OUTCOME_UNRESOLVED'))
    await mount(); await act(async () => vi.advanceTimersByTimeAsync(35000))
    expect(getOrder).toHaveBeenCalledTimes(8); expect(current.phase).toBe('verification-timeout')
    expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
  })
})

it('re-reads the existing order after verification without creating or initiating payment', async () => {
  vi.mocked(getOrder).mockRejectedValueOnce(new CheckoutApiError(403, 'EMAIL_VERIFICATION_REQUIRED')).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
  await mount(); expect(current.phase).toBe('verification')
  await act(async () => current.resumeAfterVerification())
  expect(current.phase).toBe('reserved'); expect(getOrder).toHaveBeenCalledTimes(2)
  expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled()
})

it('guards direct Refresh, Recheck, verify and prepare calls for the entire SDK submission lease', async () => {
  vi.mocked(getOrder).mockResolvedValueOnce(order()).mockResolvedValueOnce(order()).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
  await mount(); await act(async () => current.prepare())
  await act(async () => expect(await current.beforeConfirm()).toBe(true))
  expect(current.phase).toBe('submitting')
  const reads = vi.mocked(getOrder).mock.calls.length
  await act(async () => { await current.reloadOrder(); await current.recheck(); await current.verify(); await current.prepare() })
  expect(getOrder).toHaveBeenCalledTimes(reads); expect(recoverPayment).not.toHaveBeenCalled(); expect(preparePayment).toHaveBeenCalledTimes(1)
  expect(current.secret).toBe('transient_secret'); expect(current.phase).toBe('submitting')
  await act(async () => current.submissionSettled())
  expect(current.phase).toBe('payment')
})

it.each([401, 403, 404])('a Stripe redirect hint cannot bypass the initial authenticated order read (%s)', async status => {
  history.replaceState(null, '', '/checkout/orders/41?payment_intent=pi_untrusted&payment_intent_client_secret=private&redirect_status=succeeded')
  vi.mocked(getOrder).mockRejectedValue(new CheckoutApiError(status))
  await mount()
  expect(current.phase).toBe(status === 404 ? 'terminal' : 'auth')
  expect(location.search).toBe(''); expect(getOrder).toHaveBeenCalledTimes(1)
  expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
})

it('cancels verification delays and ignores pending reads on a genuine account/order transition', async () => {
  vi.useFakeTimers(); vi.mocked(getOrder).mockResolvedValue(order('PROCESSING'))
  await mount(); await act(async () => { void current.verify() })
  vi.mocked(getOrder).mockResolvedValue(order('PAID', { id: 42, status: 'CONFIRMED' }))
  await act(async () => root.render(<Harness id={42} token="new-account" />))
  const reads = vi.mocked(getOrder).mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(35000))
  expect(current.phase).toBe('confirmed'); expect(current.order?.id).toBe(42); expect(getOrder).toHaveBeenCalledTimes(reads)
})

it('consumes the redirect hint once and does not restart verification after remount', async () => {
  vi.useFakeTimers()
  history.replaceState(null, '', '/checkout/orders/41?payment_intent=pi_return&payment_intent_client_secret=private&redirect_status=succeeded')
  vi.mocked(getOrder).mockResolvedValue(order('CHECKOUT_RESUMABLE'))
  await mount(); expect(getOrder).toHaveBeenCalledTimes(2)
  expect(location.search).toBe(''); expect(JSON.stringify(history.state)).not.toContain('private')
  await act(async () => root.unmount()); await mount()
  expect(getOrder).toHaveBeenCalledTimes(3)
  await act(async () => vi.advanceTimersByTimeAsync(3000))
  expect(getOrder).toHaveBeenCalledTimes(3)
  expect(current.phase).toBe('reserved'); expect(preparePayment).not.toHaveBeenCalled()
})


it.each(['different customer', 'different order'])('discards a redirect handoff for a %s without losing router state', async transition => {
  vi.useFakeTimers()
  history.replaceState({ router: { position: 12 } }, '', '/checkout/orders/41?payment_intent=pi_return&redirect_status=failed')
  captureStripeReturn(41, transition === 'different customer' ? 2 : 1)
  if (transition === 'different order') history.replaceState(history.state, '', '/checkout/orders/42')
  vi.mocked(getOrder).mockResolvedValue(order('CHECKOUT_RESUMABLE', transition === 'different order' ? { id: 42 } : {}))
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<Harness id={transition === 'different order' ? 42 : 41} />))
  await act(async () => vi.advanceTimersByTimeAsync(35000))
  expect(current.phase).toBe('reserved'); expect(getOrder).toHaveBeenCalledTimes(1)
  expect(history.state).toEqual({ router: { position: 12 } })
  expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
})
