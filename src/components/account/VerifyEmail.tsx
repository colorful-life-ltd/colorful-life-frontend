import { useRef, useState, type FormEvent } from 'react'
import { AuthApiError, verifyEmail } from '../../features/auth/api'
import { MAX_PASSWORD_BYTES, passwordPolicyError } from '../../features/auth/passwordReset'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import { ResendVerificationForm } from './ResendVerificationForm'
import { captureVerificationToken, capturedVerificationToken, forgetVerificationToken } from '../../features/auth/verificationToken'
import '../checkout/Checkout.css'
import './AccountExperience.css'

type Phase = 'ready' | 'verifying' | 'success' | 'invalid' | 'failure' | 'missing'
const NEW_ID = 'verify-email-password'
const CONFIRM_ID = 'verify-email-confirm'
const REQUIREMENTS_ID = 'verify-email-requirements'
const ERROR_ID = 'verify-email-error'

/**
 * The emailed link proves ownership of the address; the customer chooses their password here, once.
 * Same layout and controls as the password reset page. The token stays in memory only.
 */
export function VerifyEmail({ onSignIn }: { onSignIn: () => void }) {
  const [token] = useState(() => { captureVerificationToken(); return capturedVerificationToken() })
  const [phase, setPhase] = useState<Phase>(token ? 'ready' : 'missing')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<{ message: string; field?: typeof NEW_ID | typeof CONFIRM_ID }>()
  const lock = useRef(false)
  const fieldError = (field: typeof NEW_ID | typeof CONFIRM_ID, message: string) => {
    setError({ message, field })
    document.getElementById(field)?.focus()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const problem = passwordPolicyError(password)
    if (problem) return fieldError(NEW_ID, problem)
    if (password !== confirmation) return fieldError(CONFIRM_ID, 'Passwords do not match.')
    lock.current = true; setError(undefined); setPhase('verifying')
    try {
      await verifyEmail(token, password)
      forgetVerificationToken(); setPassword(''); setConfirmation(''); setPhase('success')
    } catch (reason) {
      if (reason instanceof AuthApiError && reason.status === 400) { forgetVerificationToken(); setPhase('invalid'); return }
      setPhase('failure')
      setError({ message: reason instanceof AuthApiError && reason.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : 'We could not confirm verification. Please try again.' })
    } finally { lock.current = false }
  }
  const editing = phase === 'ready' || phase === 'verifying' || phase === 'failure'
  const title = phase === 'success' ? 'Email verified' : phase === 'invalid' || phase === 'missing' ? 'Verification link unavailable' : 'Choose your password'
  return <main className="checkout reset-password" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p><h1>{title}</h1>
    {phase === 'success' && <>
      <p role="status">Your email has been verified and your password is set. You can now sign in to your Build &amp; Bloom account.</p>
      <button onClick={onSignIn}>Sign in</button>
    </>}
    {phase === 'missing' && <p role="alert">This link has no verification token. Open the complete link from your email, or request a new verification email.</p>}
    {phase === 'invalid' && <p role="alert">This verification link is invalid, expired, or already used.</p>}
    {(phase === 'invalid' || phase === 'missing') && <ResendVerificationForm />}
    {editing && <>
      <p>Choose a password to finish verifying your email and create your account.</p>
      <p id={REQUIREMENTS_ID}>Your password needs at least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character. It can be up to {MAX_PASSWORD_BYTES} bytes long; accented letters, symbols and emoji use more than one byte.</p>
      {error && <p id={ERROR_ID} className="account-form__message account-form__message--error" role="alert">{error.message}</p>}
      <form className="account-form" aria-label="Choose your password" onSubmit={event => void submit(event)} noValidate>
        <div className="account-form__fields">
          {([[NEW_ID, 'Password', password, setPassword], [CONFIRM_ID, 'Confirm password', confirmation, setConfirmation]] as const).map(([id, label, value, setValue]) =>
            <div key={id} className="account-form__field">
              <label htmlFor={id}>{label}</label>
              <span className="account-form__input-wrap">
                <input id={id} type={visible ? 'text' : 'password'} autoComplete="new-password" value={value}
                  aria-invalid={error?.field === id || undefined}
                  aria-describedby={[id === NEW_ID ? REQUIREMENTS_ID : '', error?.field === id ? ERROR_ID : ''].filter(Boolean).join(' ') || undefined}
                  onChange={event => { setError(undefined); setValue(event.target.value) }} />
              </span>
            </div>)}
        </div>
        <label className="reset-password__show"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} /> Show passwords</label>
        <button className="account-form__submit" type="submit" disabled={phase === 'verifying'}>{phase === 'verifying' ? 'Verifying…' : 'Verify and set password'}</button>
      </form>
    </>}
    <BotanicalDivider />
  </div></main>
}
