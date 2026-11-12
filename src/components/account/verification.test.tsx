// @vitest-environment jsdom
import { act, StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, AuthApiError, getCurrentUser, resendVerification, signIn, signUp, verifyEmail } from '../../features/auth/api'
import { VerifyEmail } from './VerifyEmail'
import { VerificationNotice } from './VerificationNotice'
import { AccountForms } from './AccountForms'
import { AccountModal } from '../homepage/AccountModal'
// These flows exercise activated customer accounts; the closed (Opening Soon) state is covered in RegistrationClosedDialog.test.tsx.
vi.mock('../../features/checkout/sandbox', async original => ({ ...await original<typeof import('../../features/checkout/sandbox')>(), registrationAvailable: true }))

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn(), verifyEmail: vi.fn(), resendVerification: vi.fn(), signIn: vi.fn(), signUp: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
const user = { id: 1, email: 'test@example.com', firstName: 'Test', lastName: null, phone: null }
const verificationError = () => new AuthApiError(403, 'Verify', 'Different backend wording', 'EMAIL_VERIFICATION_REQUIRED')
function Capture() { const value = useAuth(); useEffect(() => { auth = value }, [value]); return <p data-auth>{value.state.status}</p> }
async function mount(element: ReactNode, strict = false) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const content = <AuthProvider><Capture />{element}</AuthProvider>
  await act(async () => root!.render(strict ? <StrictMode>{content}</StrictMode> : content))
}
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text)); if (!button) throw new Error(`Missing button ${text}`); button.click() }) }
async function enterResendEmail() { await act(async () => { const input=container.querySelector<HTMLInputElement>('input[type="email"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input,user.email); input.dispatchEvent(new Event('input',{bubbles:true})) }) }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/verify-email?token=test-verification-token')
  vi.mocked(getCurrentUser).mockResolvedValue(user); vi.mocked(verifyEmail).mockResolvedValue(); vi.mocked(resendVerification).mockResolvedValue()
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('verification route and token handling', () => {
  async function enterPasswords(first = 'SecurePass1!', second = first) {
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]')
    await act(async () => { for (const [index, value] of [first, second].entries()) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inputs[index], value)
      inputs[index].dispatchEvent(new Event('input', { bubbles: true }))
    } })
  }
  it('removes the token and requires a mailbox holder to choose a password', async () => {
    await mount(<VerifyEmail onSignIn={vi.fn()} />, true)
    expect(location.search).toBe(''); expect(verifyEmail).not.toHaveBeenCalled()
    expect(JSON.stringify(sessionStorage)).not.toContain('test-verification-token')
    await enterPasswords(); await click('Verify and set password')
    expect(verifyEmail).toHaveBeenCalledExactlyOnceWith('test-verification-token', 'SecurePass1!')
    expect(container.textContent).toContain('Your email has been verified')
  })
  it('rejects mismatched passwords locally', async () => {
    await mount(<VerifyEmail onSignIn={vi.fn()} />); await enterPasswords('SecurePass1!', 'Different1!')
    await click('Verify and set password'); expect(verifyEmail).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Passwords do not match')
  })
  it('blocks duplicate submits while the verification request is pending', async () => {
    vi.mocked(verifyEmail).mockImplementation(() => new Promise(() => {}))
    await mount(<VerifyEmail onSignIn={vi.fn()} />); await enterPasswords(); await click('Verify and set password')
    expect(container.textContent).toContain('Verifying'); expect(verifyEmail).toHaveBeenCalledOnce()
  })
  it.each(['/verify-email', '/verify-email?token=%20'])('does not submit a missing token at %s', async path => {
    history.replaceState({}, '', path); await mount(<VerifyEmail onSignIn={vi.fn()} />)
    expect(container.textContent).toContain('no verification token'); expect(verifyEmail).not.toHaveBeenCalled()
  })
  it('does not expose server details for an invalid token', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(new AuthApiError(400, 'private details'))
    await mount(<VerifyEmail onSignIn={vi.fn()} />); await enterPasswords(); await click('Verify and set password')
    expect(container.textContent).toContain('invalid, expired, or already used'); expect(container.textContent).not.toContain('private details')
  })
  it('offers a retry after a network error without putting the token in the URL', async () => {
    vi.mocked(verifyEmail).mockRejectedValueOnce(new Error('offline')).mockResolvedValue()
    await mount(<VerifyEmail onSignIn={vi.fn()} />); await enterPasswords(); await click('Verify and set password')
    expect(container.textContent).toContain('could not confirm'); expect(location.search).toBe('')
    await click('Verify and set password'); expect(verifyEmail).toHaveBeenCalledTimes(2)
  })
})

