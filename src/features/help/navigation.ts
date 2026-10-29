/** Reveal a known Help fragment after the book resets its own focus/scroll position. */
export function revealHelpHash(content: Element | null | undefined) {
  if (!content) return
  let id: string
  try { id = decodeURIComponent(window.location.hash.slice(1)) } catch { return }
  const target = [...content.querySelectorAll<HTMLElement>('[id]')].find(element => element.id === id)
  if (!target) return
  if (target instanceof HTMLDetailsElement) target.open = true
  const focus = target instanceof HTMLDetailsElement ? target.querySelector('summary') : target
  focus?.focus({ preventScroll: true })
  target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' })
}
