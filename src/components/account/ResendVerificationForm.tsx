import { useRef, useState, type FormEvent } from 'react'
import { requestVerification } from '../../features/auth/api'

export function ResendVerificationForm({ initialEmail = '', onBack }: { initialEmail?: string; onBack?: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
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
  return <section aria-label="Request verification email">
    <h2>Request a verification email</h2>
    <form onSubmit={event => void submit(event)}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification email'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {onBack && <button type="button" onClick={onBack}>Back to sign in</button>}
  </section>
}
