// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionExpiredDialog } from './SessionExpiredDialog'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = '' })

describe('session expiry alert dialog', () => {
  it('shows the approved message, has one focused OK button and traps Tab', async () => {
    await act(async () => root.render(<SessionExpiredDialog onConfirm={vi.fn()} />))
    const dialog = container.querySelector('dialog')!
    const ok = container.querySelector('button')!
    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(ok.textContent).toBe('OK')
    expect(document.activeElement).toBe(ok)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    dialog.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(ok)
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    dialog.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
  })
  it('cannot be cancelled by the native dialog cancel event', async () => {
    await act(async () => root.render(<SessionExpiredDialog onConfirm={vi.fn()} />))
    const dialog = container.querySelector('dialog')!
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    dialog.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
  })
})
