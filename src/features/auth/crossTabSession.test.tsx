// @vitest-environment jsdom
// Cross-tab authentication. "Another tab" is simulated as a browser does it: it writes the shared localStorage
// record and this tab receives a StorageEvent (or only a later focus, when the event is missed).
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import { AUTH_STORAGE_KEY, SESSION_STORAGE_KEY, SIGN_OUT_MARKER_KEY, authenticatedFetch, readSession, resetSharedSessionForTests, storeSession } from './session'
import { AccountModal } from '../../components/homepage/AccountModal'
import { VerifyEmail } from '../../components/account/VerifyEmail'

vi.mock('../checkout/sandbox', async original => ({ ...await original<typeof import('../checkout/sandbox')>(), registrationAvailable: true }))
vi.mock('../catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const LINEAGE = '0f1e2d3c-4b5a-4968-8776-655443322110'
const OTHER_LINEAGE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
const credential = (n: number, lineage = LINEAGE) => ({ token: `access-${n}`, refreshToken: String(n).padEnd(43, 'r'), accessTokenExpiresAt: iso(60), refreshExpiresAt: iso(60 * 24 * 30), lineage })
/** A credential as the server returns it (or as stored before this release): no lineage. */
const bare = (n: number) => { const value: Record<string, unknown> = credential(n); delete value.lineage; return value }
const user = (email = 'customer@example.com') => ({ id: 7, email, firstName: null, lastName: null, phone: null })
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let root: Root | null = null
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
let fetcher: ReturnType<typeof vi.fn>
const calls = (path: string) => fetcher.mock.calls.filter(([url]) => String(url).endsWith(path))
const bearer = (index: number) => new Headers((fetcher.mock.calls[index][1] as RequestInit).headers).get('Authorization')
function Capture() { const value = useAuth(); useEffect(() => { auth = value }, [value]); return null }
async function mount(element: ReactNode = null) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(<AuthProvider><Capture />{element}</AuthProvider>))
}
async function settle() { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }
/** Another tab writes the shared record (and, unless `missed`, this tab receives the storage event). */
async function otherTabWrites(key: string, value: string | null, missed = false) {
  const oldValue = localStorage.getItem(key)
  if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value)
  if (!missed) await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: value, storageArea: localStorage })) })
  await settle()
}
const otherTabSignsIn = (n: number, lineage = LINEAGE, missed = false) => otherTabWrites(SESSION_STORAGE_KEY, JSON.stringify(credential(n, lineage)), missed)
async function otherTabSignsOut() {
  await otherTabWrites(SIGN_OUT_MARKER_KEY, String(Date.now()))
  await otherTabWrites(SESSION_STORAGE_KEY, null)
}
const focus = async () => { await act(async () => { window.dispatchEvent(new Event('focus')) }); await settle() }

