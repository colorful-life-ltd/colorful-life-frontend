// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountForms } from './AccountForms'
import { AccountModal } from '../homepage/AccountModal'

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }))
// Production defaults (VITE_REGISTRATION_ENABLED unset); individual tests flip these live bindings.
const flags = vi.hoisted(() => ({ stripeSandbox: false, sandboxCheckout: false, registrationAvailable: false }))
vi.mock('../../features/checkout/sandbox', () => flags)
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' }, authenticate: auth.authenticate, clearError: vi.fn(), refreshAuth: vi.fn(), logout: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const PASSWORD = 'Synthetic1!Password'
let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
const dialog = () => document.querySelector<HTMLDialogElement>('dialog.registration-closed-dialog')
const button = (label: string, scope: ParentNode = container) => [...scope.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(label))!
const createLink = () => container.querySelector<HTMLButtonElement>('.account-experience__switch button')!
async function mount(element: ReactNode) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(element))
}
async function type(selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(selector)!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
  await act(async () => { element.dispatchEvent(new Event('input', { bubbles: true })) })
}
/** Activates the "Create Account →" link from the sign-in form, keeping it focused as a real click would. */
async function clickCreateLink() {
  const link = createLink()
  expect(link.textContent).toContain('Create Account')
  link.focus()
  await act(async () => link.click())
  return link
}
async function pressEscape() {
  await act(async () => {
    const modal = dialog()!
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    modal.dispatchEvent(new Event('cancel', { cancelable: true }))
  })
}
function expectNoSignupAttempt() {
  expect(auth.authenticate).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain('Account registration is not open yet.')
}

beforeEach(() => {
  Object.assign(flags, { stripeSandbox: false, sandboxCheckout: false, registrationAvailable: false })
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  auth.authenticate.mockReset().mockResolvedValue(undefined)
  fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'log'); vi.spyOn(console, 'error'); vi.spyOn(console, 'warn')
})
afterEach(async () => {
  await act(async () => root?.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})

describe('Production, registration closed (default): Create Account link', () => {
  it('opens the announcement immediately and never shows the registration form', async () => {
    await mount(<AccountForms />)
    expect(dialog()).toBeNull()
    await clickCreateLink()
    const modal = dialog()!
    expect(modal.hasAttribute('open')).toBe(true)
    expect(modal.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(modal.getAttribute('aria-labelledby')!)!.textContent).toBe('We’re Opening Soon! 🌼')
    expect(document.getElementById(modal.getAttribute('aria-describedby')!)!.textContent).toContain('feel free to explore and browse our collection')
    expect(modal.textContent).toContain('we can’t wait to welcome you!')
    expect(document.activeElement).toBe(button('Continue Exploring', modal))
    // No create-account fields are ever rendered; the sign-in form stays underneath.
    expect(container.querySelector('[id^="account-create-"]')).toBeNull()
    expect(container.querySelector('[data-account-mode="signin"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expectNoSignupAttempt()
  })

  it('closes the announcement from the close icon and returns focus to the Create Account link', async () => {
    await mount(<AccountForms />)
    const link = await clickCreateLink()
    await act(async () => dialog()!.querySelector<HTMLButtonElement>('[aria-label="Close announcement"]')!.click())
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(link)
    expect(container.querySelector('[id^="account-create-"]')).toBeNull()
  })

  it('can be opened again after it was dismissed', async () => {
    await mount(<AccountForms />)
    await clickCreateLink()
    await pressEscape()
    await clickCreateLink()
    expect(dialog()).not.toBeNull()
    expectNoSignupAttempt()
  })
})

describe('Production, registration closed inside the Account overlay', () => {
  it('Continue Exploring closes the announcement and the account overlay, returning to browsing', async () => {
    const onClose = vi.fn()
    await mount(<AccountModal onClose={onClose} />)
    await clickCreateLink()
    expect(dialog()).not.toBeNull()
    await act(async () => button('Continue Exploring', dialog()!).click())
    expect(dialog()).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
    expectNoSignupAttempt()
  })

  it('Escape closes only the announcement, keeps the overlay open and restores focus to the link', async () => {
    const onClose = vi.fn()
    await mount(<AccountModal onClose={onClose} />)
    const link = await clickCreateLink()
    await pressEscape()
    expect(dialog()).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(link)
    // A second Escape, now outside the announcement, closes the overlay as before.
    await act(async () => { link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves sign-in and password reset unchanged', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await type('#account-signin-email', 'old@example.com')
    await type('#account-signin-password', PASSWORD)
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(auth.authenticate).toHaveBeenCalledWith('signin', { email: 'old@example.com', password: PASSWORD })
    await act(async () => button('Forgot password?').click())
    expect(container.querySelector('[data-account-mode="forgot"]')).not.toBeNull()
    expect(container.querySelector('#account-forgot-email')).not.toBeNull()
    expect(dialog()).toBeNull()
  })
})

describe('form-submit guard (defence in depth)', () => {
  it('shows the announcement instead of submitting if the create form is somehow reached while closed', async () => {
    flags.registrationAvailable = true
    await mount(<AccountForms />)
    await clickCreateLink()
    await type('#account-create-email', 'new@example.com')
    await type('#account-create-password', PASSWORD)
    await type('#account-create-confirmPassword', PASSWORD)
    flags.registrationAvailable = false // registration closes after the form was shown
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(dialog()).not.toBeNull()
    expectNoSignupAttempt()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(dialog()!.outerHTML).not.toContain(PASSWORD)
    for (const method of ['log', 'error', 'warn'] as const) {
      for (const call of vi.mocked(console[method]).mock.calls) expect(JSON.stringify(call)).not.toContain(PASSWORD)
    }
  })
})

describe('Production, registration open (VITE_REGISTRATION_ENABLED=true)', () => {
  it('shows the original form from the Create Account link and submits signup normally', async () => {
    flags.registrationAvailable = true
    await mount(<AccountForms />)
    await clickCreateLink()
    expect(dialog()).toBeNull()
    expect(container.querySelector('[data-account-mode="create"]')).not.toBeNull()
    await type('#account-create-email', 'new@example.com')
    await type('#account-create-password', PASSWORD)
    await type('#account-create-confirmPassword', PASSWORD)
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(dialog()).toBeNull()
    expect(auth.authenticate).toHaveBeenCalledWith('signup', { email: 'new@example.com', password: PASSWORD })
  })
})

describe('Sandbox keeps its existing registration switch', () => {
  it('hides Create Account and never shows the announcement when Sandbox registration is not opted in', async () => {
    Object.assign(flags, { stripeSandbox: true, sandboxCheckout: true, registrationAvailable: false })
    await mount(<AccountModal onClose={vi.fn()} />)
    expect(container.querySelector('.account-experience__switch')).toBeNull()
    expect(container.textContent).not.toContain('Create Account')
    expect(dialog()).toBeNull()
  })

  it('shows the normal form when VITE_SANDBOX_REGISTRATION_ENABLED opts in', async () => {
    Object.assign(flags, { stripeSandbox: true, sandboxCheckout: true, registrationAvailable: true })
    await mount(<AccountForms />)
    await clickCreateLink()
    expect(dialog()).toBeNull()
    expect(container.querySelector('#account-create-confirmPassword')).not.toBeNull()
  })
})
