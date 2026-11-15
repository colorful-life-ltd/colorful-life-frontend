// One browser-wide credential record in localStorage (owner decision 2026-11-14: sign-in persists across
// tabs and browser restarts, within the unchanged server-side access/refresh lifetimes). Tabs observe each
// other through storage events; refresh rotation is serialised across tabs with the Web Locks API.
// Renewal is shared by authenticated reads, never by automatic replay of business mutations.
export const AUTH_STORAGE_KEY = 'colorful-life:storefront:jwt'
export const SESSION_STORAGE_KEY = 'colorful-life:storefront:session'
// Non-secret marker (a timestamp only) written by an explicit sign-out so other tabs sign out quietly
// instead of reporting an expired session.
export const SIGN_OUT_MARKER_KEY = 'colorful-life:storefront:signed-out'
const REFRESH_LOCK = 'colorful-life:storefront:refresh'
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
let expiryGeneration: number | null = null
let storedSessionExpected = false
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
export function subscribeSession(listener: () => void) { listenForOtherTabs(); ensureObserved(); listeners.add(listener); return () => { listeners.delete(listener) } }
export function subscribeExpiredSession(listener: () => void) { expiryListeners.add(listener); return () => { expiryListeners.delete(listener) } }
/** Defer auth teardown until Stripe's in-flight confirmation and status recovery settle. */
export function beginPaymentConfirmation() { paymentConfirmationDepth += 1 }
export const isSessionExpiryDeferred = () => expiryWaitingForPayment
export function endPaymentConfirmation() {
  paymentConfirmationDepth = Math.max(0, paymentConfirmationDepth - 1)
  if (!paymentConfirmationDepth && expiryWaitingForPayment) {
    expiryWaitingForPayment = false
    const requestedAt = expiryGeneration
    if (requestedAt === generation) publishExpiredSession()
    else { expiryRequested = false; expiryGeneration = null }
  }
}
export function requestExpiredSession() {
  if (expiryRequested) return
  expiryRequested = true
  expiryGeneration = generation
  if (paymentConfirmationDepth) { expiryWaitingForPayment = true; return }
  publishExpiredSession()
}
export const manualWriteRetryRequired = (response: Response) => retryableWriteAuthResponses.has(response)
function publishExpiredSession() {
  // Logout or successful authentication replacement supersedes a queued expiry.
  if (expiryGeneration !== generation) { expiryRequested = false; expiryWaitingForPayment = false; expiryGeneration = null; return }
  expiryListeners.forEach(listener => listener())
}
const notify = () => listeners.forEach(listener => listener())
const store = () => window.localStorage

// Credential precedence, identical for the shared store and the legacy per-tab store:
//   1. a session record (SESSION_STORAGE_KEY) takes precedence over a bare token (AUTH_STORAGE_KEY), which
//      only ever exists alone (every write of one key removes the other), so a token beside a record is a
//      leftover and is dropped;
//   2. a malformed record is never repaired from its bare-token sibling: both are dropped (sign in again);
//   3. a blank bare token counts as absent.
function selectCredential(area: Storage): { key: string; value: string } | null {
  const record = area.getItem(SESSION_STORAGE_KEY)
  if (record !== null) {
    let value: unknown
    try { value = JSON.parse(record) } catch { return null }
    try { parseSession(value, true) } catch { return null }
    return { key: SESSION_STORAGE_KEY, value: record }
  }
  const token = area.getItem(AUTH_STORAGE_KEY)
  return token?.trim() ? { key: AUTH_STORAGE_KEY, value: token } : null
}

// Sessions created before the shared store lived in per-tab sessionStorage: adopt one once, so a tab that
// was signed in during deployment stays signed in. Any shared-store entry (even one that turns out to be
// unusable) is newer than the per-tab one and wins; only the single credential selected above is moved;
// both legacy keys are always removed.
let legacyMigrated = false
function migrateLegacySession() {
  if (legacyMigrated) return
  legacyMigrated = true
  try {
    const legacy = window.sessionStorage
    const sharedPresent = store().getItem(SESSION_STORAGE_KEY) !== null || store().getItem(AUTH_STORAGE_KEY) !== null
    const selected = sharedPresent ? null : selectCredential(legacy)
    for (const key of [SESSION_STORAGE_KEY, AUTH_STORAGE_KEY]) legacy.removeItem(key)
    if (selected) store().setItem(selected.key, selected.value)
  } catch { /* Storage unavailable: the visitor simply signs in again. */ }
}

