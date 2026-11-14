import { useId, useRef, useState, type FormEvent } from 'react'
import { AuthApiError } from '../../features/auth/api'
import { deleteMyAccount } from '../../features/account/privacyApi'
import { COMPANY } from '../../features/legal/company'
import { ConfirmDialog } from '../shared/ConfirmDialog'

const failure = (reason: unknown) => reason instanceof AuthApiError && reason.status === 403 ? 'That password is not correct.'
  : reason instanceof AuthApiError && reason.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
    : 'Something went wrong. Please try again, or email us.'

/**
 * A discreet account-settings row: data-access requests by email, and account deletion behind the
 * shared confirmation dialog. Deletion needs the password again and an explicit acknowledgement;
 * nothing is sent until both are present, and cancelling never sends a request.
 */
export function DeleteAccount({ token, onDeleted }: { token: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const sending = useRef(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const passwordId = useId()
  const ready = password.length > 0 && acknowledged

  const reset = () => { setPassword(''); setAcknowledged(false); setError(undefined) }
  const cancel = () => { if (sending.current) return; reset(); setOpen(false) }
  const confirm = async () => {
    if (!ready || sending.current) return
    sending.current = true; setBusy(true); setError(undefined)
    try { await deleteMyAccount(token, password); onDeleted() }
    catch (reason) {
      setError(`${failure(reason)} Nothing was deleted.`)
      if (reason instanceof AuthApiError && reason.status === 403) { setPassword(''); window.setTimeout(() => passwordRef.current?.focus(), 0) }
    } finally { sending.current = false; setBusy(false) }
  }
  // Enter in the password field uses the same guarded action as the Delete account button.
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void confirm() }

  return <div className="my-account__settings">
    <p>To request access to or a copy of your personal data, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. See our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>
    <button ref={openerRef} className="my-account__button" type="button" onClick={() => { reset(); setOpen(true) }}>Delete account</button>
    {open && <ConfirmDialog title="Delete your account?" confirmLabel="Delete account" busyLabel="Deleting…" busy={busy} confirmDisabled={!ready}
      error={error} onConfirm={() => void confirm()} onCancel={cancel} fallbackFocus={() => openerRef.current}>
      <p>Deleting your account removes saved addresses and clears your profile details. You will no longer be able to sign in. Necessary order, payment and invoice records are retained as explained in our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>. This cannot be undone.</p>
      <form className="delete-account__form" aria-label="Confirm account deletion" onSubmit={submit}>
        <div className="my-account__field">
          <label htmlFor={passwordId}>Confirm your password</label>
          <input ref={passwordRef} id={passwordId} type="password" autoComplete="current-password" value={password} disabled={busy}
            onChange={event => { setPassword(event.target.value); setError(undefined) }} />
        </div>
        <label className="delete-account__confirm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /> I understand and want to delete my account</label>
      </form>
    </ConfirmDialog>}
  </div>
}
