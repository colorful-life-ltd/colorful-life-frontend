import type { CatalogueCategory } from '../../components/catalogue/categories'
import { sellableOffers, type CatalogueProduct } from '../catalogue/api'
import { SITE_NAME, productPath } from './routeHead'

type JsonLd = Record<string, unknown>

/**
 * Product structured data from verified API fields only. Prices appear only for
 * sellable offers; a product without one is OutOfStock with no price. No
 * ratings, reviews or business details exist in the API, so none are emitted.
 */
export function productJsonLd(product: CatalogueProduct, origin: string): JsonLd {
  const url = `${origin}${productPath(product.id)}`
  const images = [...new Set(product.productImages.map(image => image.url.trim()).filter(Boolean))]
  const offers = sellableOffers(product).map(offer => ({
    '@type': 'Offer',
    price: offer.effectivePrice,
    priceCurrency: 'GBP',
    availability: 'https://schema.org/InStock',
    // Outer-box-damage offers await a business decision on schema.org condition.
    ...(offer.condition === 'NEW' ? { itemCondition: 'https://schema.org/NewCondition' } : {}),
    url,
  }))
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.setNumber,
    brand: { '@type': 'Brand', name: 'LEGO' },
    ...(product.description?.trim() ? { description: product.description.trim() } : {}),
    ...(images.length ? { image: images } : {}),
    url,
    offers: offers.length ? offers : { '@type': 'Offer', availability: 'https://schema.org/OutOfStock', url },
  }
}

export function productBreadcrumbJsonLd(product: CatalogueProduct, category: CatalogueCategory | undefined, origin: string): JsonLd {
  const trail = [
    { name: SITE_NAME, item: `${origin}/` },
    ...(category ? [{ name: category.label, item: `${origin}${category.href}` }] : []),
    { name: product.title, item: `${origin}${productPath(product.id)}` },
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })),
  }
}