// A lineage identifies one sign-in; it survives refresh rotation, so other tabs can tell a rotation of the
// session they already follow from a different sign-in. Random and non-secret (no user information).
const LINEAGE = /^[0-9a-f-]{16,64}$/
function newLineage() {
  try { return crypto.randomUUID() } catch { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('') }
}
type StoredRecord = { session: Session; lineage: string | null }
/** Reads the shared record without side effects; malformed credentials are removed, never trusted. */
function readRecord(): StoredRecord | null {
  migrateLegacySession()
  try {
    const stored = store().getItem(SESSION_STORAGE_KEY)
    if (stored) {
      let value: unknown
      try { value = JSON.parse(stored) } catch { value = null }
      try {
        const session = parseSession(value, true)
        const lineage = (value as Record<string, unknown>).lineage
        if (store().getItem(AUTH_STORAGE_KEY) !== null) store().removeItem(AUTH_STORAGE_KEY)
        return { session, lineage: typeof lineage === 'string' && LINEAGE.test(lineage) ? lineage : null }
      } catch {
        store().removeItem(SESSION_STORAGE_KEY)
        store().removeItem(AUTH_STORAGE_KEY)
        return null
      }
    }
    const token = store().getItem(AUTH_STORAGE_KEY)
    if (token !== null && !token.trim()) { store().removeItem(AUTH_STORAGE_KEY); return null }
    return token ? { session: { token }, lineage: null } : null
  } catch { return null }
}
function writeRecord(session: Session, lineage: string) {
  store().setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, lineage }))
  store().removeItem(AUTH_STORAGE_KEY)
}
function readSignOutMarker() { try { return store().getItem(SIGN_OUT_MARKER_KEY) } catch { return null } }

// What this tab last saw of the shared record; changed only by this tab's own writes and by reconciliation.
let observed: { token: string | null; lineage: string | null } | null = null
let observedSignOut: string | null = null
function observe(token: string | null, lineage: string | null) { observed = { token, lineage } }
function ensureObserved() {
  if (observed) return
  const record = readRecord()
  observe(record?.session.token ?? null, record?.lineage ?? null)
  observedSignOut = readSignOutMarker()
}

export function readSession(): Session | null {
  ensureObserved()
  const record = readRecord()
  if (!record) return null
  knownCurrentToken = record.session.token
  storedSessionExpected = true
  return record.session
}

/**
 * Brings this tab's in-memory credential state in line with the shared record after another tab changed it.
 * Same lineage: a rotation, the previous token stays usable for in-flight reads. Different lineage: a new
 * sign-in elsewhere, in-flight work of the old one is superseded. Gone: an explicit sign-out elsewhere is
 * quiet; any other disappearance keeps the existing expired-session handling.
 */
export function reconcileSharedSession() {
  ensureObserved()
  const record = readRecord()
  const token = record?.session.token ?? null, lineage = record?.lineage ?? null
  if (token === observed!.token) return
  const before = observed!
  observe(token, lineage)
  if (!token) {
    const marker = readSignOutMarker()
    if (marker && marker !== observedSignOut) {
      observedSignOut = marker
      retireSession(); if (before.token) retiredTokens.add(before.token)
      generation += 1; refreshing = null; previousTokens.clear()
      storedSessionExpected = false; knownCurrentToken = null
      expiryRequested = false; expiryWaitingForPayment = false; expiryGeneration = null
      notify()
    } else if (before.token && !retiredTokens.has(before.token)) requestExpiredSession()
    return
  }
  if (before.token && lineage && lineage === before.lineage) previousTokens.add(before.token)
  else {
    if (before.token) retiredTokens.add(before.token)
    previousTokens.forEach(value => retiredTokens.add(value))
    generation += 1; refreshing = null; previousTokens.clear()
    expiryRequested = false; expiryWaitingForPayment = false; expiryGeneration = null
  }
  retiredTokens.delete(token)
  knownCurrentToken = token; storedSessionExpected = true
  notify()
}

/** Test isolation only: forget this page's observations, as a reload would. Never called by the app. */
export function resetSharedSessionForTests() { observed = null; observedSignOut = null; legacyMigrated = false }

