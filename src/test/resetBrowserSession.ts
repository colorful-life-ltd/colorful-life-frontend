import { afterEach } from 'vitest'
import { resetSharedSessionForTests } from '../features/auth/session'

// The customer session is browser-wide (localStorage). Reset it after every test, as a fresh profile would be.
afterEach(() => {
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try { (globalThis as unknown as Record<string, Storage | undefined>)[area]?.clear() } catch { /* node environment */ }
  }
  resetSharedSessionForTests()
})
