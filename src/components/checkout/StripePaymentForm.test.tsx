// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentForm } from './StripePaymentForm'
import { requestExpiredSession, storeSession, subscribeExpiredSession, clearStoredToken, SESSION_STORAGE_KEY } from '../../features/auth/session'
import { AuthProvider, useAuth } from '../../features/auth/AuthProvider'
import { getCurrentUser } from '../../features/auth/api'
import { SessionExpiredDialog } from '../account/SessionExpiredDialog'
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), retrieve: vi.fn(), elements: {} }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }))
vi.mock('@stripe/react-stripe-js', () => {
  const stripe = { confirmPayment: mocks.confirm, retrievePaymentIntent: mocks.retrieve }
  return { useStripe: () => stripe, useElements: () => mocks.elements, PaymentElement: () => <div data-payment-element="true" />, Elements: ({ children }: { children: React.ReactNode }) => children }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); const verify = vi.fn(); await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={verify} />)); return verify }
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
beforeEach(() => { mocks.confirm.mockReset(); mocks.retrieve.mockReset().mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } }) })
afterEach(async () => { if (root) await act(async () => root.unmount()); clearStoredToken(); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function AuthBoundCheckout({ onVerify }: { onVerify: Array<() => Promise<void>> }) {
  const { state, dismissExpiredSession } = useAuth()
  return <>
    <p data-checkout-auth={state.status}>{state.status}</p>
    {state.status === 'authenticated' && onVerify.map((verify, index) => <PaymentForm key={index} clientSecret={`secret-${index}`} orderId={41 + index} onVerify={verify} />)}
    {state.status === 'signedOut' && state.reason === 'expired' && <SessionExpiredDialog onConfirm={dismissExpiredSession} />}
  </>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

async function mountAuthBoundCheckout(onVerify: Array<() => Promise<void>>) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><AuthBoundCheckout onVerify={onVerify} /></AuthProvider>))
}
describe('Stripe payment submission', () => {
  it('defers session-expiry teardown until Stripe confirmation and order verification finish', async () => {
    storeSession({ token: 'test-token', refreshToken: 'a'.repeat(43), accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshExpiresAt: '2030-02-01T00:00:00Z' })
    let finishVerification!: () => void
    const expired = vi.fn()
    const unsubscribe = subscribeExpiredSession(expired)
    mocks.confirm.mockImplementation(() => { requestExpiredSession(); return Promise.resolve({ paymentIntent: { status: 'succeeded' } }) })
    const verify = vi.fn(() => new Promise<void>(resolve => { finishVerification = resolve }))
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={verify} />))
    await submit()
    expect(verify).toHaveBeenCalledOnce()
    expect(expired).not.toHaveBeenCalled()
    await act(async () => { finishVerification(); await Promise.resolve() })
    expect(expired).toHaveBeenCalledOnce()
    unsubscribe()
  })
  it('defers all expiry cleanup through concurrent refresh rejection, confirmations and order recovery', async () => {
    const session = { token: 'payment-session-token', refreshToken: 'p'.repeat(43), accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshExpiresAt: '2030-02-01T00:00:00Z' }
    storeSession(session)
    const confirmation = [deferred<{ paymentIntent: { status: string } }>(), deferred<{ paymentIntent: { status: string } }>()]
    const verification = [deferred<void>(), deferred<void>()]
    const verify = verification.map(item => vi.fn(() => item.promise))
    mocks.confirm.mockImplementationOnce(() => confirmation[0].promise).mockImplementationOnce(() => confirmation[1].promise)
    let profileReads = 0
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/users/me' && profileReads++ === 0) return Promise.resolve(new Response(JSON.stringify({ id: 9, email: 'test@example.com', firstName: 'Test', lastName: null, phone: null }), { status: 200 }))
      if (url === '/api/users/me') return Promise.resolve(new Response('{"error":{"code":"SESSION_INVALID"}}', { status: 401 }))
      if (url === '/api/auth/refresh') return Promise.resolve(new Response('{"error":{"code":"SESSION_INVALID"}}', { status: 401 }))
      throw new Error('Unexpected request')
    }))
    await mountAuthBoundCheckout(verify)
    await vi.waitFor(() => expect(container.querySelectorAll('form')).toHaveLength(2))

    await act(async () => { for (const form of container.querySelectorAll('form')) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2))
    await act(async () => { await Promise.allSettled([getCurrentUser(session.token), getCurrentUser(session.token)]) })

    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    expect(container.querySelector('[data-checkout-auth]')?.getAttribute('data-checkout-auth')).toBe('authenticated')
    expect(container.querySelectorAll('form')).toHaveLength(2)
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()

    await act(async () => { confirmation[0].resolve({ paymentIntent: { status: 'succeeded' } }); confirmation[1].resolve({ paymentIntent: { status: 'succeeded' } }); await Promise.resolve() })
    await vi.waitFor(() => { expect(verify[0]).toHaveBeenCalledOnce(); expect(verify[1]).toHaveBeenCalledOnce() })
    await act(async () => { verification[0].resolve(); await Promise.resolve() })
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    await act(async () => { verification[1].resolve(); await Promise.resolve() })

    await vi.waitFor(() => expect(container.querySelector('[role="alertdialog"]')).not.toBeNull())
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(container.querySelectorAll('form')).toHaveLength(0)
    expect(container.querySelector('[data-checkout-auth]')?.getAttribute('data-checkout-auth')).toBe('signedOut')
  })
  it('blocks duplicate payment submission and uses order-specific return URL', async () => {
    let resolve!: (value: object) => void
    mocks.confirm.mockImplementation(() => new Promise(done => { resolve = done }))
    const verify = await mount(); await submit(); await submit()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.confirm).toHaveBeenCalledWith({ elements: mocks.elements, confirmParams: { return_url: `${location.origin}/checkout/orders/41` }, redirect: 'if_required' })
    expect(verify).not.toHaveBeenCalled()
    await act(async () => resolve({ paymentIntent: { status: 'succeeded' } }))
    expect(verify).toHaveBeenCalledTimes(1); expect(container.textContent).not.toContain('Pay now')
  })
  it('without backend re-admission, still requires a status check after a decline', async () => {
    mocks.confirm.mockResolvedValue({ error: { type: 'card_error', message: 'Your card was declined.' } })
    const verify = await mount(); await submit()
    expect(container.textContent).toContain('declined'); expect(verify).not.toHaveBeenCalled(); expect(container.querySelector('button')?.disabled).toBe(false)
    expect(container.textContent).not.toContain('Pay now'); await submit(); expect(mocks.confirm).toHaveBeenCalledTimes(1)
    await act(async () => container.querySelector('button')!.click()); expect(verify).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['confirm', 2, true],
    ['remount', 1, true],
    ['stop', 1, false],
  ] as const)('after a decline, a %s re-admission gives %i confirmations', async (admission, confirmations, payNow) => {
    mocks.confirm.mockResolvedValue({ error: { type: 'card_error', message: 'Your card was declined.' } })
    const beforeConfirm = vi.fn().mockResolvedValue(true); const beforeRetry = vi.fn().mockResolvedValue(admission)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={vi.fn()} beforeConfirm={beforeConfirm} beforeRetry={beforeRetry} />))
    await submit()
    expect(container.textContent).toContain('Your card was declined.'); expect(container.textContent).toContain('Pay now')
    await submit()
    expect(beforeConfirm).toHaveBeenCalledOnce(); expect(beforeRetry).toHaveBeenCalledOnce()
    expect(mocks.confirm).toHaveBeenCalledTimes(confirmations)
    expect(container.textContent?.includes('Pay now')).toBe(payNow)
  })
  it('routes an ambiguous provider/network outcome to status checking', async () => {
    mocks.confirm.mockRejectedValue(new Error('offline')); const verify = await mount(); await submit()
    expect(container.textContent).toContain('Connection lost'); expect(container.textContent).not.toContain('Pay now')
    await act(async () => container.querySelector('button')!.click()); expect(verify).toHaveBeenCalledOnce()
  })
  it('uses explicit recovery only for the customer status-check action', async () => {
    const verify = vi.fn(); const recover = vi.fn()
    mocks.confirm.mockRejectedValue(new Error('offline'))
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={verify} onRecheck={recover} />))
    await submit(); expect(recover).not.toHaveBeenCalled(); expect(verify).not.toHaveBeenCalled()
    await act(async () => container.querySelector('button')!.click())
    expect(recover).toHaveBeenCalledOnce(); expect(verify).not.toHaveBeenCalled()
  })
  it('does not offer payment again when a recovered intent is already processing', async () => {
    mocks.retrieve.mockResolvedValue({ paymentIntent: { status: 'processing' } })
    const verify = await mount(); expect(verify).toHaveBeenCalledOnce(); expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it.each(['', 'pk_test_mock'])('handles unavailable Stripe configuration/SDK with key %s', async key => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', key)
    vi.resetModules()
    const { StripePaymentForm } = await import('./StripePaymentForm')
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<StripePaymentForm clientSecret="secret" orderId={41} onVerify={vi.fn()} />))
    expect(container.textContent).toContain(key ? 'Secure payment could not load' : 'Payments are not configured')
  })
})