let storageListening = false
function listenForOtherTabs() {
  if (storageListening || typeof window === 'undefined') return
  storageListening = true
  window.addEventListener('storage', event => {
    if (event.storageArea && event.storageArea !== store()) return
    if (event.key === null || event.key === SESSION_STORAGE_KEY || event.key === AUTH_STORAGE_KEY) reconcileSharedSession()
  })
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
    try { store().removeItem(key) } catch { /* UI cleanup must still complete. */ }
  }
  storedSessionExpected = false
  knownCurrentToken = null
  observe(null, null)
  notify()
}
export function storeToken(token: string) {
  retireSession()
  generation += 1; refreshing = null; previousTokens.clear()
  store().setItem(AUTH_STORAGE_KEY, token)
  store().removeItem(SESSION_STORAGE_KEY)
  storedSessionExpected = true
  knownCurrentToken = token
  observe(token, null)
  retiredTokens.delete(token)
  expiryRequested = false; expiryWaitingForPayment = false; expiryGeneration = null
}
export function storeSession(session: Session) {
  if (!session.refreshToken) { storeToken(session.token); return }
  const parsed = parseSession(session, true)
  retireSession()
  // One atomic storage record holds both sides of a rotating credential pair; a new sign-in starts a lineage.
  const lineage = newLineage()
  writeRecord(parsed, lineage)
  storedSessionExpected = true
  knownCurrentToken = parsed.token
  observe(parsed.token, lineage)
  generation += 1; refreshing = null; previousTokens.clear()
  retiredTokens.delete(parsed.token)
  expiryRequested = false; expiryWaitingForPayment = false; expiryGeneration = null
}
async function revoke(refreshToken: string) {
  try {
    await fetch(`${apiBase()}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }), signal: AbortSignal.timeout(10000) })
  } catch { /* Explicit logout always clears local credentials. */ }
}
export function discardSession(session: Session) { if (session.refreshToken) void revoke(session.refreshToken) }
export function logoutSession() {
  const session = readSession()
  // Written before the record is removed, so other tabs see a deliberate sign-out, not an expiry.
  try { const marker = String(Date.now()); store().setItem(SIGN_OUT_MARKER_KEY, marker); observedSignOut = marker } catch { /* Other tabs fall back to expiry handling. */ }
  clearStoredToken()
  if (session?.refreshToken) void revoke(session.refreshToken)
}
// Serialises refresh across tabs (Web Locks); without that API, only this tab's requests are serialised and
// a lost cross-tab race is recovered by adopting the rotation the other tab stored.
function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  return locks?.request ? locks.request(REFRESH_LOCK, { mode: 'exclusive' }, work) as Promise<T> : work()
}
/** If another tab already rotated this sign-in's credential, use its result instead of refreshing again. */
function adoptRotation(from: string, lineage: string | null): string | null {
  const latest = readRecord()
  if (!latest || latest.session.token === from || !lineage || latest.lineage !== lineage) return null
  previousTokens.add(from)
  knownCurrentToken = latest.session.token
  observe(latest.session.token, latest.lineage)
  notify()
  return latest.session.token
}
async function renew(token: string): Promise<string> {
  reconcileSharedSession()
  const record = readRecord()
  const session = record?.session ?? null
  if (!session) {
    if (!retiredTokens.has(token)) requestExpiredSession()
    throw new SessionError(true)
  }
  if (!previousTokens.has(token) && session.token !== token) throw new SessionError(true)
  if (refreshing) return refreshing
  if (session.token !== token) return session.token
  const current = generation
  if (!session.refreshToken) {
    if (generation === current) requestExpiredSession()
    throw new SessionError(true)
  }
  const lineage = record!.lineage
  const operation = withRefreshLock(async () => {
    // Re-read under the lock: a tab that held it first may already have rotated this credential.
    const adopted = adoptRotation(session.token, lineage)
    if (adopted) return adopted
    if (generation !== current || readRecord()?.session.token !== session.token) throw new SessionError(true)
    let response: Response
    try {
      response = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }), signal: AbortSignal.timeout(10000) })
    } catch { throw new SessionError() }
    if (response.status === 401) {
      // Lost a race with a tab that could not take the lock: its stored rotation is still valid.
      const recovered = adoptRotation(session.token, lineage)
      if (recovered) return recovered
      if (generation === current) requestExpiredSession()
      throw new SessionError(true)
    }
    if (!response.ok) throw new SessionError()
    let replacement: Session
    try { replacement = parseSession(await response.json(), true) } catch { throw new SessionError() }
    if (generation !== current || readRecord()?.session.token !== session.token) {
      // A logout/account replacement won. Revoke the rotated credential too,
      // even if revoking its old value raced after backend rotation.
      await revoke(replacement.refreshToken!)
      throw new SessionError(true)
    }
    try { writeRecord(replacement, lineage ?? newLineage()) }
    catch { await revoke(replacement.refreshToken!); throw new SessionError() }
    previousTokens.add(session.token)
    knownCurrentToken = replacement.token
    observe(replacement.token, readRecord()?.lineage ?? null)
    notify()
    return replacement.token
  })
  refreshing = operation
  try { return await operation } finally { if (refreshing === operation) refreshing = null }
}
export async function authenticatedFetch(url: string, init: RequestInit, token: string): Promise<Response> {
  reconcileSharedSession()
  const session = readSession()
  const ownsSession = !!session && (session.token === token || previousTokens.has(token))
  if (session && !ownsSession) throw new SessionError(true)
  if (!session && (storedSessionExpected || retiredTokens.has(token))) {
    if (storedSessionExpected && !retiredTokens.has(token)) requestExpiredSession()
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
  if (retried.status === 401) { requestExpiredSession(); throw new SessionError(true) }
  return retried
}
