import { authenticatedFetch, apiBase, manualWriteRetryRequired, parseSession, type Session } from './session'
export { AUTH_STORAGE_KEY, apiBase, clearStoredToken, readStoredToken, storeToken, storeSession } from './session'

export type CurrentUser = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
}

export class AuthApiError extends Error {
  readonly status: number
  readonly serverMessage?: string
  readonly code?: string

  constructor(status: number, message: string, serverMessage?: string, code?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.serverMessage = serverMessage
    this.code = code
  }
}

const SIGN_IN_PATH = '/auth/login'
export const SIGN_IN_MESSAGES = {
  invalidCredentials: 'Incorrect email or password.',
  rateLimited: 'Too many sign-in attempts. Please wait a minute and try again.',
  invalidInput: 'Enter a valid email address and password.',
  unavailable: 'Sign in is temporarily unavailable. Please try again later.',
} as const

/**
 * Sign-in failures are described by status only. Server text is never echoed (the shared
 * abuse limiter words its errors for checkout), and an unknown email is never distinguished
 * from a wrong password. A 403 carrying a JSON code (email verification) is handled by the caller.
 */
function signInFailure(status: number, code: string | undefined, serverMessage: string | undefined): string | undefined {
  if (status === 401) return SIGN_IN_MESSAGES.invalidCredentials
  if (status === 429) return SIGN_IN_MESSAGES.rateLimited
  if (status === 400) return SIGN_IN_MESSAGES.invalidInput
  // An edge HTML 403 (no JSON) or any server/gateway failure means the service is unreachable.
  if ((status === 403 && !code && !serverMessage) || status >= 500) return SIGN_IN_MESSAGES.unavailable
  return undefined
}

export async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const signingIn = !token && path === SIGN_IN_PATH
  let response: Response
  try {
    response = token ? await authenticatedFetch(`${apiBase()}${path}`, { ...init, headers }, token) : await fetch(`${apiBase()}${path}`, { ...init, headers })
  } catch (error) {
    // A network failure must not surface browser-specific text on the sign-in form.
    if (signingIn) throw new AuthApiError(0, SIGN_IN_MESSAGES.unavailable)
    throw error
  }
  let body: unknown = null
  try { body = await response.json() } catch { /* Empty error responses are handled below. */ }
  if (!response.ok) {
    const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined
    const nested = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : undefined
    const code = typeof nested?.code === 'string' ? nested.code : undefined
    const serverMessage = typeof error === 'string' ? error : typeof nested?.message === 'string' ? nested.message : undefined
    const message = code === 'EMAIL_VERIFICATION_REQUIRED' ? 'Email verification required' : manualWriteRetryRequired(response) ? 'Your session was refreshed. Please try that action again.' : (signingIn ? signInFailure(response.status, code, serverMessage) : undefined) ?? (response.status === 401 && !token ? "We couldn't sign you in with those details. Check your email and password and try again." : response.status === 409 && path === '/auth/signup' ? 'Email already in use' : serverMessage || 'Unable to complete that request')
    throw new AuthApiError(response.status, message, serverMessage, code)
  }
  return body as T
}

export function isVerificationRequired(error: unknown): boolean {
  return error instanceof AuthApiError && error.status === 403 && (error.code === 'EMAIL_VERIFICATION_REQUIRED' || (!error.code && error.serverMessage === 'Email verification required'))
}

export function verifyEmail(token: string) {
  return requestJson<void>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

export function resendVerification(token: string) {
  return requestJson<void>('/auth/resend-verification', { method: 'POST' }, token)
}

export async function signUp(email: string, password: string): Promise<Session> {
  return parseSession(await requestJson<unknown>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }), false)
}

export async function signIn(email: string, password: string): Promise<Session> {
  return parseSession(await requestJson<unknown>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }), true)
}

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const result = await requestJson<CurrentUser>('/users/me', { method: 'GET' }, token)
  if (!result || !Number.isSafeInteger(result.id) || result.id < 1 || typeof result.email !== 'string'
    || !['firstName', 'lastName', 'phone'].every(key => result[key as keyof CurrentUser] === null || typeof result[key as keyof CurrentUser] === 'string')) {
    throw new Error('Unable to read your account. Please try again.')
  }
  return result
}

export type UpdateCurrentUser = Partial<Pick<CurrentUser, 'firstName' | 'lastName' | 'phone'>>

export function updateCurrentUser(token: string, profile: UpdateCurrentUser) {
  return requestJson<CurrentUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  }, token)
}
