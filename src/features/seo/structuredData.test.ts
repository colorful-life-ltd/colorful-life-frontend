import { describe, expect, it } from 'vitest'
import { resolveCatalogueCategories } from '../../components/catalogue/categories'
import { offer, product, fixtureCategory } from '../catalogue/catalogueFixtures'
import { productBreadcrumbJsonLd, productJsonLd } from './structuredData'

const origin = 'https://shop.test'
const soldOut = { currentStock: 0, availableStock: 0 }

describe('Product structured data from verified API data', () => {
  it('describes an in-stock product with its real GBP price and NEW condition', () => {
    const data = productJsonLd(product(1, [offer(11, { legoProductId: 1, effectivePrice: '25.99' })], { setNumber: '42226', title: 'Truck' }), origin)
    expect(data).toMatchObject({
      '@type': 'Product', name: 'Truck', sku: '42226', url: 'https://shop.test/products/1', image: ['/product-image-1.jpg'],
      offers: [{ '@type': 'Offer', price: '25.99', priceCurrency: 'GBP', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' }],
    })
  })

  it('marks a zero-stock product OutOfStock without inventing a price', () => {
    const data = productJsonLd(product(2, [offer(21, { legoProductId: 2, ...soldOut })]), origin)
    expect(data.offers).toEqual({ '@type': 'Offer', availability: 'https://schema.org/OutOfStock', url: 'https://shop.test/products/2' })
    expect(JSON.stringify(data)).not.toContain('price')
  })

  it('treats a product whose offers are all sold out or inactive as OutOfStock', () => {
    const data = productJsonLd(product(3, [
      offer(31, { legoProductId: 3, ...soldOut }),
      offer(32, { legoProductId: 3, condition: 'USED_LIKE_NEW', usedLifecycle: 'SOLD', availableStock: 0 }),
      offer(33, { legoProductId: 3, active: false }),
    ]), origin)
    expect(data.offers).toMatchObject({ availability: 'https://schema.org/OutOfStock' })
    expect(JSON.stringify(data)).not.toContain('price')
  })

  it('lists only sellable offers when stock is mixed, leaving damaged-box condition undeclared', () => {
    const data = productJsonLd(product(4, [
      offer(41, { legoProductId: 4, ...soldOut, effectivePrice: '30.00' }),
      offer(42, { legoProductId: 4, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', availableStock: 1, effectivePrice: '21.25' }),
    ]), origin)
    expect(data.offers).toEqual([{ '@type': 'Offer', price: '21.25', priceCurrency: 'GBP', availability: 'https://schema.org/InStock', url: 'https://shop.test/products/4' }])
  })

  it('handles a product with no offers at all', () => {
    expect(productJsonLd(product(5, []), origin).offers).toMatchObject({ availability: 'https://schema.org/OutOfStock' })
  })

  it('emits no ratings, reviews or business details and omits absent fields', () => {
    const json = JSON.stringify(productJsonLd(product(6, [offer(6)], { description: null, productImages: [] }), origin))
    for (const field of ['aggregateRating', 'review', 'seller', 'description', 'image']) expect(json).not.toContain(`"${field}"`)
  })

  it('builds a breadcrumb trail from the resolved category', () => {
    const [vehicles] = resolveCatalogueCategories([fixtureCategory])
    expect(productBreadcrumbJsonLd(product(7, [offer(7)], { title: 'Truck' }), vehicles, origin).itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Build & Bloom', item: 'https://shop.test/' },
      { '@type': 'ListItem', position: 2, name: 'Vehicles', item: 'https://shop.test/categories/vehicles' },
      { '@type': 'ListItem', position: 3, name: 'Truck', item: 'https://shop.test/products/7' },
    ])
  })
})
