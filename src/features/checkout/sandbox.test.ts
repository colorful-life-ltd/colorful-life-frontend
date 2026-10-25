import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
it.each([
  ['paypal-sandbox', undefined, false],
  ['paypal-sandbox', 'false', false],
  ['paypal-sandbox', 'TRUE', false],
  ['paypal-sandbox', 'true', true],
  [undefined, undefined, true],
])('registration availability for %s / %s is %s', async (mode, enabled, expected) => {
  vi.stubEnv('VITE_PAYMENT_MODE', mode)
  vi.stubEnv('VITE_SANDBOX_REGISTRATION_ENABLED', enabled)
  const config = await import('./sandbox')
  expect(config.registrationAvailable).toBe(expected)
  expect(config.sandboxCheckout).toBe(mode === 'paypal-sandbox')
})
