// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../../features/auth/api'
import { CartProvider } from '../../features/cart/CartProvider'
import { getCart } from '../../features/cart/api'
import { USER_FAREWELL_MESSAGE, USER_FAREWELL_MS } from './userWelcome'
import { FAREWELL_WAVE, WAVE_FRAME_MS } from './userFrames'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('../../features/cart/api', async original => ({ ...await original<typeof import('../../features/cart/api')>(), getCart: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root, container: HTMLDivElement
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const bubble = () => container.querySelector('.user-dialogue-bubble')
const character = () => container.querySelector<HTMLButtonElement>('.stage-user')
const signOutButton = () => [...document.querySelectorAll<HTMLButtonElement>('.account-hub__signout-button')].find(b => b.textContent === 'Sign Out')!

async function openAccount() { await act(async () => character()!.click()) }
async function signOut() { await openAccount(); await act(async () => signOutButton().click()) }

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt'); history.replaceState({}, '', '/?spread=front-matter')
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 204 }))))
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.invalid', firstName: null, lastName: null, phone: null })
  vi.mocked(getCart).mockResolvedValue({ items: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CartProvider><App /></CartProvider></AuthProvider>))
  await advance(0)
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

it('clears the session immediately, then the character says farewell for about three seconds', async () => {
  await signOut()
  // Authentication is invalidated before, and independently of, the cosmetic message.
  expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  expect(document.querySelector('.account-modal')).toBeNull()
  expect(bubble()?.textContent).toBe(USER_FAREWELL_MESSAGE)
  expect(bubble()?.getAttribute('role')).toBe('status')
  // The signed-out guest hint never stacks on top of the farewell.
  expect(container.querySelectorAll('.guest-cart-bubble')).toHaveLength(1)
  await advance(USER_FAREWELL_MS - 1)
  expect(bubble()?.textContent).toBe(USER_FAREWELL_MESSAGE)
  await advance(1)
  expect(bubble()).toBeNull()
  expect(character()).not.toBeNull()
})

it('does not leave a stale farewell when the account is reopened', async () => {
  await signOut()
  expect(bubble()?.textContent).toBe(USER_FAREWELL_MESSAGE)
  await openAccount()
  expect(bubble()).toBeNull()
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  await advance(USER_FAREWELL_MS * 2)
  expect(bubble()).toBeNull()
})

describe('farewell wave', () => {
  const frame = () => character()?.dataset.frame
  it('waves the raised hand twice on sign-out, then settles on the raised-hand pose within the bubble', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('prefers-reduced-motion') }))
    await signOut()
    const seen: (string | undefined)[] = []
    for (let t = 0; t < FAREWELL_WAVE.length; t++) { await advance(WAVE_FRAME_MS); seen.push(frame()) }
    expect(seen).toEqual(FAREWELL_WAVE)
    expect(seen.filter(f => f === 'w08')).toHaveLength(2)
    expect(seen.at(-1)).toBe('idle')
    expect(FAREWELL_WAVE.length * WAVE_FRAME_MS).toBeLessThanOrEqual(USER_FAREWELL_MS)
    expect(bubble()?.textContent).toBe(USER_FAREWELL_MESSAGE)
  })
  it('keeps the static raised-hand pose under reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion') }))
    await signOut()
    for (let t = 0; t < 29; t++) { await advance(100); expect(frame()).toBe('idle') }
    expect(bubble()?.textContent).toBe(USER_FAREWELL_MESSAGE)
  })
})
