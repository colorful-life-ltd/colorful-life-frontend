import { useRef, useState, type FormEvent } from 'react'
import { AuthApiError } from '../../features/auth/api'
import { capturedResetToken, forgetResetToken, isInvalidResetToken, passwordRuleFailure, submitPasswordReset } from '../../features/auth/passwordReset'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../checkout/Checkout.css'
import './AccountExperience.css'

type Phase = 'editing' | 'saving' | 'success' | 'invalid' | 'missing'
const NEW_ID = 'reset-password-new'
const CONFIRM_ID = 'reset-password-confirm'
const REQUIREMENTS_ID = 'reset-password-requirements'
const ERROR_ID = 'reset-password-error'

/** The token was captured into memory and removed from the URL before React started. */
export function ResetPassword({ onSignIn, onRequestNewLink }: { onSignIn: () => void; onRequestNewLink: () => void }) {
  const [token] = useState(capturedResetToken)
  const [phase, setPhase] = useState<Phase>(token ? 'editing' : 'missing')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  // Field errors are linked to the input they describe; request failures are page-level.
  const [error, setError] = useState<{ message: string; field?: typeof NEW_ID | typeof CONFIRM_ID }>()
  const saving = useRef(false)
  const fieldError = (field: typeof NEW_ID | typeof CONFIRM_ID, message: string) => {
    setError({ message, field })
    document.getElementById(field)?.focus()
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving.current) return
    const failedRule = passwordRuleFailure(password)
    if (failedRule) return fieldError(NEW_ID, `Your password needs ${failedRule}.`)
    if (password !== confirmation) return fieldError(CONFIRM_ID, 'Your passwords do not match.')
    saving.current = true
    setError(undefined)
    setPhase('saving')
    try {
      await submitPasswordReset(token, password)
      forgetResetToken()
      setPassword(''); setConfirmation('')
      setPhase('success')
    } catch (reason) {
      if (isInvalidResetToken(reason)) {
        forgetResetToken()
        setPhase('invalid')
        return
      }
      setPhase('editing')
      if (reason instanceof AuthApiError && reason.status === 400) fieldError(NEW_ID, 'That password was not accepted. Please choose a different password.')
      else setError({ message: reason instanceof AuthApiError && reason.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : 'We couldn’t update your password. Check your connection and try again.' })
    } finally {
      saving.current = false
    }
  }
  const title = phase === 'success' ? 'Password updated' : phase === 'invalid' || phase === 'missing' ? 'Reset link unavailable' : 'Choose a new password'
  return <main className="checkout reset-password" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p><h1>{title}</h1>
    {phase === 'success' && <>
      <p role="status">Your password has been changed. Please sign in with your new password.</p>
      <button onClick={onSignIn}>Sign in</button>
    </>}
    {phase === 'missing' && <p role="alert">This page needs the complete link from your password reset email. Open the link again, or request a new one.</p>}
    {phase === 'invalid' && <p role="alert">This reset link is invalid, has expired, or has already been used.</p>}
    {(phase === 'missing' || phase === 'invalid') && <button onClick={onRequestNewLink}>Request a new link</button>}
    {(phase === 'editing' || phase === 'saving') && <>
      <p id={REQUIREMENTS_ID}>Your new password needs at least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character.</p>
      {error && <p id={ERROR_ID} className="account-form__message account-form__message--error" role="alert">{error.message}</p>}
      <form className="account-form" aria-label="Choose a new password" onSubmit={submit} noValidate>
        <div className="account-form__fields">
          {([[NEW_ID, 'New password', password, setPassword], [CONFIRM_ID, 'Confirm new password', confirmation, setConfirmation]] as const).map(([id, label, value, setValue]) =>
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
        <button className="account-form__submit" type="submit" disabled={phase === 'saving'}>{phase === 'saving' ? 'Please wait…' : 'Update password'}</button>
      </form>
    </>}
    <BotanicalDivider />
  </div></main>
}
