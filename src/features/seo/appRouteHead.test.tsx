// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CartContext, type CartContextValue } from '../cart/CartContext'
import { offer, product, fixtureCategory } from '../catalogue/catalogueFixtures'
import { captureResetToken, forgetResetToken } from '../auth/passwordReset'

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1, email: 'customer@example.com' } }, logout: vi.fn() }) }))
vi.mock('../catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'ready', categories: [fixtureCategory] }, retry: vi.fn() }) }))
vi.mock('../../components/checkout/StripePaymentForm', () => ({ StripePaymentForm: () => null }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const soldOutTruck = product(88, [offer(808, { legoProductId: 88, currentStock: 0, availableStock: 0 })], { title: 'Monster Truck', setNumber: '42226' })
const crane = product(90, [offer(900, { legoProductId: 90, effectivePrice: '49.99' })], { title: 'Crane', setNumber: '60324', isFeatureProduct: true })
let root: Root
let fetchMock: ReturnType<typeof vi.fn>
const cart: CartContextValue = { items: [], isLoading: false, pendingItemIds: [], error: null, refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content') ?? document.head.querySelector(selector)?.getAttribute('href') ?? null

async function mountAt(path: string, state: unknown = {}) {
  history.replaceState(state, '', path)
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<CartContext.Provider value={cart}><App /></CartContext.Provider>))
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  return container
}

beforeEach(() => {
  document.head.innerHTML = '<title>Build &amp; Bloom</title><meta name="description" content="Default">'
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/products/by-product/88')) return json(soldOutTruck)
    if (url.includes('/products/by-product/')) return json({ error: 'Product not found' }, 404)
    if (url.includes('/products?categoryId=11')) return json({ items: [crane, soldOutTruck], pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 } })
    return new Promise<Response>(() => {})
  })
  vi.stubGlobal('fetch', fetchMock)
  sessionStorage.clear()
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('App route metadata', () => {
  it.each(['/checkout', '/checkout/orders/41', '/account/orders', '/account/orders/7', '/verify-email'])('marks %s noindex without a canonical', async path => {
    await mountAt(path)
    expect(meta('meta[name="robots"]')).toBe('noindex,nofollow')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it.each(['/reset-password', '/reset-password/'])('keeps %s private: no token in the URL or head, noindex, no canonical', async path => {
    const token = 'seo-head-test-token'
    history.replaceState({}, '', `${path}?token=${token}`)
    captureResetToken() // main.tsx runs this before React
    const container = await mountAt(location.pathname + location.search)
    expect(location.href).not.toContain(token)
    expect(container.querySelector('#reset-password-new')).not.toBeNull()
    expect(document.title).toBe('Reset your password | Build & Bloom')
    const robots = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="robots"]')].map(meta => meta.content)
    expect(robots.length).toBeGreaterThan(0)
    expect(robots.every(content => content === 'noindex,nofollow')).toBe(true)
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull()
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
    expect([...document.head.querySelectorAll<HTMLMetaElement>('meta[name="referrer"]')].at(-1)?.content).toBe('no-referrer')
    expect(document.head.innerHTML).not.toContain(token)
    forgetResetToken()
  })

  it('indexes the homepage with the brand title and root canonical', async () => {
    await mountAt('/')
    expect(document.title).toBe('Build & Bloom | LEGO® sets catalogue')
    expect(meta('meta[name="robots"]')).toBe('index,follow')
    expect(meta('link[rel="canonical"]')).toBe(`${location.origin}/`)
  })

  it('opens a category with its own title and canonical', async () => {
    await mountAt('/categories/vehicles?page=1')
    expect(document.title).toBe('Vehicles LEGO® sets | Build & Bloom')
    expect(meta('link[rel="canonical"]')).toBe(`${location.origin}/categories/vehicles`)
  })

  it('opens a stable product URL directly, including a sold-out product, with honest structured data', async () => {
    const container = await mountAt('/products/88')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/products/by-product/88'))).toBe(true)
    expect(container.querySelector('[data-detail-product-id="88"]')).not.toBeNull()
    expect(container.querySelector<HTMLButtonElement>('.product-details__add')!.disabled).toBe(true)
    expect(document.title).toBe('Monster Truck (42226) | Build & Bloom')
    expect(meta('link[rel="canonical"]')).toBe(`${location.origin}/products/88`)
    expect(meta('meta[name="robots"]')).toBe('index,follow')
    const data = JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(data[0].offers).toEqual({ '@type': 'Offer', availability: 'https://schema.org/OutOfStock', url: `${location.origin}/products/88` })
    expect(data[1]['@type']).toBe('BreadcrumbList')
    // The collection context is recorded for in-book Back without changing the URL.
    expect(location.pathname).toBe('/products/88')
    expect(history.state.returnTo).toMatchObject({ kind: 'category', slug: 'vehicles' })
    expect(container.textContent).toContain('← Back to Vehicles')
  })

  it('canonicalises a legacy ?details= listing link to the stable product URL', async () => {
    const container = await mountAt('/categories/vehicles?details=900')
    expect(container.querySelector('[data-detail-product-id="90"]')).not.toBeNull()
    expect(location.search).toBe('?details=900')
    expect(meta('link[rel="canonical"]')).toBe(`${location.origin}/products/90`)
  })

  it('navigates from a category card to the stable product URL and back', async () => {
    const container = await mountAt('/categories/vehicles')
    const link = container.querySelector<HTMLAnchorElement>('a.vehicle-product__details')!
    expect(link.getAttribute('href')).toBe('/products/90')
    await act(async () => link.click())
    expect(location.pathname).toBe('/products/90')
    expect(container.querySelector('[data-detail-product-id="90"]')).not.toBeNull()
    const back = [...container.querySelectorAll('button')].find(button => button.textContent === '← Back to Vehicles')!
    await act(async () => back.click())
    expect(location.pathname).toBe('/categories/vehicles')
  })

  it('does not index a product the API does not publish', async () => {
    const container = await mountAt('/products/404')
    expect(container.textContent).toContain('This product is currently unavailable.')
    expect(meta('meta[name="robots"]')).toBe('noindex,follow')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
  })
})
