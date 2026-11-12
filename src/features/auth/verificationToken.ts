// Memory only: never persist a verification token in browser storage.
let captured = ''
let entry = 0

export function captureVerificationToken(win: Window = window) {
  if (win.location.pathname.replace(/\/+$/, '') !== '/verify-email') return
  const url = new URL(win.location.href)
  if (!url.searchParams.has('token')) return
  captured = url.searchParams.get('token')?.trim() ?? ''
  url.searchParams.delete('token')
  entry += 1
  const previous = win.history.state && typeof win.history.state === 'object' ? win.history.state : {}
  win.history.replaceState({ ...previous, bloomVerificationEntry: entry }, '', `${url.pathname}${url.search}${url.hash}`)
}
export const capturedVerificationToken = () => window.history.state?.bloomVerificationEntry === entry ? captured : ''
export function forgetVerificationToken() { captured = '' }
