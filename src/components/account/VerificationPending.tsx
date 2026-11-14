import { useEffect, useId, useRef, useState } from 'react'
import { requestVerification } from '../../features/auth/api'
import './AccountExperience.css'
import flower from '../../assets/decorations/catalogue-title-flower.png'

/** Shown after registration. Uses the Sandbox verification notice's markup and styles (AccountExperience.css). */
export function VerificationPending({ email, onReturnToSignIn }: { email: string; onReturnToSignIn: () => void }) {
  const titleId = useId()
  const title = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // The registration form was replaced: move focus to the new heading so it is announced.
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [])
  async function resend() {
    if (busy) return
    setBusy(true); setMessage('')
    try { await requestVerification(email); setMessage('If verification is needed, check your email for next steps.') }
    catch { setMessage('Unable to request an email right now. Please try again later.') }
    finally { setBusy(false) }
  }
  return <section className="verification-notice" aria-labelledby={titleId} aria-busy={busy}>
    <img className="account-experience__flower" src={flower} alt="" />
    <h2 ref={title} className="verification-notice__title" id={titleId} tabIndex={-1}>Check your email</h2>
    <p>If registration is available for this address, check your email for next steps.</p>
    <p className="verification-notice__guidance">Open the link in the email to choose your password and finish creating your account.</p>
    {message && <p role="status">{message}</p>}
    <div className="verification-notice__actions">
      <button className="account-form__submit" type="button" disabled={busy} onClick={() => void resend()}>{busy ? 'Sending…' : 'Resend verification email'}</button>
      <button className="verification-notice__continue" type="button" disabled={busy} onClick={onReturnToSignIn}>Return to sign in</button>
    </div>
  </section>
}
