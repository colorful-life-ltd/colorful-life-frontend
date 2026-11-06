import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
it.each([
  ['paypal-sandbox', undefined, false],
  ['paypal-sandbox', 'false', false],
  ['paypal-sandbox', 'TRUE', false],
  ['paypal-sandbox', 'true', true],
  // Sandbox ignores the Production switch.
  ['paypal-sandbox', undefined, false, 'true'],
  // Production is closed by default and opens only on an exact VITE_REGISTRATION_ENABLED=true.
  [undefined, undefined, false],
  [undefined, 'true', false],
  [undefined, undefined, false, 'false'],
  [undefined, undefined, false, 'TRUE'],
  [undefined, undefined, true, 'true'],
])('registration availability for %s / %s is %s (production switch %s)', async (mode, enabled, expected, production?: string) => {
  vi.stubEnv('VITE_PAYMENT_MODE', mode)
  vi.stubEnv('VITE_SANDBOX_REGISTRATION_ENABLED', enabled)
  vi.stubEnv('VITE_REGISTRATION_ENABLED', production)
  const config = await import('./sandbox')
  expect(config.registrationAvailable).toBe(expected)
  expect(config.sandboxCheckout).toBe(mode === 'paypal-sandbox')
})
