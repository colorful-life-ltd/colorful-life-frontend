// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CartItems } from '../../components/cart/CartItems'
import { CartContext, availableCartSubtotal, cartCheckoutBlocked, type CartItem, type CartContextValue } from './CartContext'
import { mapCart } from './CartProvider'
import { cartListing, offer } from '../catalogue/catalogueFixtures'
import { orderInput } from '../checkout/state'
import { availabilityMessage, cartCopy } from '../i18n/cartCopy'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const listing = cartListing(offer(41, { availableStock: 2, effectivePrice: '10.00' }))
const line = (overrides: Partial<CartItem> = {}): CartItem => ({ productListingId: 41, listing, quantity: 1, allocatedQuantity: 0, unallocatedQuantity: 1, availability: { status: 'AVAILABLE', reason: null, availableQuantity: 2 }, ...overrides })
const address = { id: 1, recipientName: 'Customer', line1: '1 Street', line2: null, city: 'Bath', postcode: 'BA1', country: 'GB', phone: null, isDefaultBilling: true, isDefaultShipping: true }
let root: Root | undefined
let container: HTMLDivElement
let context: CartContextValue
async function render(items: CartItem[]) {
  if (!root) { container = document.createElement('div'); document.body.append(container); root = createRoot(container) }
  await act(async () => root!.render(<CartContext.Provider value={context}><CartItems items={items} /></CartContext.Provider>))
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; document.documentElement.lang = 'en' })
function setup() { context = { items: [], isLoading: false, error: null, pendingItemIds: [], refreshCart: vi.fn(), addListing: vi.fn(), updateQuantity: vi.fn().mockResolvedValue(true), removeItem: vi.fn().mockResolvedValue(true) } }

