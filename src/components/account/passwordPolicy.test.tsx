// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountForms } from './AccountForms'
import { ResetPassword } from './ResetPassword'
import { VerifyEmail } from './VerifyEmail'
import { captureResetToken, forgetResetToken, MAX_PASSWORD_BYTES, PASSWORD_TOO_LONG_MESSAGE, passwordByteLength, passwordPolicyError } from '../../features/auth/passwordReset'

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' }, authenticate: auth.authenticate, clearError: vi.fn(), refreshAuth: vi.fn(), logout: vi.fn() }) }))
// These cover the open-registration path; the closed path lives in RegistrationClosedDialog.test.tsx.
vi.mock('../../features/checkout/sandbox', async original => ({ ...await original<typeof import('../../features/checkout/sandbox')>(), registrationAvailable: true }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

// Every candidate satisfies the complexity rules, so only the byte limit decides.
const prefix = 'Aa1!' // 4 bytes
const ascii = (bytes: number) => prefix + 'a'.repeat(bytes - 4)
const euro = '€' // 3 bytes, 1 UTF-16 unit
const emoji = '😀' // 4 bytes, 2 UTF-16 units
const multibyte72 = prefix + euro.repeat(22) + 'ab' // 4 + 66 + 2 = 72 bytes, 28 characters
const multibyte73 = `${multibyte72}c`
const emoji72 = prefix + emoji.repeat(17) // 4 + 68 = 72 bytes
const emoji76 = prefix + emoji.repeat(18)

let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
async function mount(element: React.ReactNode) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(element))
}
const input = (selector: string) => container.querySelector<HTMLInputElement>(selector)!
async function type(selector: string, value: string) {
  const element = input(selector)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
  await act(async () => { element.dispatchEvent(new Event('input', { bubbles: true })) })
}
const submit = () => act(async () => { container.querySelector('form')!.requestSubmit() })
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(label))!

beforeEach(() => {
  auth.authenticate.mockReset().mockResolvedValue(undefined)
  fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
  vi.stubGlobal('fetch', fetchMock)
  forgetResetToken()
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); history.replaceState(null, '', '/') })

describe('new-password byte limit', () => {
  it('measures UTF-8 bytes, not JavaScript string length', () => {
    expect(MAX_PASSWORD_BYTES).toBe(72)
    expect(passwordByteLength(ascii(72))).toBe(72)
    expect(passwordByteLength(multibyte72)).toBe(72)
    expect(multibyte72.length).toBe(28)
    expect(passwordByteLength(emoji72)).toBe(72)
    expect(emoji72.length).toBe(38)
    // A lone surrogate encodes as U+FFFD (3 bytes), matching Node's Buffer.byteLength.
    expect(passwordByteLength('\ud800')).toBe(3)
  })

  it.each([
    ['72 ASCII bytes', ascii(72)],
    ['72 bytes of multibyte characters', multibyte72],
    ['72 bytes of emoji', emoji72],
  ])('accepts exactly %s', (_, password) => {
    expect(passwordPolicyError(password)).toBeUndefined()
  })

  it.each([
    ['73 ASCII bytes', ascii(73)],
    ['73 bytes in only 29 characters', multibyte73],
    ['76 bytes of emoji', emoji76],
  ])('rejects %s', (_, password) => {
    expect(passwordPolicyError(password)).toBe(PASSWORD_TOO_LONG_MESSAGE)
  })

  it('keeps the existing minimum and complexity rules and messages', () => {
    expect(passwordPolicyError('Aa1!aaa')).toBe('Your password needs at least 8 characters.')
    expect(passwordPolicyError('aa1!aaaa')).toBe('Your password needs an uppercase letter.')
    expect(passwordPolicyError('AA1!AAAA')).toBe('Your password needs a lowercase letter.')
    expect(passwordPolicyError('Aa!aaaaa')).toBe('Your password needs a digit.')
    expect(passwordPolicyError('Aa1aaaaa')).toBe('Your password needs a special character.')
  })
})

// Registration collects the email only; the password is chosen once, on the verification page.
describe('password chosen at email verification', () => {
  async function verify(password: string, confirmation = password) {
    history.replaceState(null, '', '/verify-email?token=synthetic-verification-token')
    await mount(<VerifyEmail onSignIn={vi.fn()} />)
    await type('#verify-email-password', password)
    await type('#verify-email-confirm', confirmation)
    await submit()
  }
  const verifyCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/verify-email'))

  it('registration itself never asks for a password', async () => {
    await mount(<AccountForms />)
    await act(async () => button('Create Account').click())
    expect(container.querySelector('input[type="password"]')).toBeNull()
  })

  it.each([ascii(73), multibyte73, emoji76])('never submits a password over 72 bytes', async password => {
    await verify(password)
    expect(container.querySelector('[role="alert"]')!.textContent).toBe(PASSWORD_TOO_LONG_MESSAGE)
    expect(verifyCalls()).toHaveLength(0)
  })

  it.each([ascii(72), multibyte72, emoji72])('submits a password of exactly 72 bytes unchanged', async password => {
    await verify(password)
    expect(verifyCalls()).toHaveLength(1)
    expect(JSON.parse(String((verifyCalls()[0] as unknown as [string, RequestInit])[1].body))).toEqual({ token: 'synthetic-verification-token', newPassword: password })
  })

  it('still requires a matching confirmation', async () => {
    await verify(multibyte72, `${multibyte72}x`)
    expect(container.textContent).toContain('Passwords do not match.')
    expect(verifyCalls()).toHaveLength(0)
  })
})

describe('sign-in keeps historical passwords working', () => {
  it.each([ascii(200), emoji76, 'short'])('does not apply new-password rules to an existing password', async password => {
    await mount(<AccountForms />)
    await type('#account-signin-email', 'old@example.com')
    await type('#account-signin-password', password)
    await submit()
    expect(auth.authenticate).toHaveBeenCalledWith('signin', { email: 'old@example.com', password })
    expect(container.textContent).not.toContain('too long')
  })
})

describe('password reset', () => {
  async function reset(password: string) {
    history.replaceState(null, '', '/reset-password?token=raw-reset-token')
    captureResetToken()
    await mount(<ResetPassword onSignIn={vi.fn()} onRequestNewLink={vi.fn()} />)
    await type('#reset-password-new', password)
    await type('#reset-password-confirm', password)
    await submit()
  }

  it('tells the customer about the byte limit through the field description', async () => {
    await reset('')
    const requirements = document.getElementById(input('#reset-password-new').getAttribute('aria-describedby')!.split(' ')[0])!
    expect(requirements.textContent).toContain('up to 72 bytes')
  })

  it.each([ascii(73), multibyte73, emoji76])('never submits a new password over 72 bytes and links the error to the field', async password => {
    await reset(password)
    const field = input('#reset-password-new')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')!.split(' ')).toEqual(['reset-password-requirements', 'reset-password-error'])
    expect(document.getElementById('reset-password-error')!.textContent).toBe(PASSWORD_TOO_LONG_MESSAGE)
    expect(document.activeElement).toBe(field)
  })

  it.each([ascii(72), multibyte72, emoji72])('submits a new password of exactly 72 bytes unchanged', async password => {
    await reset(password)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/reset-password')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'raw-reset-token', newPassword: password })
    expect(container.textContent).toContain('Your password has been changed.')
  })
})
