import { describe, expect, it } from 'vitest'
import { catalogueHistoryState, catalogueLocationFromUrl, catalogueLocationHref, categoryLocation, categorySpreadAt, productDetailsLocation, productIdFromPath, productLocation, spreadAfterAction } from './catalogueSpread'
import { resolveCatalogueCategories } from './categories'
import { curatedBackendCategories } from './catalogueData.test-utils'

const categories = resolveCatalogueCategories(curatedBackendCategories)

describe('stable product URLs', () => {
  it('uses the LegoProduct ID, not a listing ID, as the product URL', () => {
    const details = productDetailsLocation(88, productLocation('vehicles', 1))
    expect(catalogueLocationHref(details, { open: true })).toBe('/products/88')
  })

  it('round-trips product → details → Back through history state without putting context in the URL', () => {
    const page = productLocation('vehicles', 1)
    const details = productDetailsLocation(88, page)
    const state = JSON.parse(JSON.stringify(catalogueHistoryState(details)))
    const restored = catalogueLocationFromUrl('/products/88', '', categories, state)
    expect(restored).toEqual({ spread: details, open: true, leafletSide: null })
    expect(spreadAfterAction(restored.spread, 'backward', 2, 3, categories)).toEqual(page)
  })

  it('keeps category-opening return context', () => {
    const opening = categoryLocation('vehicles', categories)
    const details = productDetailsLocation(88, opening)
    expect(catalogueLocationFromUrl('/products/88', '', categories, catalogueHistoryState(details)).spread).toEqual(details)
  })

  it('opens a shared or crawled product URL without context and falls back to the category index for Back', () => {
    const restored = catalogueLocationFromUrl('/products/88', '', categories, null)
    expect(restored).toEqual({ spread: { kind: 'details', productId: 88 }, open: true, leafletSide: null })
    expect(spreadAfterAction(restored.spread, 'backward', 0, 3, categories)).toBe(categorySpreadAt(0))
  })

  it('ignores malformed or stale history state', () => {
    for (const state of [{ returnTo: { kind: 'products', slug: 'vehicles', index: -1 } }, { returnTo: { kind: 'category', slug: 'gone' } }, { returnTo: 'vehicles' }, { returnTo: { kind: 'products', slug: '' } }]) {
      expect(catalogueLocationFromUrl('/products/88', '', categories, state).spread).toEqual({ kind: 'details', productId: 88 })
    }
  })

  it('rejects malformed product paths', () => {
    for (const path of ['/products/', '/products/0', '/products/-1', '/products/abc', '/products/1.5', '/products/88/extra', '/products/99999999999999999999']) {
      expect(productIdFromPath(path)).toBeUndefined()
      expect(catalogueLocationFromUrl(path, '', categories).open).toBe(false)
    }
    expect(productIdFromPath('/products/88/')).toBe(88)
  })

  it('writes plain history state for every non-product location', () => {
    expect(catalogueHistoryState(productLocation('vehicles', 0))).toEqual({ catalogue: true })
    expect(catalogueHistoryState({ kind: 'details', listingId: 4, returnTo: categoryLocation('vehicles', categories) })).toEqual({ catalogue: true })
  })

  it('still opens legacy listing-keyed ?details= links with their original Back behaviour', () => {
    const page = productLocation('vehicles', 1)
    const legacy = catalogueLocationFromUrl('/categories/vehicles', '?details=808&page=2', categories)
    expect(legacy.spread).toEqual({ kind: 'details', listingId: 808, returnTo: page })
    expect(catalogueLocationHref(legacy.spread, { open: true })).toBe('/categories/vehicles?details=808&page=2')
    expect(spreadAfterAction(legacy.spread, 'backward', 2, 3, categories)).toEqual(page)
  })
})
