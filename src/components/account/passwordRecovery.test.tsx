// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountForms, AccountView, ForgotPasswordView } from './AccountForms'
import { ResetPassword } from './ResetPassword'
import { capturedResetToken, captureResetToken, forgetResetToken } from '../../features/auth/passwordReset'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const GENERIC = 'If an account exists for that email, we’ve sent a password reset link.'
let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
const respond = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status }))

async function mount(element: React.ReactNode) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(element))
}
const input = (selector: string) => container.querySelector<HTMLInputElement>(selector)!
async function type(selector: string, value: string) {
  const element = input(selector)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })) })
}
const submit = () => act(async () => { container.querySelector('form')!.requestSubmit() })
const text = () => container.textContent ?? ''
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(label))!

beforeEach(() => {
  fetchMock = vi.fn(() => respond(200, { message: 'If an account exists, a password reset email has been sent' }))
  vi.stubGlobal('fetch', fetchMock)
  forgetResetToken()
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks(); history.replaceState(null, '', '/') })

describe('Forgot password entry point', () => {
  it('offers Forgot password? on sign-in only', () => {
    expect(renderToStaticMarkup(<AccountView mode="signin" onModeChange={() => {}} onForgotPassword={() => {}} />)).toContain('Forgot password?')
    expect(renderToStaticMarkup(<AccountView mode="create" onModeChange={() => {}} onForgotPassword={() => {}} />)).not.toContain('Forgot password?')
  })

  it('opens the request form from sign-in, carries the typed email, and returns to sign-in', async () => {
    await mount(<AccountForms />)
    await type('#account-signin-email', 'customer@example.com')
    await act(async () => button('Forgot password?').click())
    expect(text()).toContain('Forgot your password?')
    expect(input('#account-forgot-email').value).toBe('customer@example.com')
    expect(document.activeElement?.id).toBe('account-task-title')
    await act(async () => button('Sign In').click())
    expect(text()).toContain('Welcome back!')
  })

  it('can open directly in request mode', async () => {
    await mount(<AccountForms initialMode="forgot" />)
    expect(input('#account-forgot-email')).not.toBeNull()
  })
})

describe('Password reset request', () => {
  it('shows the identical generic confirmation whatever the success response contains', async () => {
    const confirmations: string[] = []
    for (const body of [{ message: 'If an account exists, a password reset email has been sent' }, {}, { debug: 'unknown account' }]) {
      fetchMock.mockImplementationOnce(() => respond(200, body))
      await mount(<ForgotPasswordView onBack={vi.fn()} />)
      await type('#account-forgot-email', 'someone@example.com')
      await submit()
      expect(container.querySelector('form')).toBeNull()
      confirmations.push(container.querySelector('[role="status"]')!.textContent!)
      await act(async () => root.unmount()); container.remove()
    }
    expect(new Set(confirmations).size).toBe(1)
    expect(confirmations[0]).toContain(GENERIC)
    expect(fetchMock.mock.calls.every(([url]) => url === '/api/auth/forgot-password')).toBe(true)
  })

  it('validates the email locally without contacting the API', async () => {
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    for (const value of ['', 'not-an-email', 'a@b']) {
      await type('#account-forgot-email', value)
      await submit()
      expect(text()).toContain('Enter a valid email address.')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [500, 'We couldn’t send your request. Please try again.'],
    [429, 'Too many requests. Please wait a few minutes and try again.'],
  ])('keeps the form available after HTTP %s without revealing account details', async (status, message) => {
    fetchMock.mockImplementationOnce(() => respond(status, { error: 'internal detail for someone@example.com' }))
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    await type('#account-forgot-email', 'someone@example.com')
    await submit()
    expect(text()).toContain(message)
    expect(text()).not.toContain('internal detail')
    expect(text()).not.toContain(GENERIC)
    expect(input('#account-forgot-email').value).toBe('someone@example.com')
  })

  it('moves focus to the confirmation once the request is sent', async () => {
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    await type('#account-forgot-email', 'someone@example.com')
    await submit()
    const status = container.querySelector<HTMLElement>('[role="status"]')!
    expect(document.activeElement).toBe(status)
    expect(status.tabIndex).toBe(-1)
  })

  it('links an invalid email message to the email field, but not request failures', async () => {
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    await type('#account-forgot-email', 'not-an-email')
    await submit()
    const field = input('#account-forgot-email')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(field.getAttribute('aria-describedby')!)!.textContent).toBe('Enter a valid email address.')
    expect(document.activeElement).toBe(field)
    fetchMock.mockImplementationOnce(() => respond(500))
    await type('#account-forgot-email', 'someone@example.com')
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    await submit()
    expect(text()).toContain('We couldn’t send your request.')
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    expect(field.hasAttribute('aria-describedby')).toBe(false)
  })

  it('treats a network failure as retryable', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    await type('#account-forgot-email', 'someone@example.com')
    await submit()
    expect(text()).toContain('We couldn’t send your request.')
    await submit()
    expect(text()).toContain(GENERIC)
  })

  it('sends one request per submission while waiting', async () => {
    let finish!: () => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = () => resolve(new Response('{}', { status: 200 })) }))
    await mount(<ForgotPasswordView onBack={vi.fn()} />)
    await type('#account-forgot-email', 'someone@example.com')
    await submit(); await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(text()).toContain(GENERIC)
  })
})

