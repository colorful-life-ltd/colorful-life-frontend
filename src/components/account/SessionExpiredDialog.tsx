import { useEffect, useId, useRef } from 'react'
import '../shared/ConfirmDialog.css'

const title = 'Your session has expired'
const message = 'Your session has expired or is no longer available. Please sign in again to continue.'

export function SessionExpiredDialog({ onConfirm }: { onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    okRef.current?.focus({ preventScroll: true })
    return () => { if (dialog?.open) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open') } }
  }, [])

  return <dialog ref={dialogRef} className="confirm-dialog session-expired-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" aria-describedby={descriptionId}
    onCancel={event => event.preventDefault()}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()
      if (event.key === 'Tab') { event.preventDefault(); okRef.current?.focus() }
    }}>
    <h2 id="session-expired-title">{title}</h2>
    <div className="confirm-dialog__body" id={descriptionId} aria-live="assertive">{message}</div>
    <div className="confirm-dialog__actions session-expired-dialog__actions">
      <button ref={okRef} type="button" className="confirm-dialog__confirm" onClick={onConfirm}>OK</button>
    </div>
  </dialog>
}
