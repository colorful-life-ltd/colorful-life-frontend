// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { captureResetToken, forgetResetToken } from '../../features/auth/passwordReset'

const auth = vi.hoisted(() => ({ state: { status: 'signedOut' } as Record<string, unknown>, logout: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state, logout: auth.logout, authenticate: vi.fn(), clearError: vi.fn(), refreshAuth: vi.fn() }) }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../checkout/StripePaymentForm', () => ({ StripePaymentForm: () => null }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let container: HTMLDivElement
const cart: CartContextValue = { items: [], isLoading: false, pendingItemIds: [], error: null, refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
const button = (label: string) => [...document.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(label))!

async function openLink(url: string) {
  history.replaceState(null, '', url)
  captureResetToken()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<CartContext.Provider value={cart}><App /></CartContext.Provider>))
}

beforeEach(() => {
  document.head.innerHTML = ''
  auth.state = { status: 'signedOut' }
  auth.logout.mockReset()
  forgetResetToken()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))))
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open') }
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('/reset-password route', () => {
  it('renders the reset page from an emailed link with the token already gone from the URL', async () => {
    await openLink('/reset-password?token=emailed-token')
    expect(location.pathname + location.search).toBe('/reset-password')
    expect(container.querySelector('#reset-password-new')).not.toBeNull()
    expect(document.body.innerHTML).not.toContain('emailed-token')
  })

  it.each(['/reset-password', '/reset-password/'])('renders the reset page for %s and removes the token', async path => {
    await openLink(`${path}?token=emailed-token`)
    expect(location.pathname).toBe(path)
    expect(location.search).toBe('')
    expect(container.querySelector('#reset-password-new')).not.toBeNull()
  })

  it.each(['/reset-password', '/reset-password/', '/reset-password?token=t'])('keeps %s noindex and referrer-free after the app has rendered', async path => {
    await openLink(path)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    const robots = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="robots"]')].map(meta => meta.content)
    // Every robots tag, not just the last one: a later head manager must not downgrade any of them.
    expect(robots.length).toBeGreaterThan(0)
    expect(robots.every(content => content === 'noindex,nofollow')).toBe(true)
    expect([...document.head.querySelectorAll<HTMLMetaElement>('meta[name="referrer"]')].at(-1)?.content).toBe('no-referrer')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('signs this browser out after a successful reset and opens the normal sign-in form', async () => {
    auth.state = { status: 'authenticated', token: 'jwt', user: { id: 7, email: 'customer@example.com' } }
    await openLink('/reset-password?token=emailed-token')
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    for (const id of ['#reset-password-new', '#reset-password-confirm']) {
      const element = container.querySelector<HTMLInputElement>(id)!
      await act(async () => { set.call(element, 'N3w-password!'); element.dispatchEvent(new Event('input', { bubbles: true })) })
    }
    await act(async () => { container.querySelector('form')!.requestSubmit() })
    expect(container.textContent).toContain('Your password has been changed.')
    auth.state = { status: 'signedOut' }
    await act(async () => button('Sign in').click())
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(location.pathname).toBe('/')
    expect(document.body.textContent).toContain('Welcome back!')
  })

  it('opens the account modal on the request form from an unusable link', async () => {
    await openLink('/reset-password')
    await act(async () => button('Request a new link').click())
    expect(location.pathname).toBe('/')
    expect(document.querySelector('#account-forgot-email')).not.toBeNull()
  })

  it('leaves the normal account modal on sign-in', async () => {
    await openLink('/')
    await act(async () => document.querySelector<HTMLButtonElement>('.mobile-quick-controls button')!.click())
    expect(document.body.textContent).toContain('Welcome back!')
    expect(document.body.textContent).toContain('Forgot password?')
  })
})
