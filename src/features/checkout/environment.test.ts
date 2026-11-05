import { describe, expect, it, vi, afterEach } from 'vitest'
import { validateEnvironment } from './environment'
const valid = { VITE_TARGET_ENVIRONMENT: 'sandbox', VITE_API_ENVIRONMENT: 'sandbox', VITE_SITE_URL: 'https://build-and-bloom.co.uk', VITE_API_BASE_URL: '/api', VITE_PAYMENT_MODE: 'stripe-sandbox', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_synthetic123456' }
const live = { ...valid, VITE_TARGET_ENVIRONMENT: 'production', VITE_API_ENVIRONMENT: 'production', VITE_PAYMENT_MODE: 'stripe-live', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_synthetic123456' }
const load = vi.hoisted(() => vi.fn().mockResolvedValue(null))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: load }))
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); load.mockClear() })
describe('explicit environment contract', () => {
  it.each([valid, live])('accepts explicit matching settings for $VITE_TARGET_ENVIRONMENT', env => { expect(validateEnvironment(env).target).toBe(env.VITE_TARGET_ENVIRONMENT) })
  it.each([
    { ...live, VITE_STRIPE_PUBLISHABLE_KEY: valid.VITE_STRIPE_PUBLISHABLE_KEY },
    { ...valid, VITE_STRIPE_PUBLISHABLE_KEY: live.VITE_STRIPE_PUBLISHABLE_KEY },
    { ...valid, VITE_PAYMENT_MODE: '' }, { ...valid, VITE_PAYMENT_MODE: 'unknown' },
    { ...valid, VITE_TARGET_ENVIRONMENT: '' }, { ...live, VITE_API_ENVIRONMENT: 'sandbox' },
    { ...live, VITE_PAYMENT_MODE: 'stripe-sandbox' }, { ...valid, VITE_PAYMENT_MODE: 'stripe-live' },
    { ...valid, VITE_API_BASE_URL: '' }, { ...valid, VITE_SITE_URL: '' },
    { ...live, VITE_SITE_URL: 'https://sandbox.example.com' },
    { ...live, VITE_API_BASE_URL: 'https://sandbox.example.com/api' },
    { ...live, VITE_API_BASE_URL: 'http://localhost:3000' },
    { ...live, VITE_SANDBOX_REGISTRATION_ENABLED: 'true' },
    { ...valid, VITE_PAYPAL_SANDBOX_CLIENT_ID: 'conflicting' },
    { ...valid, VITE_OTHER: 'sk_test_syntheticPrivateKey123' },
  ])('rejects unsafe configuration before any Stripe initialization %#', async env => {
    expect(() => validateEnvironment(env)).toThrow()
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    const { stripeForPayment } = await import('./stripeLoader')
    expect(stripeForPayment()).toBeNull(); expect(load).not.toHaveBeenCalled()
  })
  it.each([valid, live])('initializes Stripe lazily and only once for $VITE_TARGET_ENVIRONMENT', async env => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    const { stripeForPayment } = await import('./stripeLoader')
    expect(load).not.toHaveBeenCalled(); await stripeForPayment(); await stripeForPayment()
    expect(load).toHaveBeenCalledExactlyOnceWith(env.VITE_STRIPE_PUBLISHABLE_KEY)
  })
})