describe('authoritative cart availability', () => {
  it.each(['OUT_OF_STOCK', 'PRODUCT_UNPUBLISHED', 'LISTING_INACTIVE', 'USED_OFFER_UNAVAILABLE'])('retains %s rows, identity, image and requested quantity, with accessible explanation and Remove', async reason => {
    setup()
    const item = line({ quantity: 3, unallocatedQuantity: 3, availability: { status: reason === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'UNAVAILABLE', reason, availableQuantity: 0 } })
    const mapped = mapCart({ items: [{ ...item, productListing: listing }] })
    expect(mapped[0]).toEqual(item)
    await render(mapped)
    const article = container.querySelector('article')!
    expect(article.classList.contains('cart-item--unavailable')).toBe(true)
    expect(article.dataset.cartListingId).toBe('41')
    expect(article.querySelector('img')?.getAttribute('src')).toBe(listing.legoProduct.productImages[0].url)
    expect(article.textContent).toContain(listing.legoProduct.title)
    expect(article.textContent).toContain('Quantity: 3')
    expect(document.getElementById(article.getAttribute('aria-describedby')!)?.textContent).toBe(availabilityMessage(reason))
    expect([...article.querySelectorAll('button')].find(b => b.textContent === 'Remove')?.disabled).toBe(false)
    expect(context.updateQuantity).not.toHaveBeenCalled(); expect(context.removeItem).not.toHaveBeenCalled()
    expect(availableCartSubtotal(mapped)).toBe(0)
  })
  it('requires an explicit reduction to a supported total including existing allocations', async () => {
    setup()
    const item = line({ quantity: 5, allocatedQuantity: 1, unallocatedQuantity: 4, availability: { status: 'INSUFFICIENT_STOCK', reason: 'INSUFFICIENT_STOCK', availableQuantity: 2 } })
    await render([item])
    expect(container.textContent).toContain('Only 2 available')
    expect(container.textContent).toContain('Quantity: 5')
    expect(context.updateQuantity).not.toHaveBeenCalled()
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Reduce quantity to 3')!.click())
    expect(context.updateQuantity).toHaveBeenCalledExactlyOnceWith(41, 3)
    expect(item.quantity).toBe(5)
    await render([line({ quantity: 3, allocatedQuantity: 1, unallocatedQuantity: 2 })])
    expect(container.querySelector('.cart-item--unavailable')).toBeNull()
    expect(container.textContent).toContain('£20.00')
  })
  it.each(['OUT_OF_STOCK', 'PRODUCT_UNPUBLISHED', 'LISTING_INACTIVE', 'USED_OFFER_UNAVAILABLE'])('recovers retained rows after %s resolves without writes', async reason => {
    setup(); await render([line({ availability: { status: 'UNAVAILABLE', reason, availableQuantity: 0 } })])
    await render([line()])
    expect(container.querySelector('.cart-item--unavailable')).toBeNull()
    expect(container.textContent).not.toContain('Out of stock')
    expect(context.updateQuantity).not.toHaveBeenCalled(); expect(context.removeItem).not.toHaveBeenCalled()
  })
  it('blocks mixed fresh intent without silently submitting a partial selection', () => {
    const items = [line(), line({ productListingId: 42, availability: { status: 'OUT_OF_STOCK', reason: 'OUT_OF_STOCK', availableQuantity: 0 } })]
    expect(cartCheckoutBlocked(items)).toBe(true)
    expect(availableCartSubtotal(items)).toBe(1000)
    expect(() => orderInput(items, address)).toThrow('resolve unavailable')
    expect(items).toHaveLength(2)
  })
  it.each(['CART_QUANTITY_ALLOCATED', 'PRODUCT_UNPUBLISHED', 'USED_OFFER_UNAVAILABLE'])('fully allocated %s lines do not block unrelated new intent', reason => {
    const allocated = line({ quantity: 2, allocatedQuantity: 2, unallocatedQuantity: 0, availability: { status: 'UNAVAILABLE', reason, availableQuantity: 8 } })
    const fresh = line({ productListingId: 42 })
    expect(cartCheckoutBlocked([allocated, fresh])).toBe(false)
    expect(availableCartSubtotal([allocated, fresh])).toBe(1000)
    expect(orderInput([allocated, fresh], address).items).toEqual([{ productListingId: 42, quantity: 1 }])
  })
  it('partially allocated insufficient intent remains blocked even when the allocated part is safe', () => {
    const item = line({ quantity: 4, allocatedQuantity: 2, unallocatedQuantity: 2, availability: { status: 'INSUFFICIENT_STOCK', reason: 'INSUFFICIENT_STOCK', availableQuantity: 1 } })
    expect(cartCheckoutBlocked([item])).toBe(true)
    expect(() => orderInput([item], address)).toThrow()
  })
  it('uses EN/FR page language for explanations, labels, pending allocations and resolution actions', async () => {
    setup(); document.documentElement.lang = 'fr-FR'
    await render([line({ quantity: 4, unallocatedQuantity: 4, availability: { status: 'INSUFFICIENT_STOCK', reason: 'INSUFFICIENT_STOCK', availableQuantity: 2 } })])
    expect(container.textContent).toContain('Seulement 2 disponible(s)')
    expect(container.textContent).toContain('Sous-total des articles disponibles')
    expect(container.textContent).toContain('Réduire la quantité à 2')
    expect(container.querySelector('article')?.getAttribute('aria-describedby')).toBe('cart-availability-41')
    for (const reason of ['PRODUCT_UNPUBLISHED', 'LISTING_INACTIVE', 'USED_OFFER_UNAVAILABLE', 'OUT_OF_STOCK', 'CART_QUANTITY_ALLOCATED', 'CART_QUANTITY_UNAVAILABLE', 'INVENTORY_RESERVATION_CONFLICT']) expect(availabilityMessage(reason)).not.toMatch(/Remove|pending order|stock is/)
    expect(cartCopy().orders).toBe('Voir mes commandes')
    document.documentElement.lang = 'en'
    expect(cartCopy().orders).toBe('View My Orders')
  })
  it('keeps removal actionable for an unavailable item and confirms it in French', async () => {
    setup(); document.documentElement.lang = 'fr'
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()
    const item = line({ availability: { status: 'OUT_OF_STOCK', reason: 'OUT_OF_STOCK', availableQuantity: 0 } })
    await render([item])
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retirer')!.click())
    expect(container.querySelector('dialog')?.textContent).toContain('Retirer cet article ?')
    expect(container.querySelector('dialog')?.textContent).toContain('Le garder')
    expect(context.removeItem).not.toHaveBeenCalled()
    await act(async () => container.querySelector<HTMLButtonElement>('dialog .remove-item-dialog__remove')!.click())
    expect(context.removeItem).toHaveBeenCalledExactlyOnceWith(41)
    expect(container.querySelector('dialog')).toBeNull()
    expect(item.quantity).toBe(1)
  })

})