beforeEach(() => {
  resetSharedSessionForTests()
  fetcher = vi.fn((url: string) => Promise.resolve(String(url).endsWith('/users/me') ? json(200, user()) : json(404, {})))
  vi.stubGlobal('fetch', fetcher)
  history.replaceState({}, '', '/')
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('sign-in in another tab', () => {
  it('tab A, still on "Check your email", becomes signed in and opens My Account without signing in again', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    await act(async () => auth.authenticate('signup', { email: 'customer@example.com' }))
    fetcher.mockClear()
    await otherTabSignsIn(1)
    expect(auth.state.status).toBe('authenticated')
    expect(calls('/users/me')).toHaveLength(1)
    expect(container.textContent).toContain('Signed in as customer@example.com')
    expect(container.querySelector('input[type="password"]')).toBeNull()
  })

  it('a missed storage event is caught up when tab A regains focus (one profile request)', async () => {
    await mount()
    await otherTabSignsIn(1, LINEAGE, true)
    expect(auth.state.status).toBe('signedOut')
    await focus(); await focus()
    expect(auth.state.status).toBe('authenticated')
    expect(calls('/users/me')).toHaveLength(1)
  })

  it('clicking Sign In validates the shared session first: "Restoring your account…", then My Account, never the sign-in form', async () => {
    let answer!: (r: Response) => void
    await otherTabSignsIn(1, LINEAGE, true)
    fetcher.mockImplementation(() => new Promise(resolve => { answer = resolve }))
    await mount(<AccountModal onClose={vi.fn()} />)
    expect(container.textContent).toContain('Restoring your account…')
    expect(container.querySelector('input[type="password"]')).toBeNull()
    await act(async () => answer(json(200, user())))
    await settle()
    expect(container.textContent).toContain('Account connected')
    expect(calls('/users/me')).toHaveLength(1)
  })

  it('a genuinely signed-out visitor gets the normal Sign In form and no API call', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    expect(container.textContent).toContain('Welcome back!')
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('email verification alone never signs any tab in', async () => {
    history.replaceState({}, '', '/verify-email?token=synthetic-token')
    fetcher.mockImplementation((url: string) => Promise.resolve(String(url).endsWith('/auth/verify-email') ? json(200, { message: 'Email verified successfully' }) : json(404, {})))
    await mount(<VerifyEmail onSignIn={vi.fn()} />)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]')
    await act(async () => { for (const input of inputs) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Chosen1!pass'); input.dispatchEvent(new Event('input', { bubbles: true })) } })
    await act(async () => { container.querySelector('form')!.requestSubmit() }); await settle()
    expect(container.textContent).toContain('Email verified')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(auth.state.status).toBe('signedOut')
    expect(calls('/users/me')).toHaveLength(0)
  })
})

describe('sign-out and invalid credentials across tabs', () => {
  it('an explicit sign-out in another tab signs tab A out quietly and stops using the old token', async () => {
    storeSession(credential(1)); await mount(<AccountModal onClose={vi.fn()} />)
    expect(auth.state.status).toBe('authenticated')
    await otherTabSignsOut()
    expect(auth.state.status).toBe('signedOut')
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    fetcher.mockClear()
    await expect(authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')).rejects.toMatchObject({ invalid: true })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('signing out in this tab marks the sign-out for other tabs and revokes the refresh token', async () => {
    storeSession(credential(1)); await mount()
    await act(async () => auth.logout())
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(SIGN_OUT_MARKER_KEY)).toMatch(/^\d+$/)
    expect(calls('/auth/logout')).toHaveLength(1)
  })

  it('credentials disappearing without a sign-out keep the existing session-expired handling', async () => {
    storeSession(credential(1)); await mount()
    await otherTabWrites(SESSION_STORAGE_KEY, null)
    expect(auth.state).toMatchObject({ status: 'signedOut', reason: 'expired' })
  })

  it('an expired or revoked shared credential is not treated as signed in, and is cleared', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    fetcher.mockImplementation(() => Promise.resolve(json(401, { error: { code: 'SESSION_INVALID', message: 'Invalid or expired token' } })))
    await otherTabSignsIn(1)
    expect(auth.state.status).toBe('signedOut')
    expect(container.textContent).toContain('Welcome back!')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(calls('/auth/refresh')).toHaveLength(1)
  })

  it('malformed stored credentials are removed and never sent', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{"token":"x","refreshToken":"too-short"}')
    localStorage.setItem(AUTH_STORAGE_KEY, '   ')
    await mount(<AccountModal onClose={vi.fn()} />)
    expect(auth.state.status).toBe('signedOut')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('rotation and refresh races', () => {
  it('a rotation by another tab (same sign-in) is adopted: old token stays usable, requests move to the new one', async () => {
    storeSession(credential(1)); await mount()
    const lineage = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).lineage
    fetcher.mockClear()
    await otherTabSignsIn(2, lineage)
    expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-2' })
    fetcher.mockClear()
    await authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')
    expect(bearer(0)).toBe('Bearer access-2')
  })

  it('a different sign-in in another tab supersedes this tab: the old token is refused', async () => {
    storeSession(credential(1)); await mount()
    fetcher.mockImplementation((url: string) => Promise.resolve(String(url).endsWith('/users/me') ? json(200, user('other@example.com')) : json(404, {})))
    await otherTabSignsIn(9, OTHER_LINEAGE)
    expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-9' })
    await expect(authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')).rejects.toMatchObject({ invalid: true })
  })

  it('under the cross-tab lock, a rotation another tab just finished is adopted instead of refreshing again', async () => {
    storeSession(credential(1)); await mount()
    const lineage = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).lineage
    const request = vi.fn((_name: string, _options: unknown, work: () => Promise<unknown>) => {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credential(2, lineage))) // the lock holder before us rotated
      return work()
    })
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    let first = true
    fetcher.mockImplementation((url: string) => {
      if (String(url).endsWith('/users/me')) { const status = first ? 401 : 200; first = false; return Promise.resolve(status === 401 ? json(401, {}) : json(200, user())) }
      return Promise.resolve(json(404, {}))
    })
    fetcher.mockClear()
    const response = await authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')
    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledWith('colorful-life:storefront:refresh', { mode: 'exclusive' }, expect.any(Function))
    expect(calls('/auth/refresh')).toHaveLength(0)
    expect(bearer(1)).toBe('Bearer access-2')
    expect(auth.state.status).toBe('authenticated')
  })

  it('without Web Locks, losing a refresh race (401) adopts the winner\'s stored rotation instead of signing out', async () => {
    storeSession(credential(1)); await mount()
    const lineage = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).lineage
    let first = true
    fetcher.mockImplementation((url: string) => {
      if (String(url).endsWith('/auth/refresh')) { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credential(2, lineage))); return Promise.resolve(json(401, {})) }
      if (String(url).endsWith('/users/me')) { const ok = !first; first = false; return Promise.resolve(ok ? json(200, user()) : json(401, {})) }
      return Promise.resolve(json(404, {}))
    })
    const response = await authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')
    expect(response.status).toBe(200)
    expect(readSession()?.token).toBe('access-2')
    expect(auth.state.status).toBe('authenticated')
  })

  it('concurrent reads in one tab share a single refresh', async () => {
    storeSession(credential(1)); await mount()
    let refreshed = false
    fetcher.mockImplementation((url: string) => {
      if (String(url).endsWith('/auth/refresh')) { refreshed = true; return Promise.resolve(json(200, bare(3))) }
      return Promise.resolve(refreshed ? json(200, user()) : json(401, {}))
    })
    await Promise.all([1, 2, 3].map(() => authenticatedFetch('/api/users/me', { method: 'GET' }, 'access-1')))
    expect(calls('/auth/refresh')).toHaveLength(1)
  })
})

