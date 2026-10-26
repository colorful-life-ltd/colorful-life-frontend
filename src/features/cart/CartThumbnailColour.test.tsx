// @vitest-environment jsdom
// Regression: items restored at sign-in that were reserved for a pending order rendered grey, while items added
// afterwards were in colour. Reserved quantity is the customer's own order intent, not unavailable stock.
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../auth/api'
import { CartItems } from '../../components/cart/CartItems'
import { CartProvider } from './CartProvider'
import { availableCartSubtotal, cartCheckoutBlocked, useCart } from './CartContext'
import { addCartItem, getCart, type PersistentCartItem } from './api'
import { cartListing, offer } from '../catalogue/catalogueFixtures'

vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), getCart: vi.fn(), addCartItem: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const reserved: PersistentCartItem = { productListingId: 41, quantity: 1, allocatedQuantity: 1, unallocatedQuantity: 0, productListing: cartListing(offer(41)),
  availability: { status: 'UNAVAILABLE', reason: 'CART_QUANTITY_ALLOCATED', availableQuantity: 3 } }
const fresh: PersistentCartItem = { productListingId: 42, quantity: 1, allocatedQuantity: 0, unallocatedQuantity: 1, productListing: cartListing(offer(42)),
  availability: { status: 'AVAILABLE', reason: null, availableQuantity: 3 } }
const soldOut: PersistentCartItem = { ...fresh, productListingId: 43, productListing: cartListing(offer(43)), availability: { status: 'OUT_OF_STOCK', reason: 'OUT_OF_STOCK', availableQuantity: 0 } }

let root: Root, container: HTMLDivElement, cart: ReturnType<typeof useCart>
function Cart() {
  const value = useCart()
  useEffect(() => { cart = value }, [value])
  return <CartItems items={value.items} />
}
const card = (id: number) => container.querySelector<HTMLElement>(`[data-cart-listing-id="${id}"]`)!
const greyed = (id: number) => card(id).classList.contains('cart-item--unavailable')

beforeEach(async () => {
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt')
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.invalid', firstName: null, lastName: null, phone: null })
  vi.mocked(getCart).mockResolvedValue({ items: [reserved] })
  vi.mocked(addCartItem).mockResolvedValue({ items: [reserved, fresh] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CartProvider><Cart /></CartProvider></AuthProvider>))
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = '' })

it('keeps a restored pending-order item in colour, before and after a new item is added, with its restrictions intact', async () => {
  expect(getCart).toHaveBeenCalledExactlyOnceWith('customer-jwt')
  const restoredImage = card(41).querySelector('img')!.getAttribute('src')
  expect(greyed(41)).toBe(false); expect(card(41).classList.contains('cart-item--allocated')).toBe(true)
  // The pending-order restriction itself is unchanged.
  expect(card(41).textContent).toContain('Already in a pending order')
  expect(cart.items[0]).toMatchObject({ allocatedQuantity: 1, unallocatedQuantity: 0 })
  expect(availableCartSubtotal(cart.items)).toBe(0); expect(cartCheckoutBlocked(cart.items)).toBe(false)

  await act(async () => { expect(await cart.addListing(offer(42))).toBe(true) })
  // Same product, same appearance, regardless of when it entered the cart; the new item is in colour too.
  expect(card(41).querySelector('img')!.getAttribute('src')).toBe(restoredImage)
  expect(greyed(41)).toBe(false); expect(greyed(42)).toBe(false)
  expect(card(42).classList.contains('cart-item--allocated')).toBe(false)
  expect(availableCartSubtotal(cart.items)).toBe(availableCartSubtotal([cart.items[1]]))
})

it('still greys genuinely unavailable stock, whether restored or newly added', async () => {
  vi.mocked(addCartItem).mockResolvedValue({ items: [reserved, fresh, soldOut] })
  await act(async () => { await cart.addListing(offer(42)) })
  expect(greyed(43)).toBe(true); expect(card(43).classList.contains('cart-item--allocated')).toBe(false)
  expect(greyed(41)).toBe(false); expect(greyed(42)).toBe(false)
  expect(cartCheckoutBlocked(cart.items)).toBe(true)
})
