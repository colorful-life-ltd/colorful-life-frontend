// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../auth/api'
import { CartProvider } from './CartProvider'
import { cartTotalPence, useCart } from './CartContext'
import { cartListing, offer } from '../catalogue/catalogueFixtures'
import type { PersistentCart } from './api'

vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('../catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
let root: Root
let container: HTMLDivElement
let persisted: PersistentCart
let rejectRemoval: boolean
let fetcher: ReturnType<typeof vi.fn>
const item = (id: number) => ({ productListingId: id, quantity: 1, productListing: cartListing(offer(id, { effectivePrice: '10.00' })) })
function Summary() {
  const { items } = useCart()
  return <output data-testid="summary">{items.reduce((count, row) => count + row.quantity, 0)} items; {cartTotalPence(items)} pence</output>
}
async function mount() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CartProvider><Summary /><App /></CartProvider></AuthProvider>))
}
async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector)
  expect(button).not.toBeNull()
  await act(async () => button!.click())
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/?spread=front-matter')
  sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt')
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.com', firstName: null, lastName: null, phone: null })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  persisted = { items: [item(42)] }; rejectRemoval = false
  fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === 'DELETE') {
      if (rejectRemoval) return new Response(JSON.stringify({ error: 'Removal failed' }), { status: 500 })
      const id = Number(url.split('/').at(-1))
      persisted = { items: persisted.items.filter(row => row.productListingId !== id) }
    } else if (url !== '/api/cart' || init.method !== 'GET') throw new Error(`Unexpected request: ${url}`)
    return new Response(JSON.stringify(persisted), { status: 200 })
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(async () => {
  await act(async () => root?.unmount()); document.body.innerHTML = ''
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})
describe('confirmed removal through the cart API', () => {
  it('removes the final item, closes confirmation, empties totals/count and remains empty after remount', async () => {
    await mount(); await click('.stage-cart'); await click('.cart-item__remove')
    expect(container.querySelector('dialog')?.open).toBe(true)
    await click('.remove-item-dialog__remove')
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.querySelector('.cart-modal__page--empty')).not.toBeNull()
    expect(container.textContent).toContain('Your cart is empty')
    expect(container.querySelector('.cart-items__total')).toBeNull()
    expect(container.querySelector('[data-testid="summary"]')?.textContent).toBe('0 items; 0 pence')
    expect(persisted.items).toEqual([])
    expect(fetcher.mock.calls.filter(([, init]) => init.method === 'DELETE')).toHaveLength(1)
    await act(async () => root.unmount()); container.remove()
    await mount(); await click('.stage-cart')
    expect(container.querySelector('.cart-modal__page--empty')).not.toBeNull()
    expect(container.querySelector('[data-testid="summary"]')?.textContent).toBe('0 items; 0 pence')
  })
  it('removes only the selected item and updates remaining totals/count', async () => {
    persisted = { items: [item(42), item(43)] }
    await mount(); await click('.stage-cart'); await click('[data-cart-listing-id="42"] .cart-item__remove'); await click('.remove-item-dialog__remove')
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.querySelector('[data-cart-listing-id="42"]')).toBeNull()
    expect(container.querySelector('[data-cart-listing-id="43"]')).not.toBeNull()
    expect(container.querySelector('.cart-items__total')?.textContent).toContain('£10.00')
    expect(container.querySelector('[data-testid="summary"]')?.textContent).toBe('1 items; 1000 pence')
  })
  it('keeps the item, confirmation and totals on a failed request and permits retry', async () => {
    rejectRemoval = true
    await mount(); await click('.stage-cart'); await click('.cart-item__remove'); await click('.remove-item-dialog__remove')
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(container.querySelector('.cart-item')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Removal failed')
    expect(container.querySelector('[data-testid="summary"]')?.textContent).toBe('1 items; 1000 pence')
    expect(persisted.items).toHaveLength(1)
    expect(container.querySelector<HTMLButtonElement>('.remove-item-dialog__remove')?.disabled).toBe(false)
    rejectRemoval = false
    await click('.remove-item-dialog__remove')
    expect(container.querySelector('.cart-modal__page--empty')).not.toBeNull()
  })
})
