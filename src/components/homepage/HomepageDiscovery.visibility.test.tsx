// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../../features/auth/api'
import { navigateCheckout } from '../../features/checkout/state'
import { getProducts, type CatalogueProduct } from '../../features/catalogue/api'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('../../features/catalogue/api', async original => ({ ...await original<typeof import('../../features/catalogue/api')>(), getProducts: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const product = { id: 7, title: 'Botanical Orchid', setNumber: '10311', isPublished: true, category: null } as unknown as CatalogueProduct
let root: Root, host: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); history.replaceState({}, '', '/')
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'test@example.com', firstName: null, lastName: null, phone: null })
  vi.mocked(getProducts).mockResolvedValue([product])
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('[]'))))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

/** The discovery copy must stay in the DOM for crawlers and screen readers, but only in its crawl-only form. */
function expectCrawlOnlyDiscovery() {
  const sections = host.querySelectorAll('.homepage-discovery')
  expect(sections).toHaveLength(1)
  expect(sections[0].classList.contains('homepage-discovery--crawl-only')).toBe(true)
  expect(sections[0].querySelector('h1')?.textContent).toBe('LEGO® sets with UK delivery')
  expect(sections[0].querySelector('a[href="/products/7"]')).not.toBeNull()
}

it('keeps the SEO discovery catalogue crawl-only on direct load and after returning from Order Details', async () => {
  await act(async () => root.render(<AuthProvider><App /></AuthProvider>))
  expectCrawlOnlyDiscovery()
  await act(async () => navigateCheckout('/account/orders/41'))
  expect(host.querySelector('.homepage-discovery')).toBeNull()
  document.documentElement.scrollTop = 600
  await act(async () => navigateCheckout('/'))
  expectCrawlOnlyDiscovery()
  expect(document.documentElement.scrollTop).toBe(0)
})