describe('Stripe callback lifecycle and backend confirmation gate', () => {
  it('discards a confirmation result after the form is unmounted', async () => {
    let finish!: (value: object) => void
    mocks.confirm.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const verify = await mount(); await submit()
    await act(async () => root.unmount())
    await act(async () => finish({ paymentIntent: { status: 'succeeded' } }))
    expect(verify).not.toHaveBeenCalled()
  })
  it('discards an old SDK retrieval after switching checkout secrets', async () => {
    let finish!: (value: object) => void
    mocks.retrieve.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } })
    const verify = await mount()
    await act(async () => root.render(<PaymentForm clientSecret="new_secret" orderId={42} onVerify={verify} />))
    await act(async () => finish({ paymentIntent: { status: 'succeeded' } }))
    expect(verify).not.toHaveBeenCalled(); expect(container.textContent).toContain('Pay now')
  })
  it('never calls Stripe confirm after a rejected backend permission check', async () => {
    const beforeConfirm = vi.fn().mockResolvedValue(false)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={vi.fn()} beforeConfirm={beforeConfirm} />))
    await submit()
    expect(beforeConfirm).toHaveBeenCalledOnce(); expect(mocks.confirm).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Pay now')
  })
  it.each(['future_status', 'canceled'])('does not enable confirmation from an unsupported SDK state %s', async status => {
    mocks.retrieve.mockResolvedValue({ paymentIntent: { status } })
    await mount(); await submit()
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(container.textContent).not.toContain('Pay now')
  })
})
