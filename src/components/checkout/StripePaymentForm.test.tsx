// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentForm } from './StripePaymentForm'
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
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllEnvs() })
describe('Stripe payment submission', () => {
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
  it('requires backend status checking after a decline before another attempt', async () => {
    mocks.confirm.mockResolvedValue({ error: { type: 'card_error', message: 'Your card was declined.' } })
    const verify = await mount(); await submit()
    expect(container.textContent).toContain('declined'); expect(verify).not.toHaveBeenCalled(); expect(container.querySelector('button')?.disabled).toBe(false)
    expect(container.textContent).not.toContain('Pay now'); await submit(); expect(mocks.confirm).toHaveBeenCalledTimes(1)
    await act(async () => container.querySelector('button')!.click()); expect(verify).toHaveBeenCalledTimes(1)
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
