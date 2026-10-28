import { useState } from 'react'
import { AuthApiError } from '../../features/auth/api'
import { deleteMyAccount } from '../../features/account/privacyApi'
import { COMPANY } from '../../features/legal/company'

const failure = (reason: unknown) => reason instanceof AuthApiError && reason.status === 403
  ? 'That password is not correct.' : 'Something went wrong. Please try again, or email us.'

/** Data-access requests by email; account deletion requires the password again. */
export function YourData({ token, onDeleted }: { token: string; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState<'delete' | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const remove = async () => {
    if (!password || !confirmDelete || busy) return
    setBusy('delete'); setMessage(null)
    try { await deleteMyAccount(token, password); onDeleted() }
    catch (reason) { setMessage({ text: failure(reason), error: true }); setBusy(null) }
  }

  return <section className="my-account__panel your-data" aria-labelledby="your-data-title">
    <header className="my-account__section-heading"><div><h3 id="your-data-title">Your data</h3>
      <p>To request access to or a copy of your personal data, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. You can also delete your account below. See our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p></div></header>
    {message && <p className={message.error ? 'my-account__error' : 'your-data__status'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    <div>
      <label className="my-account__field">Confirm your password
        <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
      </label>
    </div>
    <div className="your-data__delete">
      <p>Deleting your account removes saved addresses and clears your profile details. You will no longer be able to sign in. Necessary order, payment and invoice records are retained as explained in our Privacy Policy. This cannot be undone.</p>
      <label className="your-data__confirm"><input type="checkbox" checked={confirmDelete} onChange={event => setConfirmDelete(event.target.checked)} /> I understand and want to delete my account</label>
      <button className="my-account__button" type="button" onClick={() => void remove()} disabled={!password || !confirmDelete || busy !== null}>{busy === 'delete' ? 'Deleting…' : 'Delete my account'}</button>
    </div>
  </section>
}
