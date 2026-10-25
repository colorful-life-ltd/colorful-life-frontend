import type { CatalogueCategory } from '../../components/catalogue/categories'
import type { CatalogueSpread } from '../../components/catalogue/catalogueSpread'
import { isCategoryIndexSpread, productPath } from '../../components/catalogue/catalogueSpread'

export { productPath }
import type { CatalogueProduct } from '../catalogue/api'
import { isResetPasswordPath } from '../auth/passwordReset'
import { legalPageBySlug } from '../legal/routes'

export const SITE_NAME = 'Build & Bloom'
export const DEFAULT_DESCRIPTION = 'Explore the Build & Bloom illustrated catalogue of LEGO® sets. Browse themed collections and find a set by name or set number.'

export type RobotsDirective = 'index,follow' | 'noindex,follow' | 'noindex,nofollow'

/** Route metadata. A null canonical means the page must not declare one. */
export interface RouteHead {
  title: string
  description: string
  canonicalPath: string | null
  robots: RobotsDirective
}

const PRIVATE_HEAD: RouteHead = { title: SITE_NAME, description: DEFAULT_DESCRIPTION, canonicalPath: null, robots: 'noindex,nofollow' }

/** Account, checkout, orders, verification and password reset are never indexable. This is not access control. */
export function isPrivatePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/checkout' || path.startsWith('/checkout/') || path === '/account' || path.startsWith('/account/') || path === '/verify-email' || isResetPasswordPath(path)
}

export function privateRouteHead(pathname: string): RouteHead {
  const path = pathname.replace(/\/+$/, '')
  const title = path === '/verify-email' ? 'Verify your email' : isResetPasswordPath(path) ? 'Reset your password' : path.startsWith('/checkout') ? 'Checkout' : path.startsWith('/account/orders') ? 'Your orders' : 'Your account'
  return { ...PRIVATE_HEAD, title: `${title} | ${SITE_NAME}` }
}

const clip = (text: string, length = 160) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= length ? clean : `${clean.slice(0, length - 1).replace(/\s+\S*$/, '')}…`
}

export function catalogueRouteHead({ spread, open, categories, categoriesReady, product, productMissing = false }: {
  spread: CatalogueSpread
  open: boolean
  categories: readonly CatalogueCategory[]
  categoriesReady: boolean
  /** Resolved product for product-detail locations, when known. */
  product?: CatalogueProduct
  /** True only once the API has definitively not returned the requested product. */
  productMissing?: boolean
}): RouteHead {
  const home: RouteHead = { title: `${SITE_NAME} | LEGO® sets catalogue`, description: DEFAULT_DESCRIPTION, canonicalPath: '/', robots: 'index,follow' }
  if (!open || spread === 'front-matter' || spread === 'opening') return home
  if (isCategoryIndexSpread(spread)) return { ...home, title: `Our Catalogue | ${SITE_NAME}`, description: 'Browse every Build & Bloom collection of LEGO® sets.', canonicalPath: '/' }

  if (spread.kind === 'legal') {
    const page = legalPageBySlug(spread.page)
    return { title: `${page.title} | ${SITE_NAME}`, description: page.description, canonicalPath: page.path, robots: 'index,follow' }
  }

  if (spread.kind === 'details') {
    if (product) {
      const lead = product.description?.trim() || `LEGO® ${product.setNumber} ${product.title}.`
      return { title: `${product.title} (${product.setNumber}) | ${SITE_NAME}`, description: clip(lead), canonicalPath: productPath(product.id), robots: 'index,follow' }
    }
    return { ...home, title: `Product details | ${SITE_NAME}`, canonicalPath: null, robots: productMissing ? 'noindex,follow' : 'index,follow' }
  }

  const category = categories.find(item => item.id === spread.slug)
  if (!category) return { ...home, title: `Collection | ${SITE_NAME}`, canonicalPath: null, robots: categoriesReady ? 'noindex,follow' : 'index,follow' }
  const backend = category.backendCategory
  const description = clip(backend.description?.trim() || backend.subtitle?.trim() || `Browse the ${category.label} collection of LEGO® sets at ${SITE_NAME}.`)
  // Later product spreads hold different products, so they keep their own canonical.
  const canonicalPath = spread.kind === 'products' && spread.index > 0 ? `${category.href}?page=${spread.index + 1}` : category.href
  return { title: `${category.label} LEGO® sets | ${SITE_NAME}`, description, canonicalPath, robots: 'index,follow' }
}

/** Configured public origin, else the serving origin. Never a guessed domain. */
export function siteOrigin(configured = import.meta.env.VITE_SITE_URL as string | undefined) {
  const value = configured?.trim()
  if (value && /^https?:\/\/[^/]+/.test(value)) return value.replace(/\/+$/, '')
  return typeof window === 'undefined' ? null : window.location.origin
}

export function absoluteUrl(path: string, origin = siteOrigin()) {
  return origin ? `${origin}${path}` : null
}