/** Holds every /users/me request open until the test answers it; records which bearer each one carried. */
function deferProfiles() {
  const pending: { bearer: string | null; answer: (response: Response) => void }[] = []
  fetcher.mockImplementation((url: string, init?: RequestInit) => String(url).endsWith('/users/me')
    ? new Promise<Response>(answer => { pending.push({ bearer: new Headers(init?.headers).get('Authorization'), answer }) })
    : Promise.resolve(json(404, {})))
  return pending
}
const answer = async (request: { answer: (response: Response) => void }, response: Response) => { await act(async () => request.answer(response)); await settle() }

describe('cross-tab changes while a profile check is pending', () => {
  for (const order of ['new answer first', 'stale answer first'] as const) {
    it(`a different sign-in elsewhere supersedes the pending check; the latest session is validated once (${order})`, async () => {
      await mount(<AccountModal onClose={vi.fn()} />)
      const pending = deferProfiles()
      await otherTabSignsIn(1)
      expect(auth.state.status).toBe('resolving')
      await otherTabSignsIn(9, OTHER_LINEAGE)
      expect(pending.map(request => request.bearer)).toEqual(['Bearer access-1', 'Bearer access-9'])
      const [stale, latest] = pending
      if (order === 'new answer first') { await answer(latest, json(200, user('other@example.com'))); await answer(stale, json(200, user())) }
      else { await answer(stale, json(200, user())); expect(auth.state.status).toBe('resolving'); await answer(latest, json(200, user('other@example.com'))) }
      expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-9', user: { email: 'other@example.com' } })
      expect(container.textContent).toContain('Signed in as other@example.com')
      await focus()
      expect(calls('/users/me')).toHaveLength(2)
    })
  }

  it('a sign-in elsewhere whose storage event is missed is caught up when the stale answer arrives, never attached to it', async () => {
    await mount()
    const pending = deferProfiles()
    await otherTabSignsIn(1)
    await otherTabSignsIn(9, OTHER_LINEAGE, true)
    expect(pending).toHaveLength(1)
    await answer(pending[0], json(200, user()))
    // The stale answer is dropped and the stored (newer) session is validated without waiting for focus.
    expect(pending.map(request => request.bearer)).toEqual(['Bearer access-1', 'Bearer access-9'])
    expect(auth.state.status).toBe('resolving')
    await focus()
    expect(pending).toHaveLength(2)
    await answer(pending[1], json(200, user('other@example.com')))
    expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-9', user: { email: 'other@example.com' } })
  })

  it('a rejection of the superseded session never expires or clears the new one', async () => {
    await mount(<AccountModal onClose={vi.fn()} />)
    const pending = deferProfiles()
    await otherTabSignsIn(1)
    await otherTabSignsIn(9, OTHER_LINEAGE)
    await answer(pending[0], json(401, { error: { code: 'SESSION_INVALID', message: 'Invalid or expired token' } }))
    await answer(pending[1], json(200, user('other@example.com')))
    expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-9' })
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).token).toBe('access-9')
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(calls('/auth/refresh')).toHaveLength(0)
  })

  it('a rotation of the same sign-in during the check reuses it: one request, the new token is adopted', async () => {
    await mount()
    const pending = deferProfiles()
    await otherTabSignsIn(1)
    await otherTabSignsIn(2)
    await focus()
    expect(pending).toHaveLength(1)
    await answer(pending[0], json(200, user()))
    expect(auth.state).toMatchObject({ status: 'authenticated', token: 'access-2' })
    expect(calls('/users/me')).toHaveLength(1)
  })

  it('a sign-out elsewhere during the check leaves the tab signed out; the late answer is ignored', async () => {
    await mount()
    const pending = deferProfiles()
    await otherTabSignsIn(1)
    await otherTabSignsOut()
    expect(auth.state.status).toBe('signedOut')
    await answer(pending[0], json(200, user()))
    expect(auth.state.status).toBe('signedOut')
    expect(pending).toHaveLength(1)
  })
})