describe('Reset password page', () => {
  const VALID = 'N3w-password!'
  async function openReset(token: string | null = 'raw-reset-token') {
    history.replaceState(null, '', token === null ? '/reset-password' : `/reset-password?token=${token}`)
    captureResetToken()
    const callbacks = { onSignIn: vi.fn(), onRequestNewLink: vi.fn() }
    await mount(<ResetPassword {...callbacks} />)
    return callbacks
  }
  async function choose(password: string, confirmation = password) {
    await type('#reset-password-new', password)
    await type('#reset-password-confirm', confirmation)
    await submit()
  }

  it('renders from the in-memory token with nothing left in the URL or browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await openReset()
    expect(location.href).not.toContain('raw-reset-token')
    expect(container.innerHTML).not.toContain('raw-reset-token')
    expect(input('#reset-password-new').autocomplete).toBe('new-password')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('asks for a fresh link when opened without a token', async () => {
    const { onRequestNewLink } = await openReset(null)
    expect(text()).toContain('This page needs the complete link')
    expect(container.querySelector('form')).toBeNull()
    await act(async () => button('Request a new link').click())
    expect(onRequestNewLink).toHaveBeenCalled()
  })

  it.each([
    ['short1!A', 'at least 8 characters', 'Sh0rt!'],
    ['no uppercase', 'an uppercase letter', 'lower-case1!'],
    ['no special', 'a special character', 'NoSpecial123'],
  ])('enforces the password policy locally (%s)', async (_, rule, password) => {
    await openReset()
    await choose(password)
    expect(text()).toContain(`Your password needs ${rule}.`)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('describes the new-password field with the password requirements', async () => {
    await openReset()
    const requirements = document.getElementById(input('#reset-password-new').getAttribute('aria-describedby')!)!
    expect(requirements.textContent).toContain('at least 8 characters')
    expect(input('#reset-password-confirm').hasAttribute('aria-describedby')).toBe(false)
  })

  it('links a policy failure to the new password, keeps the requirements, and focuses it', async () => {
    await openReset()
    await choose('short')
    const field = input('#reset-password-new')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')!.split(' ')).toEqual(['reset-password-requirements', 'reset-password-error'])
    expect(document.getElementById('reset-password-error')!.textContent).toBe('Your password needs at least 8 characters.')
    expect(document.activeElement).toBe(field)
    expect(input('#reset-password-confirm').hasAttribute('aria-invalid')).toBe(false)
  })

  it('links a mismatch to the confirmation field', async () => {
    await openReset()
    await choose(VALID, `${VALID}x`)
    const field = input('#reset-password-confirm')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')).toBe('reset-password-error')
    expect(document.activeElement).toBe(field)
    expect(input('#reset-password-new').getAttribute('aria-describedby')).toBe('reset-password-requirements')
  })

  it('links a server password rejection to the new password but leaves outages page-level', async () => {
    fetchMock
      .mockImplementationOnce(() => respond(400, { error: { newPassword: { _errors: ['too weak'] } } }))
      .mockImplementationOnce(() => respond(503, { error: 'Password recovery temporarily unavailable' }))
    await openReset()
    await choose(VALID)
    expect(input('#reset-password-new').getAttribute('aria-invalid')).toBe('true')
    await submit()
    expect(text()).toContain('We couldn’t update your password.')
    expect(input('#reset-password-new').hasAttribute('aria-invalid')).toBe(false)
    expect(input('#reset-password-new').getAttribute('aria-describedby')).toBe('reset-password-requirements')
  })

  it('requires matching passwords', async () => {
    await openReset()
    await choose(VALID, `${VALID}x`)
    expect(text()).toContain('Your passwords do not match.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits once, clears the token and secrets, then sends the customer to sign in', async () => {
    const { onSignIn } = await openReset()
    await choose(VALID)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/reset-password')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'raw-reset-token', newPassword: VALID })
    expect(capturedResetToken()).toBe('')
    expect(text()).toContain('Your password has been changed.')
    expect(container.querySelector('input')).toBeNull()
    await act(async () => button('Sign in').click())
    expect(onSignIn).toHaveBeenCalled()
  })

  it('treats an invalid, expired or used link as unusable and offers a new one', async () => {
    fetchMock.mockImplementationOnce(() => respond(400, { error: 'Invalid or expired password reset token' }))
    const { onRequestNewLink } = await openReset()
    await choose(VALID)
    expect(text()).toContain('This reset link is invalid, has expired, or has already been used.')
    expect(capturedResetToken()).toBe('')
    await act(async () => button('Request a new link').click())
    expect(onRequestNewLink).toHaveBeenCalled()
  })

  it('keeps the link usable after a server-side password rejection or outage', async () => {
    fetchMock
      .mockImplementationOnce(() => respond(400, { error: { newPassword: { _errors: ['too weak'] } } }))
      .mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
    await openReset()
    await choose(VALID)
    expect(text()).toContain('That password was not accepted.')
    await submit()
    expect(text()).toContain('We couldn’t update your password.')
    expect(capturedResetToken()).toBe('raw-reset-token')
    await submit()
    expect(text()).toContain('Your password has been changed.')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('never shows backend error details', async () => {
    fetchMock.mockImplementationOnce(() => respond(500, { error: 'stack trace raw-reset-token' }))
    await openReset()
    await choose(VALID)
    expect(text()).not.toContain('stack trace')
    expect(text()).not.toContain('raw-reset-token')
  })
})
