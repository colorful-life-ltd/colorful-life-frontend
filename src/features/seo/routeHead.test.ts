import { describe, expect, it } from 'vitest'
import { resolveCatalogueCategories } from '../../components/catalogue/categories'
import { catalogueLocationFromUrl, categoryLocation, categorySpreadAt, productDetailsLocation, productLocation } from '../../components/catalogue/catalogueSpread'
import { backendCategory, curatedBackendCategories } from '../../components/catalogue/catalogueData.test-utils'
import { offer, product } from '../catalogue/catalogueFixtures'
import { catalogueRouteHead, DEFAULT_DESCRIPTION, isPrivatePath, privateRouteHead, siteOrigin } from './routeHead'

const categories = resolveCatalogueCategories([
  ...curatedBackendCategories.filter(category => category.name !== 'Vehicles'),
  backendCategory(11, 'Vehicles', { subtitle: 'Built for the thrill', description: 'Cars, trucks and more.' }),
])
const head = (pathname: string, search = '', extra: Partial<Parameters<typeof catalogueRouteHead>[0]> = {}) => {
  const location = catalogueLocationFromUrl(pathname, search, categories)
  return catalogueRouteHead({ spread: location.spread, open: location.open, categories, categoriesReady: true, ...extra })
}

describe('route metadata and canonical URLs', () => {
  it('describes the homepage with the brand and an indexable root canonical', () => {
    expect(head('/')).toEqual({ title: 'Build & Bloom | LEGO® sets catalogue', description: DEFAULT_DESCRIPTION, canonicalPath: '/', robots: 'index,follow' })
  })

  it('canonicalises catalogue book spreads to the homepage', () => {
    for (const search of ['?spread=front-matter', '?spread=opening', '?spread=categories-primary', '?spread=categories-more']) {
      expect(head('/', search)).toMatchObject({ canonicalPath: '/', robots: 'index,follow' })
    }
    expect(head('/', '?spread=categories-primary').title).toBe('Our Catalogue | Build & Bloom')
  })

  it('uses backend category copy for category titles and descriptions', () => {
    expect(head('/categories/vehicles')).toEqual({
      title: 'Vehicles LEGO® sets | Build & Bloom', description: 'Cars, trucks and more.', canonicalPath: '/categories/vehicles', robots: 'index,follow',
    })
  })

  it('collapses category URL variants that show the same content onto one canonical', () => {
    for (const search of ['', '?leaflet=front', '?leaflet=back', '?page=1', '?page=0', '?page=abc', '?utm_source=mail']) {
      expect(head('/categories/vehicles', search).canonicalPath).toBe('/categories/vehicles')
    }
    expect(head('/categories/vehicles/').canonicalPath).toBe('/categories/vehicles')
  })

  it('keeps a self canonical for later product spreads, which list different products', () => {
    expect(head('/categories/vehicles', '?page=3').canonicalPath).toBe('/categories/vehicles?page=3')
    expect(catalogueRouteHead({ spread: productLocation('vehicles', 1), open: true, categories, categoriesReady: true }).canonicalPath).toBe('/categories/vehicles?page=2')
  })

  it('falls back to generated copy when a category has no description', () => {
    expect(head('/categories/city').description).toBe('Browse the City collection of LEGO® sets at Build & Bloom.')
  })

  it('does not index an unknown category once categories are known, but waits while they load', () => {
    const unknown = { kind: 'category' as const, slug: 'retired-theme', returnTo: categorySpreadAt(0) }
    expect(catalogueRouteHead({ spread: unknown, open: true, categories, categoriesReady: true })).toMatchObject({ canonicalPath: null, robots: 'noindex,follow' })
    expect(catalogueRouteHead({ spread: unknown, open: true, categories: [], categoriesReady: false })).toMatchObject({ canonicalPath: null, robots: 'index,follow' })
  })

  it('canonicalises product details to the stable product URL from either URL form', () => {
    const item = product(88, [offer(808, { legoProductId: 88 })], { title: 'Monster Truck', setNumber: '42226', description: 'A big truck.' })
    const expected = { title: 'Monster Truck (42226) | Build & Bloom', description: 'A big truck.', canonicalPath: '/products/88', robots: 'index,follow' }
    expect(head('/products/88', '', { product: item })).toEqual(expected)
    expect(head('/categories/vehicles', '?details=808&page=2', { product: item })).toEqual(expected)
  })

  it('keeps a sold-out product indexable at the same canonical URL', () => {
    const soldOut = product(88, [offer(808, { legoProductId: 88, currentStock: 0, availableStock: 0 })], { description: null, title: 'Monster Truck', setNumber: '42226' })
    expect(head('/products/88', '', { product: soldOut })).toMatchObject({ canonicalPath: '/products/88', robots: 'index,follow', description: 'LEGO® 42226 Monster Truck.' })
  })

  it('does not index a product the API did not return', () => {
    expect(head('/products/404', '', { productMissing: true })).toMatchObject({ canonicalPath: null, robots: 'noindex,follow' })
    expect(head('/products/404')).toMatchObject({ canonicalPath: null, robots: 'index,follow' })
  })

  it('trims long product descriptions to a search-friendly length', () => {
    const long = product(5, [offer(5)], { description: 'word '.repeat(100) })
    const description = catalogueRouteHead({ spread: productDetailsLocation(5, categoryLocation('vehicles', categories)), open: true, categories, categoriesReady: true, product: long }).description
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description.endsWith('…')).toBe(true)
  })
})

describe('private route indexing protection', () => {
  it.each(['/checkout', '/checkout/', '/checkout/orders/41', '/account/orders', '/account/orders/7', '/account', '/verify-email', '/reset-password', '/reset-password/'])('%s is noindex,nofollow with no canonical', path => {
    expect(isPrivatePath(path)).toBe(true)
    expect(privateRouteHead(path)).toMatchObject({ robots: 'noindex,nofollow', canonicalPath: null })
  })

  it.each(['/', '/categories/vehicles', '/products/88', '/checkouts', '/accounts', '/verify-email-help', '/reset-password-help', '/reset-password/extra'])('%s is not treated as private', path => {
    expect(isPrivatePath(path)).toBe(false)
  })

  it('titles private pages without exposing order or token details', () => {
    expect(privateRouteHead('/checkout/orders/41').title).toBe('Checkout | Build & Bloom')
    expect(privateRouteHead('/account/orders/7').title).toBe('Your orders | Build & Bloom')
    expect(privateRouteHead('/verify-email').title).toBe('Verify your email | Build & Bloom')
    expect(privateRouteHead('/reset-password').title).toBe('Reset your password | Build & Bloom')
    expect(privateRouteHead('/reset-password/').title).toBe('Reset your password | Build & Bloom')
  })
})

describe('canonical origin', () => {
  it('uses a configured absolute site URL without a trailing slash', () => {
    expect(siteOrigin('https://shop.example.co.uk/')).toBe('https://shop.example.co.uk')
  })

  it('ignores malformed configuration and falls back to the serving origin, never a guessed domain', () => {
    expect(siteOrigin('shop.example')).toBe(siteOrigin(undefined))
  })
})
