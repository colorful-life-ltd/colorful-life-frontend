// Tab-scoped credentials. Renewal is shared by authenticated reads, never by
// automatic replay of business mutations or by cross-tab synchronisation.
export const AUTH_STORAGE_KEY = 'colorful-life:storefront:jwt'
export const SESSION_STORAGE_KEY = 'colorful-life:storefront:session'
export const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export type Session = { token: string; refreshToken?: string; accessTokenExpiresAt?: string; refreshExpiresAt?: string }
export class SessionError extends Error {
  readonly invalid: boolean
  constructor(invalid = false) { super(invalid ? 'Your session has expired. Please sign in again.' : 'Unable to restore your session. Please try again.'); this.invalid = invalid }
}
let generation = 0
const listeners = new Set<() => void>()
const expiryListeners = new Set<() => void>()
const previousTokens = new Set<string>()
const retiredTokens = new Set<string>()
const retryableWriteAuthResponses = new WeakSet<Response>()
let expiryRequested = false
let paymentConfirmationDepth = 0
let expiryWaitingForPayment = false
let sessionStorageExpected = false
let knownCurrentToken: string | null = null
function retireSession() {
  const token = readStoredToken() ?? knownCurrentToken
  if (token) retiredTokens.add(token)
  previousTokens.forEach(value => retiredTokens.add(value))
}
let refreshing: Promise<string> | null = null
export const sessionGeneration = () => generation
// An explicit authentication intent supersedes already-running background work,
// even before its replacement credentials have arrived. Keep stored credentials
// until that intent succeeds; a temporary login failure is not a logout.
export function beginAuthenticationIntent() { generation += 1 }
export function subscribeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function subscribeExpiredSession(listener: () => void) { expiryListeners.add(listener); return () => { expiryListeners.delete(listener) } }
/** Defer auth teardown until Stripe's in-flight confirmation and status recovery settle. */
export function beginPaymentConfirmation() { paymentConfirmationDepth += 1 }
export const isSessionExpiryDeferred = () => expiryWaitingForPayment
export function endPaymentConfirmation() {
  paymentConfirmationDepth = Math.max(0, paymentConfirmationDepth - 1)
  if (!paymentConfirmationDepth && expiryWaitingForPayment) {
    expiryWaitingForPayment = false
    publishExpiredSession()
  }
}
export function requestExpiredSession() {
  if (expiryRequested) return
  expiryRequested = true
  if (paymentConfirmationDepth) { expiryWaitingForPayment = true; return }
  publishExpiredSession()
}
export const manualWriteRetryRequired = (response: Response) => retryableWriteAuthResponses.has(response)
function publishExpiredSession() { expiryListeners.forEach(listener => listener()) }
const notify = () => listeners.forEach(listener => listener())

