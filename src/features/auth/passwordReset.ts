import { AuthApiError, requestJson } from './api'

export const RESET_PASSWORD_PATH = '/reset-password'
/** One rule for capture and routing, so `/reset-password/` never loses its token. */
export const isResetPasswordPath = (pathname: string) => pathname.replace(/\/+$/, '') === RESET_PASSWORD_PATH
const INVALID_TOKEN_MESSAGE = 'Invalid or expired password reset token'

/** Mirrors the backend password policy so most rejections never reach the API. */
export const passwordRules = [
  [/^.{8,}$/, 'at least 8 characters'],
  [/[a-z]/, 'a lowercase letter'],
  [/[A-Z]/, 'an uppercase letter'],
  [/[0-9]/, 'a digit'],
  [/[^A-Za-z0-9]/, 'a special character'],
] as const

export const passwordRuleFailure = (password: string) => passwordRules.find(([rule]) => !rule.test(password))?.[1]

let capturedToken = ''

/** Appends a new element: browsers apply the last inserted referrer policy, not attribute edits. */
function addPageMeta(name: string, content: string) {
  const meta = document.createElement('meta')
  meta.name = name
  meta.content = content
  document.head.appendChild(meta)
}

/**
 * Runs before React and before any module issues a request: the reset token is
 * moved into memory, removed from the address bar and history, and the page
 * sends no referrer. It is never written to browser storage.
 */
export function captureResetToken(win: Window = window) {
  if (!isResetPasswordPath(win.location.pathname)) return
  addPageMeta('referrer', 'no-referrer')
  addPageMeta('robots', 'noindex,nofollow')
  const url = new URL(win.location.href)
  if (!url.searchParams.has('token')) return
  capturedToken = url.searchParams.get('token')?.trim() ?? ''
  url.searchParams.delete('token')
  win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export const capturedResetToken = () => capturedToken
export function forgetResetToken() { capturedToken = '' }

/** The backend answers identically whether or not the account exists. */
export function requestPasswordReset(email: string) {
  return requestJson<unknown>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) })
}

export function submitPasswordReset(token: string, newPassword: string) {
  return requestJson<unknown>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) })
}

export const isInvalidResetToken = (error: unknown) =>
  error instanceof AuthApiError && error.status === 400 && error.serverMessage === INVALID_TOKEN_MESSAGE
