// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../../features/auth/api'
import { CartProvider } from '../../features/cart/CartProvider'
import { addCartItem, getCart } from '../../features/cart/api'
import { offer, product } from '../../features/catalogue/catalogueFixtures'
import type { ProductListingOffer } from '../../features/catalogue/api'
import { CatalogueProductDetails } from './VehiclesProductPage'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('../../features/cart/api', async original => ({ ...await original<typeof import('../../features/cart/api')>(), getCart: vi.fn(), addCartItem: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../../features/checkout/shipping', async original => ({ ...await original<typeof import('../../features/checkout/shipping')>(), cachedShippingOptions: () => new Promise(() => {}) }))
// Two real product pages side by side: only the product that was added may show the confirmation.
vi.mock('./CategoryCatalogue', () => ({ CategoryCatalogue: ({ onAddToCart }: { onAddToCart: (listing: ProductListingOffer, title: string) => void }) => <>
  <div data-page="added"><CatalogueProductDetails side="right" product={product(42, [offer(42)])} onAddToCart={onAddToCart} /></div>
  <div data-page="other"><CatalogueProductDetails side="right" product={product(43, [offer(43)])} onAddToCart={onAddToCart} /></div>
</> }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root, container: HTMLDivElement
const page = (name: string) => container.querySelector(`[data-page="${name}"]`)!
const message = (name = 'added') => page(name).querySelector('.product-details__added')!
const announcement = () => container.querySelector('.cart-add-feedback')!
async function add(name = 'added') { await act(async () => page(name).querySelector<HTMLButtonElement>('.product-details__add')!.click()) }
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt'); history.replaceState({}, '', '/?spread=front-matter')
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  // Desktop layout, motion allowed (reduced motion suppresses the cart bounce by design).
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('prefers-reduced-motion') }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.invalid', firstName: null, lastName: null, phone: null })
  vi.mocked(getCart).mockResolvedValue({ items: [] })
  vi.mocked(addCartItem).mockResolvedValue({ items: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CartProvider><App /></CartProvider></AuthProvider>))
  await advance(0)
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView })

describe('"Added to your basket!" confirmation', () => {
  it('appears under Add to cart after a committed add, with one polite announcement', async () => {
    expect(message().textContent).toBe(''); expect(announcement().textContent).toBe('')
    await add()
    expect(addCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42, 1)
    expect(message().textContent).toBe('Added to your basket!')
    expect(message().previousElementSibling?.classList.contains('product-details__add')).toBe(true)
    expect(message().querySelector('svg')).not.toBeNull()
    // Visible copy is hidden from assistive technology; the always-mounted polite region announces it once.
    expect(message().getAttribute('aria-hidden')).toBe('true')
    expect(announcement().getAttribute('role')).toBe('status'); expect(announcement().getAttribute('aria-live')).toBe('polite')
    expect(announcement().textContent).toBe('Added to your basket!')
  })

  it('reserves its line before, during and after the message, so the details never shift', async () => {
    const before = message(); await add()
    expect(message()).toBe(before)
    await advance(3000)
    expect(message()).toBe(before); expect(message().textContent).toBe('')
  })

  it('stays for about three seconds, then disappears', async () => {
    await add()
    await advance(2900); expect(message().textContent).toBe('Added to your basket!')
    await advance(200); expect(message().textContent).toBe(''); expect(announcement().textContent).toBe('')
  })

  it('restarts the fade and timer when another item is added before it disappears', async () => {
    await add(); const first = message().querySelector('span')
    await advance(2000); await add()
    const second = message().querySelector('span')
    expect(second).not.toBe(first)
    await advance(2500); expect(message().textContent).toBe('Added to your basket!')
    await advance(600); expect(message().textContent).toBe('')
  })

  it('shows nothing when the add fails', async () => {
    vi.mocked(addCartItem).mockRejectedValueOnce(new Error('synthetic failure'))
    await add()
    expect(message().textContent).toBe(''); expect(announcement().textContent).toBe('')
  })

  it('appears only on the product that was added', async () => {
    await add()
    expect(message('added').textContent).toBe('Added to your basket!'); expect(message('other').textContent).toBe('')
  })

  it('reveals the line inside the scrolling book page, instantly under reduced motion, and not on failure', async () => {
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll
    vi.mocked(addCartItem).mockRejectedValueOnce(new Error('synthetic failure'))
    await add(); expect(scroll).not.toHaveBeenCalled()
    await add(); expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', behavior: 'smooth' }); expect(scroll.mock.contexts[0]).toBe(message())
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    await add(); expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'auto' })
  })

  it('keeps the existing cart bounce on success', async () => {
    const cart = () => container.querySelector<HTMLImageElement>('.stage-cart img')!.getAttribute('src')
    const idle = cart()
    await add(); await advance(80)
    expect(cart()).not.toBe(idle)
  })
})

