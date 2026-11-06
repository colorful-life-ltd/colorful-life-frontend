import { useEffect, useId, useRef } from 'react'
import sprig from '../../assets/account/account-hub-card-sprig.png'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../cart/RemoveItemDialog.css'
import './RegistrationClosedDialog.css'

/**
 * Temporary pre-launch notice shown instead of the signup form while registration is closed.
 * Close/Escape dismiss only this notice; Continue Exploring may also leave the account overlay.
 */
export function RegistrationClosedDialog({ onClose, onContinue = onClose }: { onClose: () => void; onContinue?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    continueRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={dialogRef} className="remove-item-dialog registration-closed-dialog" aria-modal="true"
    aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      // The Account modal underneath also closes on Escape; only this top-layer dialog may react.
      event.stopPropagation()
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
        const first = controls?.[0], last = controls?.[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
    <button className="registration-closed-dialog__close" type="button" aria-label="Close announcement" onClick={onClose}>×</button>
    <img className="remove-item-dialog__sprig remove-item-dialog__sprig--top" src={sprig} alt="" aria-hidden="true" />
    <img className="remove-item-dialog__sprig remove-item-dialog__sprig--bottom" src={sprig} alt="" aria-hidden="true" />
    <h2 id={titleId}>We’re Opening Soon!{'\u00a0'}<span aria-hidden="true">🌼</span></h2>
    <div className="remove-item-dialog__divider"><BotanicalDivider /></div>
    <div className="registration-closed-dialog__message" id={descriptionId}>
      <p>We’re putting the finishing touches on our little world. In the meantime, feel free to explore and browse our collection.</p>
      <p>Thank you for your interest and patience — we can’t wait to welcome you!</p>
    </div>
    <div className="remove-item-dialog__actions registration-closed-dialog__actions">
      <button ref={continueRef} className="remove-item-dialog__keep" type="button" onClick={onContinue}>Continue Exploring</button>
    </div>
  </dialog>
}
