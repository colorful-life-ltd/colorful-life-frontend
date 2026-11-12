import { useState } from 'react'
import { requestVerification } from '../../features/auth/api'
import { useAuth } from '../../features/auth/AuthProvider'

export function VerificationPending({ email }: { email: string }) {
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function resend() {
    if (busy) return
    setBusy(true); setMessage('')
    try { await requestVerification(email); setMessage('If verification is needed, check your email for next steps.') }
    catch { setMessage('Unable to request an email right now. Please try again later.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Email verification">
    <h2>Check your email</h2>
    <p>If registration is available for this address, check your email for next steps.</p>
    {message && <p role="status">{message}</p>}
    <button type="button" disabled={busy} onClick={() => void resend()}>{busy ? 'Sending…' : 'Resend verification email'}</button>
    <button type="button" onClick={logout}>Return to sign in</button>
  </section>
}
