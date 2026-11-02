import { useEffect, useState } from 'react'
import { getProducts, type CatalogueProduct } from '../../features/catalogue/api'
import type { CatalogueCategory } from '../catalogue/categories'
import './HomepageDiscovery.css'

export function HomepageDiscovery({ categories }: { categories: readonly CatalogueCategory[] }) {
  const [catalogue, setCatalogue] = useState<{ loaded: boolean; products: CatalogueProduct[] }>({ loaded: false, products: [] })
  useEffect(() => {
    const controller = new AbortController()
    getProducts({}, controller.signal).then(products => setCatalogue({ loaded: true, products })).catch(() => { if (!controller.signal.aborted) setCatalogue({ loaded: true, products: [] }) })
    return () => controller.abort()
  }, [])
  const visibleCategories = catalogue.loaded ? categories.filter(category => catalogue.products.some(product => product.category?.id === category.backendId)) : categories
  // Crawl/assistive-technology content only: the storybook is the visible homepage. See HomepageDiscovery.css.
  return <section className="homepage-discovery homepage-discovery--crawl-only" aria-labelledby="homepage-title">
    <div className="homepage-discovery__intro">
      <p className="homepage-discovery__eyebrow">A little shop for big imaginations</p>
      <h1 id="homepage-title">LEGO® sets with UK delivery</h1>
      <p>Build &amp; Bloom is a UK seller of new LEGO® sets, bringing together familiar themes and thoughtful finds in one illustrated catalogue. Browse the collections below or explore the storybook to discover sets by name and number. Each product page shows the information available for that set, including its LEGO set number and current availability.</p>
      <p>We deliver within the UK. Before ordering, please read our <a href="/legal/delivery-returns">delivery and returns information</a> for the current options, charges and your statutory rights. You can also find <a href="/help">answers to common questions</a> and <a href="/legal/contact">contact details</a>. Build &amp; Bloom is an independent retailer and is not affiliated with or endorsed by the LEGO Group.</p>
    </div>
    <nav aria-label="Browse LEGO set categories">
      <h2>Explore the collections</h2>
      <ul className="homepage-discovery__categories">{visibleCategories.map(category => <li key={category.backendId}><a href={category.href}>{category.label}</a></li>)}</ul>
    </nav>
    <nav aria-label="Browse published LEGO sets">
      <h2>Published LEGO sets</h2>
      <ul className="homepage-discovery__products">{catalogue.products.filter(product => product.isPublished !== false).map(product => <li key={product.id}><a href={`/products/${product.id}`}>{product.title} (LEGO {product.setNumber})</a></li>)}</ul>
    </nav>
  </section>
}
