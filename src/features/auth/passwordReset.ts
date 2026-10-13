import { AuthApiError, requestJson } from './api'

export const RESET_PASSWORD_PATH = '/reset-password'
/** One rule for capture and routing, so `/reset-password/` never loses its token. */
export const isResetPasswordPath = (pathname: string) => pathname.replace(/\/+$/, '') === RESET_PASSWORD_PATH
const INVALID_TOKEN_MESSAGE = 'Invalid or expired password reset token'

/** Mirrors the backend password policy for new passwords (signup and reset), so rejections never reach the API. */
export const passwordRules = [
  [/^.{8,}$/, 'at least 8 characters'],
  [/[a-z]/, 'a lowercase letter'],
  [/[A-Z]/, 'an uppercase letter'],
  [/[0-9]/, 'a digit'],
  [/[^A-Za-z0-9]/, 'a special character'],
] as const


/** The backend's bcrypt-safe limit, measured in UTF-8 bytes rather than JavaScript string length. */
export const MAX_PASSWORD_BYTES = 72
export const PASSWORD_TOO_LONG_MESSAGE = `Your password is too long. Use ${MAX_PASSWORD_BYTES} bytes or fewer (accented letters, symbols and emoji count as more than one).`
const utf8 = new TextEncoder()
export const passwordByteLength = (password: string) => utf8.encode(password).length

/** Validates a new password only. Existing-password sign-in is never limited, for older accounts. */
export function passwordPolicyError(password: string): string | undefined {
  const failedRule = passwordRules.find(([rule]) => !rule.test(password))?.[1]
  if (failedRule) return `Your password needs ${failedRule}.`
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) return PASSWORD_TOO_LONG_MESSAGE
  return undefined
}

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

/**
 * A courtesy pause between reset emails, kept in memory for this tab only. It
 * is not a security control: the backend's shared rate limits are authoritative.
 */
export const RESET_REQUEST_COOLDOWN_SECONDS = 60
let resetRequestCooldownUntil = 0
export function startResetRequestCooldown(now = Date.now()) { resetRequestCooldownUntil = now + RESET_REQUEST_COOLDOWN_SECONDS * 1000 }
export const resetRequestCooldownSeconds = (now = Date.now()) => Math.max(0, Math.ceil((resetRequestCooldownUntil - now) / 1000))
export function clearResetRequestCooldown() { resetRequestCooldownUntil = 0 }

/** The backend answers identically whether or not the account exists. */
export function requestPasswordReset(email: string) {
  return requestJson<unknown>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) })
}

export function submitPasswordReset(token: string, newPassword: string) {
  return requestJson<unknown>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) })
}

export const isInvalidResetToken = (error: unknown) =>
  error instanceof AuthApiError && error.status === 400 && error.serverMessage === INVALID_TOKEN_MESSAGE
