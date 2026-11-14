// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, requestVerification, signIn, signUp } from '../../features/auth/api'
import { AccountModal } from '../homepage/AccountModal'
// Email-only registration → "Check your email" → Return to sign in, with real auth state and a mocked API.
vi.mock('../../features/checkout/sandbox', async original => ({ ...await original<typeof import('../../features/checkout/sandbox')>(), registrationAvailable: true }))
vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), signUp: vi.fn(), signIn: vi.fn(), requestVerification: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root | null = null
let container: HTMLDivElement
async function mount(element: ReactNode) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(<AuthProvider>{element}</AuthProvider>))
}
const input = (selector: string) => container.querySelector<HTMLInputElement>(selector)
async function type(selector: string, value: string) {
  const element = input(selector)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(text))
async function click(text: string) { const target = button(text); if (!target) throw new Error(`Missing button ${text}`); await act(async () => target.click()) }
const submit = () => act(async () => { container.querySelector('form')!.requestSubmit() })
async function register(email = 'new.customer@example.com') {
  await click('Create Account')
  await type('#account-create-email', email)
  await submit()
}

beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear()
  vi.mocked(signUp).mockResolvedValue(); vi.mocked(requestVerification).mockResolvedValue()
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = '' })

describe('email-only registration', () => {
  it('asks only for the email, then shows the styled Check your email card without a session', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await click('Create Account')
    expect(container.querySelectorAll('[data-account-mode="create"] input')).toHaveLength(1)
    expect(container.querySelector('input[type="password"]')).toBeNull()
    await type('#account-create-email', 'New.Customer@Example.com')
    await submit()
    expect(signUp).toHaveBeenCalledExactlyOnceWith('New.Customer@Example.com')
    expect(container.querySelector('.account-modal__surface--verification')).not.toBeNull()
    const notice = container.querySelector('.verification-notice')!
    expect(notice).not.toBeNull()
    const title = document.getElementById(notice.getAttribute('aria-labelledby')!)!
    expect(title.textContent).toBe('Check your email')
    expect(title.classList.contains('verification-notice__title')).toBe(true)
    expect(document.activeElement).toBe(title)
    expect(notice.querySelector('.verification-notice__actions .account-form__submit')?.textContent).toBe('Resend verification email')
    expect(notice.querySelector('.verification-notice__actions .verification-notice__continue')?.textContent).toBe('Return to sign in')
    expect(notice.textContent).toContain('choose your password')
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('validates the email locally before any request', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await click('Create Account')
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Enter your email address.')
    await type('#account-create-email', 'not-an-email')
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Enter a valid email address.')
    expect(signUp).not.toHaveBeenCalled()
  })

  it('resends for the registered address with a generic status', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await register()
    await click('Resend verification email')
    expect(requestVerification).toHaveBeenCalledExactlyOnceWith('new.customer@example.com')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('If verification is needed, check your email for next steps.')
  })

  it('treats an already-registered address exactly like a new one (no enumeration)', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await register('existing@example.com')
    expect(container.querySelector('.verification-notice')?.textContent).toContain('If registration is available for this address')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('focus inside the account dialog', () => {
  it('keeps focus on the new heading when the parent re-renders with a new onClose (as App does)', async () => {
    function Parent() { const [, setTick] = useState(0); return <AccountModal onClose={() => setTick(value => value + 1)} /> }
    await mount(<Parent />)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close account dialog')
    await register()
    expect(document.activeElement?.textContent).toBe('Check your email')
    // Escape still uses the latest onClose.
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(document.activeElement?.textContent).toBe('Check your email')
  })
})

describe('Return to sign in and stale form values', () => {
  it('opens Sign In with empty fields after registration', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await register()
    await click('Return to sign in')
    expect(container.querySelector('[data-account-mode="signin"]')).not.toBeNull()
    expect(container.querySelector('[data-account-mode="create"]')).toBeNull()
    expect(container.querySelector('#account-task-title')?.textContent).toBe('Welcome back!')
    expect(input('#account-signin-email')!.value).toBe('')
    expect(input('#account-signin-password')!.value).toBe('')
    expect(container.querySelector('.account-modal__surface--verification')).toBeNull()
    // Going back to Create Account does not resurrect the registered address either.
    await click('Create Account')
    expect(input('#account-create-email')!.value).toBe('')
  })

  it('clears typed values, including passwords, whenever the mode changes', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await type('#account-signin-email', 'someone@example.com')
    await type('#account-signin-password', 'Typed-Secret-1!')
    await click('Create Account')
    expect(input('#account-create-email')!.value).toBe('')
    await type('#account-create-email', 'other@example.com')
    await click('Sign In')
    expect(input('#account-signin-email')!.value).toBe('')
    expect(input('#account-signin-password')!.value).toBe('')
    expect(container.innerHTML).not.toContain('Typed-Secret-1!')
  })

  it('sign-in still submits email and password', async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}))
    await mount(<AccountModal onClose={vi.fn()} />)
    await type('#account-signin-email', 'someone@example.com')
    await type('#account-signin-password', 'Typed-Secret-1!')
    await submit()
    expect(signIn).toHaveBeenCalledExactlyOnceWith('someone@example.com', 'Typed-Secret-1!')
  })
})