export function readSession(): Session | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const value: unknown = JSON.parse(stored)
      const session = parseSession(value, true)
      knownCurrentToken = session.token
      sessionStorageExpected = true
      return session
    }
    const token = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (token) { knownCurrentToken = token; sessionStorageExpected = true }
    return token ? { token } : null
  } catch { return null }
}
export const readStoredToken = () => readSession()?.token ?? null
export function parseSession(value: unknown, renewable: boolean): Session {
  if (!value || typeof value !== 'object') throw new SessionError()
  const data = value as Record<string, unknown>
  if (typeof data.token !== 'string' || !data.token.trim()) throw new SessionError()
  if (!renewable) return { token: data.token }
  if (typeof data.refreshToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.refreshToken)
    || typeof data.accessTokenExpiresAt !== 'string' || !Number.isFinite(Date.parse(data.accessTokenExpiresAt))
    || typeof data.refreshExpiresAt !== 'string' || !Number.isFinite(Date.parse(data.refreshExpiresAt))) throw new SessionError()
  return { token: data.token, refreshToken: data.refreshToken, accessTokenExpiresAt: data.accessTokenExpiresAt, refreshExpiresAt: data.refreshExpiresAt }
}
export function clearStoredToken() {
  retireSession()
  generation += 1; refreshing = null; previousTokens.clear()
  for (const key of [SESSION_STORAGE_KEY, AUTH_STORAGE_KEY]) {
    try { window.sessionStorage.removeItem(key) } catch { /* UI cleanup must still complete. */ }
  }
  sessionStorageExpected = false
  knownCurrentToken = null
  notify()
}
export function storeToken(token: string) {
  retireSession()
  generation += 1; refreshing = null; previousTokens.clear()
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  sessionStorageExpected = true
  knownCurrentToken = token
  retiredTokens.delete(token)
  expiryRequested = false; expiryWaitingForPayment = false
}
export function storeSession(session: Session) {
  if (!session.refreshToken) { storeToken(session.token); return }
  const parsed = parseSession(session, true)
  retireSession()
  // One atomic storage record holds both sides of a rotating credential pair.
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed))
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorageExpected = true
  knownCurrentToken = parsed.token
  generation += 1; refreshing = null; previousTokens.clear()
  retiredTokens.delete(parsed.token)
  expiryRequested = false; expiryWaitingForPayment = false
}
async function revoke(refreshToken: string) {
  try {
    await fetch(`${apiBase()}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }), signal: AbortSignal.timeout(10000) })
  } catch { /* Explicit logout always clears local credentials. */ }
}
export function discardSession(session: Session) { if (session.refreshToken) void revoke(session.refreshToken) }
export function logoutSession() {
  const session = readSession()
  clearStoredToken()
  if (session?.refreshToken) void revoke(session.refreshToken)
}
async function renew(token: string): Promise<string> {
  const session = readSession()
  if (!session) {
    if (!retiredTokens.has(token)) requestExpiredSession()
    throw new SessionError(true)
  }
  if (!previousTokens.has(token) && session.token !== token) throw new SessionError(true)
  if (refreshing) return refreshing
  if (session.token !== token) return session.token
  const current = generation
  if (!session.refreshToken) {
    if (generation === current) { clearStoredToken(); requestExpiredSession() }
    throw new SessionError(true)
  }
  const operation = (async () => {
    let response: Response
    try {
      response = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }), signal: AbortSignal.timeout(10000) })
    } catch { throw new SessionError() }
    if (response.status === 401) {
      if (generation === current) { clearStoredToken(); requestExpiredSession() }
      throw new SessionError(true)
    }
    if (!response.ok) throw new SessionError()
    let replacement: Session
    try { replacement = parseSession(await response.json(), true) } catch { throw new SessionError() }
    if (generation !== current || readSession()?.token !== session.token) {
      // A logout/account replacement won. Revoke the rotated credential too,
      // even if revoking its old value raced after backend rotation.
      await revoke(replacement.refreshToken!)
      throw new SessionError(true)
    }
    try { window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(replacement)); window.sessionStorage.removeItem(AUTH_STORAGE_KEY) }
    catch { await revoke(replacement.refreshToken!); throw new SessionError() }
    previousTokens.add(session.token)
    knownCurrentToken = replacement.token
    notify()
    return replacement.token
  })()
  refreshing = operation
  try { return await operation } finally { if (refreshing === operation) refreshing = null }
}
export async function authenticatedFetch(url: string, init: RequestInit, token: string): Promise<Response> {
  const session = readSession()
  const ownsSession = !!session && (session.token === token || previousTokens.has(token))
  if (session && !ownsSession) throw new SessionError(true)
  if (!session && (sessionStorageExpected || retiredTokens.has(token))) {
    if (sessionStorageExpected && !retiredTokens.has(token)) requestExpiredSession()
    throw new SessionError(true)
  }
  const current = generation
  const activeToken = ownsSession && session ? session.token : token
  const send = (credential: string) => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${credential}`)
    const request = { ...init, signal: init.signal ?? AbortSignal.timeout(10000) }
    return fetch(url, new Headers(init.headers).get('Authorization') === 'Bearer ' + credential ? request : { ...request, headers })
  }
  const response = await send(activeToken)
  if (ownsSession && generation !== current) throw new SessionError(true)
  // Never automatically replay POST/PATCH/DELETE, particularly checkout/payment.
  if (response.status !== 401 || !ownsSession) return response
  const readOnly = ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())
  let renewed: string
  try { renewed = await renew(activeToken) } catch (error) {
    // Preserve the definite authentication rejection of a write. A renewal
    // outage must not turn it into an ambiguous business-request outcome.
    if (!readOnly) return response
    throw error
  }
  if (generation !== current) throw new SessionError(true)
  if (!readOnly) { retryableWriteAuthResponses.add(response); return response }
  const retried = await send(renewed)
  if (generation !== current) throw new SessionError(true)
  if (retried.status === 401) { clearStoredToken(); requestExpiredSession(); throw new SessionError(true) }
  return retried
}
