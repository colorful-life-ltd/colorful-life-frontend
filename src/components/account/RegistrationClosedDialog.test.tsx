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

/** Customer accounts closed: the overlay is only the announcement, with no account form behind it. */
function expectOnlyAnnouncement() {
  const modal = dialog()!
  expect(modal.hasAttribute('open')).toBe(true)
  expect(modal.getAttribute('aria-modal')).toBe('true')
  expect(document.getElementById(modal.getAttribute('aria-labelledby')!)!.textContent).toBe('We’re Opening Soon!\u00a0🌼')
  expect(document.getElementById(modal.getAttribute('aria-describedby')!)!.textContent).toContain('feel free to explore and browse our collection')
  expect(document.activeElement).toBe(button('Continue Exploring', modal))
  expect(document.querySelector('form')).toBeNull()
  expect(document.querySelector('input')).toBeNull()
  expect(document.querySelector('[data-account-mode]')).toBeNull()
  expect(document.body.textContent).not.toContain('Forgot password?')
  expect(document.body.textContent).not.toContain('Welcome back!')
}
function expectNoAuthenticationRequest() {
  expectNoSignupAttempt()
  expect(document.body.textContent).not.toContain('Unable to complete that request')
}

describe('Production, customer accounts closed (default)', () => {
  it('opening the account overlay shows only the announcement: no sign-in, create or recovery form', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    expectOnlyAnnouncement()
    expectNoAuthenticationRequest()
  })

  it('an explicit Sign In or password-recovery entry shows the same announcement', async () => {
    await mount(<AccountModal onClose={vi.fn()} initialAuthMode="forgot" focusSignIn />)
    expectOnlyAnnouncement()
    expectNoAuthenticationRequest()
  })

  it('Continue Exploring, the close icon and Escape each leave the account overlay', async () => {
    for (const leave of [
      async () => button('Continue Exploring', dialog()!).click(),
      async () => dialog()!.querySelector<HTMLButtonElement>('[aria-label="Close announcement"]')!.click(),
      pressEscape,
    ]) {
      const onClose = vi.fn()
      await mount(<AccountModal onClose={onClose} />)
      await act(async () => { await leave() })
      expect(onClose).toHaveBeenCalledTimes(1)
      expectNoAuthenticationRequest()
      await act(async () => root.unmount()); container.remove()
    }
  })

  it('AccountForms on its own also renders only the announcement and hands closing to onExplore', async () => {
    const onExplore = vi.fn()
    await mount(<AccountForms onExplore={onExplore} />)
    expectOnlyAnnouncement()
    await act(async () => button('Continue Exploring', dialog()!).click())
    expect(onExplore).toHaveBeenCalledTimes(1)
    expectNoAuthenticationRequest()
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

  it('never submits sign-in if accounts close after the sign-in form was shown', async () => {
    flags.registrationAvailable = true
    await mount(<AccountForms />)
    await type('#account-signin-email', 'old@example.com')
    await type('#account-signin-password', PASSWORD)
    flags.registrationAvailable = false
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(dialog()).not.toBeNull()
    expectNoAuthenticationRequest()
    expect(dialog()!.outerHTML).not.toContain(PASSWORD)
  })
})

describe('Production, registration open (VITE_REGISTRATION_ENABLED=true)', () => {
  it('shows the normal sign-in form and submits through the existing auth flow', async () => {
    flags.registrationAvailable = true
    await mount(<AccountModal onClose={vi.fn()} />)
    expect(dialog()).toBeNull()
    await type('#account-signin-email', 'old@example.com')
    await type('#account-signin-password', PASSWORD)
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(auth.authenticate).toHaveBeenCalledWith('signin', { email: 'old@example.com', password: PASSWORD })
    expect(container.querySelector('button.account-form__forgot')).not.toBeNull()
  })

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

describe('Sandbox keeps its existing switch (the current public build)', () => {
  it('shows only the announcement and sends no sign-in while Sandbox accounts are closed', async () => {
    Object.assign(flags, { stripeSandbox: true, sandboxCheckout: true, registrationAvailable: false })
    const onClose = vi.fn()
    await mount(<AccountModal onClose={onClose} />)
    expectOnlyAnnouncement()
    await act(async () => button('Continue Exploring', dialog()!).click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expectNoAuthenticationRequest()
  })

  it('shows the normal form when VITE_SANDBOX_REGISTRATION_ENABLED opts in', async () => {
    Object.assign(flags, { stripeSandbox: true, sandboxCheckout: true, registrationAvailable: true })
    await mount(<AccountForms />)
    await clickCreateLink()
    expect(dialog()).toBeNull()
    expect(container.querySelector('#account-create-confirmPassword')).not.toBeNull()
    await type('#account-create-email', 'tester@example.com')
    await type('#account-create-password', PASSWORD)
    await type('#account-create-confirmPassword', PASSWORD)
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(auth.authenticate).toHaveBeenCalledWith('signup', { email: 'tester@example.com', password: PASSWORD })
    expect(dialog()).toBeNull()
  })
})
