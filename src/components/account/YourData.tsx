import { useState, type FormEvent } from 'react'
import { AuthApiError } from '../../features/auth/api'
import { deleteMyAccount, downloadBlob, exportMyData } from '../../features/account/privacyApi'

const failure = (reason: unknown) => reason instanceof AuthApiError && reason.status === 403
  ? 'That password is not correct.' : 'Something went wrong. Please try again, or email us.'

/** Download a copy of personal data, or delete the account. Both require the password again. */
export function YourData({ token, onDeleted }: { token: string; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const download = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || busy) return
    setBusy('export'); setMessage(null)
    try {
      const blob = await exportMyData(token, password)
      downloadBlob(blob, `build-and-bloom-personal-data-${new Date().toISOString().slice(0, 10)}.json`)
      setMessage({ text: 'Your data has been downloaded.', error: false }); setPassword('')
    } catch (reason) { setMessage({ text: failure(reason), error: true }) }
    finally { setBusy(null) }
  }
  const remove = async () => {
    if (!password || !confirmDelete || busy) return
    setBusy('delete'); setMessage(null)
    try { await deleteMyAccount(token, password); onDeleted() }
    catch (reason) { setMessage({ text: failure(reason), error: true }); setBusy(null) }
  }

  return <section className="my-account__panel your-data" aria-labelledby="your-data-title">
    <header className="my-account__section-heading"><div><h3 id="your-data-title">Your data</h3>
      <p>Download a copy of your personal data, or delete your account. See our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p></div></header>
    {message && <p className={message.error ? 'my-account__error' : 'your-data__status'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    <form onSubmit={download}>
      <label className="my-account__field">Confirm your password
        <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <div className="account-personal-information__actions">
        <button className="my-account__button my-account__button--primary" type="submit" disabled={!password || busy !== null}>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button>
      </div>
    </form>
    <div className="your-data__delete">
      <p>Deleting your account removes your account details, saved addresses and basket, and signs you out everywhere. Order and invoice records are kept for the period our Privacy Policy states because the law requires it. Your email address and name are removed from them as described there. This cannot be undone.</p>
      <label className="your-data__confirm"><input type="checkbox" checked={confirmDelete} onChange={event => setConfirmDelete(event.target.checked)} /> I understand and want to delete my account</label>
      <button className="my-account__button" type="button" onClick={() => void remove()} disabled={!password || !confirmDelete || busy !== null}>{busy === 'delete' ? 'Deleting…' : 'Delete my account'}</button>
    </div>
  </section>
}
