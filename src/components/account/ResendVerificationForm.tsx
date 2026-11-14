import { useId, useRef, useState, type FormEvent } from 'react'
import { requestVerification } from '../../features/auth/api'
import './AccountExperience.css'
import flower from '../../assets/decorations/catalogue-title-flower.png'

/**
 * Uses the account form controls (AccountExperience.css). Inside the Account modal (with a way back)
 * it takes the verification-notice card styling; on the verification page it inherits the page styles.
 */
export function ResendVerificationForm({ initialEmail = '', onBack }: { initialEmail?: string; onBack?: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const titleId = useId(), inputId = useId()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    locked.current = true; setBusy(true); setMessage('')
    try {
      await requestVerification(email.trim())
      setMessage('If verification is needed, check your email for next steps.')
    } catch { setMessage('Unable to request an email right now. Please try again later.') }
    finally { locked.current = false; setBusy(false) }
  }
  const inModal = Boolean(onBack)
  return <section className={inModal ? 'verification-notice' : undefined} aria-labelledby={titleId}>
    {inModal && <img className="account-experience__flower" src={flower} alt="" />}
    <h2 className={inModal ? 'verification-notice__title' : undefined} id={titleId}>Request a verification email</h2>
    <form className="account-form" aria-labelledby={titleId} onSubmit={event => void submit(event)}>
      <div className="account-form__fields">
        <div className="account-form__field account-form__field--email">
          <label htmlFor={inputId}>Email address</label>
          <span className="account-form__input-wrap">
            <input id={inputId} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} />
          </span>
        </div>
      </div>
      <button className="account-form__submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification email'}</button>
    </form>
    {message && <p className="account-form__message account-form__message--success" role="status">{message}</p>}
    {onBack && <button className="verification-notice__signout" type="button" onClick={onBack}>Back to sign in</button>}
  </section>
}