describe('targeted allocation review regressions', () => {
  it.each([
    ['en', '1 allocated to a pending order', '4 requested for a new checkout', '2 in stock for a new checkout', '4 available for a new checkout'],
    ['fr', '1 réservé(s) pour une commande en attente', '4 demandé(s) pour une nouvelle commande', '2 en stock pour une nouvelle commande', '4 disponible(s) pour une nouvelle commande'],
  ])('distinguishes allocated, requested and stock quantities in %s', async (lang, allocated, requested, stock, misleading) => {
    setup(); document.documentElement.lang = lang
    await render([line({ quantity: 5, allocatedQuantity: 1, unallocatedQuantity: 4, availability: { status: 'INSUFFICIENT_STOCK', reason: 'INSUFFICIENT_STOCK', availableQuantity: 2 } })])
    expect(container.textContent).toContain(allocated)
    expect(container.textContent).toContain(requested)
    expect(container.textContent).toContain(stock)
    expect(container.textContent).not.toContain(misleading)
  })
  it('offers explicit reduction to allocated quantity when no new stock remains', async () => {
    setup()
    const item = line({ quantity: 3, allocatedQuantity: 1, unallocatedQuantity: 2, availability: { status: 'OUT_OF_STOCK', reason: 'OUT_OF_STOCK', availableQuantity: 0 } })
    await render([item])
    const reduce = container.querySelector<HTMLButtonElement>('.cart-item__reduce')!
    expect(reduce.textContent).toBe('Reduce quantity to 1')
    expect(context.updateQuantity).not.toHaveBeenCalled()
    expect(context.removeItem).not.toHaveBeenCalled()
    for (const button of container.querySelectorAll('article button')) {
      expect(button.getAttribute('aria-describedby')).toBe('cart-availability-41')
      expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toContain('Out of stock')
    }
    await act(async () => reduce.click())
    expect(context.updateQuantity).toHaveBeenCalledExactlyOnceWith(41, 1)
    expect(item).toMatchObject({ quantity: 3, allocatedQuantity: 1, unallocatedQuantity: 2 })
    await render([line({ quantity: 1, allocatedQuantity: 1, unallocatedQuantity: 0, availability: { status: 'UNAVAILABLE', reason: 'CART_QUANTITY_ALLOCATED', availableQuantity: 0 } })])
    expect(container.querySelector('.cart-item__reduce')).toBeNull()
    expect(container.textContent).toContain('Already in a pending order')
    expect(availableCartSubtotal([item])).toBe(0)
  })
  it.each([
    ['OUT_OF_STOCK', 'OUT_OF_STOCK', 0, 0],
    ['UNAVAILABLE', 'PRODUCT_UNPUBLISHED', 1, 0],
    ['UNAVAILABLE', 'LISTING_INACTIVE', 1, 0],
    ['UNAVAILABLE', 'USED_OFFER_UNAVAILABLE', 1, 0],
    ['AVAILABLE', null, 1, 2],
  ] as const)('does not offer reduction for %s / %s with allocation %s and stock %s', async (status, reason, allocatedQuantity, availableQuantity) => {
    setup()
    await render([line({ quantity: 3, allocatedQuantity, unallocatedQuantity: 3 - allocatedQuantity, availability: { status, reason, availableQuantity } })])
    expect(container.querySelector('.cart-item__reduce')).toBeNull()
    expect(context.updateQuantity).not.toHaveBeenCalled()
  })
  it('disables explicit reduction during a pending cart mutation', async () => {
    setup(); context.pendingItemIds = [41]
    await render([line({ quantity: 3, allocatedQuantity: 1, unallocatedQuantity: 2, availability: { status: 'OUT_OF_STOCK', reason: 'OUT_OF_STOCK', availableQuantity: 0 } })])
    const reduce = container.querySelector<HTMLButtonElement>('.cart-item__reduce')!
    expect(reduce.disabled).toBe(true)
    await act(async () => reduce.click())
    expect(context.updateQuantity).not.toHaveBeenCalled()
  })
})
