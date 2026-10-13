// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogueProduct, CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import { LeafletProduct } from '../leaflet/LeafletProduct'
import { offer, product } from '../../features/catalogue/catalogueFixtures'
import { planProductSpreads, selectCategoryProducts } from '../../features/catalogue/productSpreads'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const soldOut = { currentStock: 0, availableStock: 0 }
const inStock = product(1, [offer(11, { legoProductId: 1, effectivePrice: '25.99' })])
const zeroStock = product(2, [offer(21, { legoProductId: 2, ...soldOut })])
const allSoldOut = product(3, [offer(31, { legoProductId: 3, ...soldOut }), offer(32, { legoProductId: 3, condition: 'USED_LIKE_NEW', usedLifecycle: 'SOLD', availableStock: 0 })])
const mixed = product(4, [offer(41, { legoProductId: 4, ...soldOut, effectivePrice: '30.00' }), offer(42, { legoProductId: 4, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Dent', availableStock: 1, effectivePrice: '21.25' })])
const noOffers = product(5, [])
const cart = (): CartContextValue => ({ items: [], isLoading: false, pendingItemIds: [], error: null, refreshCart: vi.fn(), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() })
const details = (item: ReturnType<typeof product>, onAddToCart = vi.fn()) =>
  renderToStaticMarkup(<CartContext.Provider value={cart()}><CatalogueProductDetails product={item} side="right" onAddToCart={onAddToCart} /></CartContext.Provider>)

let root: Root | undefined
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = '' })

describe('permanent catalogue: visibility is independent of sellable stock', () => {
  it('keeps in-stock, zero-stock, all-sold-out, mixed and offerless products in API order', () => {
    const products = [inStock, zeroStock, allSoldOut, mixed, noOffers]
    expect(selectCategoryProducts(products).others.map(item => item.id)).toEqual([1, 2, 3, 4, 5])
    expect(planProductSpreads(products).flatMap(spread => [...spread.left, ...spread.right]).map(item => item.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps a sold-out feature product as the category feature', () => {
    const feature = product(6, [offer(61, { legoProductId: 6, ...soldOut })], { isFeatureProduct: true })
    expect(selectCategoryProducts([inStock, feature]).feature).toBe(feature)
  })

  it('shows nothing the API did not publish: hidden products are never synthesised', () => {
    // Publication is decided by the API; the frontend only renders what it returns.
    const markup = renderToStaticMarkup(<VehiclesProductPage side="left" spread={planProductSpreads([inStock])[0]} categoryName="Vehicles" status="ready" onRetry={vi.fn()} onViewDetails={vi.fn()} />)
    expect(markup).toContain('data-product-id="1"')
    expect(markup.match(/data-product-id=/g)).toHaveLength(1)
  })
})

describe('sold-out product cards and details', () => {
  it('prints a real From price for an in-stock card', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={inStock} onViewDetails={vi.fn()} />)
    expect(markup).toContain('£25.99')
    expect(markup).not.toContain('Out of stock')
  })

  it.each([['zero stock', zeroStock], ['all offers sold out', allSoldOut], ['no offers', noOffers]])('labels a %s card Out of stock with no price', (_, item) => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={item} onViewDetails={vi.fn()} />)
    expect(markup).toContain('Out of stock')
    expect(markup).not.toContain('£')
    expect(markup).toContain(`href="/products/${item.id}"`)
  })

  it('prices a mixed product from its sellable offer only', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={mixed} onViewDetails={vi.fn()} />)
    expect(markup).toContain('£21.25')
    expect(markup).not.toContain('£30.00')
  })

  it.each([['zero stock', zeroStock], ['all offers sold out', allSoldOut], ['no offers', noOffers]])('keeps %s details viewable with purchase disabled and no price', (_, item) => {
    const markup = details(item)
    expect(markup).toContain(`data-detail-product-id="${item.id}"`)
    expect(markup).toContain(item.title)
    expect(markup).toContain(item.description!)
    expect(markup).toContain('Out of stock')
    expect(markup).not.toContain('£')
    expect(markup).not.toContain('Choose an offer')
    expect(markup).toMatch(/<button type="button" class="product-details__add" disabled="">/)
    expect(renderToStaticMarkup(<CatalogueProductDetails product={item} side="left" />)).toContain(`/product-image-${item.id}.jpg`)
  })

  it('offers only the sellable offer of a mixed product', () => {
    const markup = details(mixed)
    expect(markup).toContain('£21.25')
    expect(markup).not.toContain('£30.00')
    expect(markup).not.toMatch(/class="product-details__add" disabled/)
  })

  it('never adds a sold-out product to the cart, even if the disabled control is clicked', async () => {
    const onAddToCart = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<CartContext.Provider value={cart()}><CatalogueProductDetails product={allSoldOut} side="right" onAddToCart={onAddToCart} /></CartContext.Provider>))
    const button = container.querySelector<HTMLButtonElement>('.product-details__add')!
    expect(button.disabled).toBe(true)
    button.removeAttribute('disabled')
    await act(async () => button.click())
    expect(onAddToCart).not.toHaveBeenCalled()
  })

  it('opens sold-out products from leaflets by product ID', async () => {
    const onDetails = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<LeafletProduct product={noOffers} browseOnly linkedTitle onDetails={onDetails} />))
    expect(container.textContent).toContain('Out of stock')
    await act(async () => container.querySelector<HTMLButtonElement>('.leaflet-product__title-button')!.click())
    expect(onDetails).toHaveBeenCalledWith(5)
  })
})

describe('crawlable product links', () => {
  async function mountCard(item: ReturnType<typeof product>, onViewDetails = vi.fn()) {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<CatalogueProduct product={{ ...item, catalogueArtworkUrl: '/art.png' }} onViewDetails={onViewDetails} />))
    return { container, onViewDetails }
  }

  it('renders artwork and View Details as real links to the stable product URL', async () => {
    const { container } = await mountCard(mixed)
    const links = [...container.querySelectorAll('a')]
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/products/4', '/products/4'])
    expect(links.every(link => link.getAttribute('aria-label') === `View details for ${mixed.title}`)).toBe(true)
  })

  it('keeps the in-book page turn for a plain click', async () => {
    const { container, onViewDetails } = await mountCard(mixed)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    await act(async () => container.querySelector('.vehicle-product__details')!.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(onViewDetails).toHaveBeenCalledWith(4)
  })

  it.each(['ctrlKey', 'metaKey', 'shiftKey'] as const)('lets a %s click follow the link natively', async modifier => {
    const { container, onViewDetails } = await mountCard(mixed)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [modifier]: true })
    container.querySelector('.vehicle-product__art-button')!.addEventListener('click', clickEvent => clickEvent.preventDefault())
    await act(async () => container.querySelector('.vehicle-product__art-button')!.dispatchEvent(event))
    expect(onViewDetails).not.toHaveBeenCalled()
  })

  it('keeps the product URL stable when inventory and offers change', () => {
    const before = renderToStaticMarkup(<CatalogueProduct product={mixed} onViewDetails={vi.fn()} />).match(/href="([^"]+)"/)![1]
    const after = renderToStaticMarkup(<CatalogueProduct product={{ ...mixed, offers: [offer(99, { legoProductId: 4, ...soldOut })] }} onViewDetails={vi.fn()} />).match(/href="([^"]+)"/)![1]
    expect(after).toBe(before)
    expect(after).toBe('/products/4')
  })
})