describe('unverified account and resend UX', () => {
  it('recognizes verification by code on session restoration rather than English text', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountForms />)
    expect(auth.state).toMatchObject({ status: 'verificationRequired', token: 'jwt' }); expect(container.textContent).toContain('Resend verification email'); expect(container.querySelector('form')).toBeNull()
  })
  it('shows a generic verification prompt without storing a session after signup', async () => {
    vi.mocked(signUp).mockResolvedValue()
    await mount(<AccountForms />)
    await act(async () => auth.authenticate('signup', { email: 'test@example.com', password: 'Abcdef1!' }))
    expect(container.textContent).toContain('If registration is available')
    expect(auth.state.status).toBe('verificationPending')
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(getCurrentUser).not.toHaveBeenCalled()
  })
  it('allows login for an unverified account and later rechecks its actual profile', async () => {
    vi.mocked(signIn).mockResolvedValue({ token: 'jwt' }); vi.mocked(getCurrentUser).mockRejectedValueOnce(verificationError()).mockResolvedValue(user)
    await mount(<AccountForms />); await act(async () => auth.authenticate('signin', { email: user.email, password: 'Abcdef1!' }))
    expect(auth.state.status).toBe('verificationRequired'); await click('I’ve verified'); expect(auth.state.status).toBe('authenticated')
  })
  it('blocks duplicate resend clicks, reports sending/success and enforces a cooldown', async () => {
    vi.useFakeTimers(); let finish!: () => void
    vi.mocked(resendVerification).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(<VerificationNotice token="jwt" />)
    await enterResendEmail()
    await click('Resend verification'); await click('Sending verification')
    expect(resendVerification).toHaveBeenCalledExactlyOnceWith(user.email); expect(container.textContent).toContain('Sending verification email')
    await act(async () => finish()); expect(container.textContent).toContain('Check your inbox and spam folder'); expect(container.textContent).toContain('Resend available shortly')
    await act(async () => vi.advanceTimersByTimeAsync(30000)); expect(container.textContent).toContain('Resend verification email')
  })
  it('reports resend failure without exposing internal errors', async () => {
    vi.mocked(resendVerification).mockRejectedValue(new Error('SES/internal error'))
    await mount(<VerificationNotice token="jwt" />); await enterResendEmail(); await click('Resend verification')
    expect(container.textContent).toContain('Unable to complete'); expect(container.textContent).not.toContain('SES/internal')
  })
  it('keeps the compact modal labelled and its sign-out action working', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountModal onClose={vi.fn()} />)
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.account-modal__surface--verification')).not.toBeNull()
    const notice = container.querySelector('.verification-notice')!
    expect(document.getElementById(notice.getAttribute('aria-labelledby')!)?.textContent).toBe('Verify your email')
    expect(notice.querySelectorAll('.verification-notice__actions button')).toHaveLength(2)
    expect(notice.querySelector('.verification-notice__signout')?.textContent).toBe('Sign out')
    await click('Sign out'); expect(auth.state.status).toBe('signedOut'); expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
  it('cannot declare verification complete while the backend still rejects the profile', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountForms />); await click('I’ve verified')
    expect(auth.state.status).toBe('verificationRequired'); expect(container.textContent).toContain('not ready yet')
  })
})
