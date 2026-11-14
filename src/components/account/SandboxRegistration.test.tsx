// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('../../features/checkout/sandbox', () => ({ sandboxCheckout: true, registrationAvailable: true, sandboxClientId: 'fixture' }))
import { act } from 'react'
import { createRoot } from 'react-dom/client'
const auth = vi.hoisted(() => ({ authenticate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' }, authenticate: auth.authenticate, clearError: vi.fn(), refreshAuth: vi.fn() }) }))
import { AccountForms, AccountView } from './AccountForms'
it('allows explicit Sandbox signup by email with legal notice, preserving hidden recovery', () => {
  const signup = renderToStaticMarkup(<AccountView mode="create" onModeChange={() => {}} />)
  expect(signup).toContain('Create Account')
  expect(signup).not.toContain('type="password"')
  expect(signup).toContain('/legal/terms')
  expect(signup).toContain('/legal/privacy')
  const signin = renderToStaticMarkup(<AccountView mode="signin" onModeChange={() => {}} onForgotPassword={() => {}} />)
  expect(signin).toContain('Create Account')
  expect(signin).toContain('Sign In')
  expect(signin).not.toContain('Forgot password?')
})

it('submits email-only signup through the existing auth flow, only with a valid email', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<AccountForms />))
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Account'))!.click())
    const fill = async (name: string, value: string) => {
      const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(container.textContent).toContain('Enter your email address.')
    await fill('email', 'not-an-email')
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(auth.authenticate).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Enter a valid email address.')
    expect(container.querySelector('input[name="password"]')).toBeNull()
    await fill('email', 'owner@example.invalid')
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(auth.authenticate).toHaveBeenCalledExactlyOnceWith('signup', { email: 'owner@example.invalid' })
  } finally { await act(async () => root.unmount()); container.remove() }
})