describe('browser restart and upgrade', () => {
  it('a persisted session is restored after a restart, with one profile check', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credential(1)))
    await mount(<AccountModal onClose={vi.fn()} />)
    await settle()
    expect(auth.state.status).toBe('authenticated')
    expect(container.textContent).toContain('Account connected')
    expect(calls('/users/me')).toHaveLength(1)
  })

  it('an expired persisted session is not restored after a restart', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credential(1)))
    fetcher.mockImplementation(() => Promise.resolve(json(401, {})))
    await mount(); await settle()
    expect(auth.state.status).toBe('signedOut')
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('a tab signed in before this release (per-tab storage) moves to the shared store once', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(bare(4)))
    expect(readSession()?.token).toBe('access-4')
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).token).toBe('access-4')
  })

  describe('deterministic precedence when both storage keys exist', () => {
    it('legacy store with a record and a bare token: only the record moves; both legacy keys are removed', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(bare(4)))
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'legacy-bare-token')
      expect(readSession()?.token).toBe('access-4')
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
      expect(sessionStorage.length).toBe(0)
    })

    it('legacy store with a malformed record: its bare-token sibling is not adopted', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, '{"token":"x","refreshToken":"too-short"}')
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'legacy-bare-token')
      expect(readSession()).toBeNull(); expect(readSession()).toBeNull()
      expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
    })

    it('any shared-store credential wins over the legacy one, whichever keys either holds', () => {
      localStorage.setItem(AUTH_STORAGE_KEY, 'shared-bare-token')
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(bare(4)))
      expect(readSession()?.token).toBe('shared-bare-token')
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(sessionStorage.length).toBe(0)
    })

    it('shared store with a record and a leftover bare token: the record wins and the leftover is removed', () => {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credential(5)))
      localStorage.setItem(AUTH_STORAGE_KEY, 'stale-bare-token')
      expect(readSession()?.token).toBe('access-5')
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    })

    it('shared store with a malformed record never falls back to the bare token, on any read', () => {
      localStorage.setItem(SESSION_STORAGE_KEY, 'not json')
      localStorage.setItem(AUTH_STORAGE_KEY, 'stale-bare-token')
      expect(readSession()).toBeNull(); expect(readSession()).toBeNull()
      expect(localStorage.length).toBe(0)
    })
  })
})
