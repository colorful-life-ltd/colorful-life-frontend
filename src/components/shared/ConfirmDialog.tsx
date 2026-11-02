import { useEffect, useId, useRef, type ReactNode } from 'react'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  title: string
  /** Explains what will happen; announced as the dialog description. */
  children: ReactNode
  confirmLabel: string
  busyLabel: string
  cancelLabel?: string
  busy?: boolean
  /** Shown inside the dialog and announced; the dialog stays open so the action can be retried. */
  error?: string
  onConfirm: () => void
  onCancel: () => void
  /** Where focus goes on close if the opener no longer exists or is disabled (e.g. a deleted row's button). */
  fallbackFocus?: () => HTMLElement | null
}

/**
 * Small branded confirmation built on the native modal <dialog> (top layer, inert background).
 * Focus starts on Cancel, Tab stays inside, Escape cancels, and focus returns to the opener.
 * While busy both buttons are aria-disabled (not disabled) so keyboard focus is never dropped,
 * and Escape is ignored. The caller owns the action and its state.
 */
export function ConfirmDialog({ title, children, confirmLabel, busyLabel, cancelLabel = 'Cancel', busy = false, error, onConfirm, onCancel, fallbackFocus }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const fallbackRef = useRef(fallbackFocus)
  useEffect(() => { fallbackRef.current = fallbackFocus }, [fallbackFocus])
  const titleId = useId(), descriptionId = useId(), errorId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal()
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      if (dialog?.open) dialog.close()
      const target = opener?.isConnected && !(opener as HTMLButtonElement).disabled ? opener : fallbackRef.current?.()
      target?.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={dialogRef} className="confirm-dialog" aria-modal="true" aria-labelledby={titleId}
    aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}
    onKeyDown={event => {
      // An enclosing modal (e.g. My Account) also listens for Escape; only this top-layer dialog may react.
      event.stopPropagation()
      if (event.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <h2 id={titleId}>{title}</h2>
    <div className="confirm-dialog__body" id={descriptionId}>{children}</div>
    {error && <p className="confirm-dialog__error" id={errorId} role="alert">{error}</p>}
    <div className="confirm-dialog__actions">
      <button ref={cancelRef} type="button" className="confirm-dialog__cancel" aria-disabled={busy} onClick={() => { if (!busy) onCancel() }}>{cancelLabel}</button>
      <button type="button" className="confirm-dialog__confirm" aria-disabled={busy} aria-busy={busy} onClick={() => { if (!busy) onConfirm() }}>{busy ? busyLabel : confirmLabel}</button>
    </div>
  </dialog>
}
