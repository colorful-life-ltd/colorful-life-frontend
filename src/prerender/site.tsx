/* eslint-disable react-refresh/only-export-components -- build-time module, never hot-reloaded */
/**
 * Build-time prerendering of the public, indexable routes (scripts/prerender.mjs).
 * Head data comes from the same functions the running app uses, so the static
 * HTML and the client-managed head always agree. React's createRoot (main.tsx)
 * replaces the static #root content on mount; nothing is hydrated.
 */
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { categoryLocation, legalLocation, productDetailsLocation, productPath } from '../components/catalogue/catalogueSpread'
import { resolveCatalogueCategories, type CatalogueCategory } from '../components/catalogue/categories'
import { LegalDocument } from '../components/legal/CustomerInformation'
import { SiteFooter } from '../components/legal/LegalLayout'
import { productAvailabilityLabel, sellableOffers, type BackendCategory, type CatalogueProduct } from '../features/catalogue/api'
import { LEGAL_PAGES } from '../features/legal/routes'
import { SITE_NAME, catalogueRouteHead, type RouteHead } from '../features/seo/routeHead'
import { productBreadcrumbJsonLd, productJsonLd } from '../features/seo/structuredData'

export interface CatalogueSnapshot {
  version: 1
  origin: string
  capturedAt: string
  categories: BackendCategory[]
  products: CatalogueProduct[]
  /** The live sitemap captured with the catalogue; prerendering must reproduce it exactly. */
  sitemapUrls: string[]
}

export interface PrerenderedRoute {
  path: string
  head: RouteHead
  structuredData: object[]
  body: ReactElement
}

const ageLabel = (age: string) => /^ages?\b/i.test(age) ? age : `Ages ${age}${/^\d+$/.test(age) ? '+' : ''}`
const lowestPrice = (product: CatalogueProduct) => {
  const prices = sellableOffers(product).map(offer => Number(offer.effectivePrice)).filter(Number.isFinite)
  return prices.length ? `£${Math.min(...prices).toFixed(2)}` : null
}
const paragraphs = (text: string | null) => (text ?? '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)

function Page({ children }: { children: ReactElement | ReactElement[] }) {
  return <>
    <main className="prerendered-page">
      <p><a href="/">{SITE_NAME}</a></p>
      {children}
    </main>
    <SiteFooter />
  </>
}

function ProductList({ products, categories }: { products: CatalogueProduct[]; categories: CatalogueCategory[] }) {
  return <ul>{products.map(product => {
    const category = categories.find(item => item.backendId === product.category?.id)
    return <li key={product.id}>
      <a href={productPath(product.id)}>{product.title} (LEGO® {product.setNumber})</a>
      {category ? ` · ${category.label}` : ''} · {productAvailabilityLabel(product)}
    </li>
  })}</ul>
}

function ProductBody({ product, category }: { product: CatalogueProduct; category?: CatalogueCategory }) {
  const age = product.ageRecommendation?.trim()
  const price = lowestPrice(product)
  const image = [...product.productImages].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  return <Page>
    <nav aria-label="Breadcrumb"><a href="/">{SITE_NAME}</a>{category && <> › <a href={category.href}>{category.label}</a></>} › {product.title}</nav>
    <h1>{product.title}</h1>
    <p>LEGO® set {product.setNumber}</p>
    {image ? <img src={image.url} alt={image.altText?.trim() || `LEGO® ${product.setNumber} ${product.title}`} loading="lazy" /> : <></>}
    <ul aria-label="Product information">
      {product.theme ? <li>{product.theme}</li> : <></>}
      {product.pieceCount != null ? <li>{product.pieceCount} pieces</li> : <></>}
      {age ? <li>{ageLabel(age)}</li> : <></>}
      <li>{productAvailabilityLabel(product)}</li>
      {price ? <li>{price}</li> : <></>}
    </ul>
    <>{paragraphs(product.description).map((text, index) => <p key={index}>{text}</p>)}</>
  </Page>
}

function CategoryBody({ category, products, categories }: { category: CatalogueCategory; products: CatalogueProduct[]; categories: CatalogueCategory[] }) {
  const backend = category.backendCategory
  return <Page>
    <h1>{category.label} LEGO® sets</h1>
    <>{[backend.subtitle, backend.description].filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</>
    <ProductList products={products} categories={categories} />
  </Page>
}

function HomeBody({ categories, products }: { categories: CatalogueCategory[]; products: CatalogueProduct[] }) {
  return <Page>
    <h1>LEGO® sets with UK delivery</h1>
    <p>Build &amp; Bloom is a UK seller of new LEGO® sets, bringing together familiar themes and thoughtful finds in one illustrated catalogue. Each product page shows the information available for that set, including its LEGO set number and current availability.</p>
    <p>Build &amp; Bloom is an independent retailer and is not affiliated with or endorsed by the LEGO Group.</p>
    <nav aria-label="Browse LEGO set categories">
      <h2>Explore the collections</h2>
      <ul>{categories.map(category => <li key={category.backendId}><a href={category.href}>{category.label}</a></li>)}</ul>
    </nav>
    <nav aria-label="Browse published LEGO sets">
      <h2>Published LEGO sets</h2>
      <ProductList products={products} categories={categories} />
    </nav>
  </Page>
}

/** Every public indexable route, in sitemap order: home, Help and legal pages, categories, products. */
export function publicRoutes(snapshot: CatalogueSnapshot, origin: string): PrerenderedRoute[] {
  const products = snapshot.products.filter(product => product.isPublished !== false)
  const allCategories = resolveCatalogueCategories(snapshot.categories)
  const categories = allCategories.filter(category => products.some(product => product.category?.id === category.backendId))
  const base = { categories: allCategories, categoriesReady: true }
  const home = catalogueRouteHead({ ...base, spread: 'front-matter', open: false })
  return [
    { path: '/', head: home, structuredData: [], body: <HomeBody categories={categories} products={products} /> },
    ...LEGAL_PAGES.map(page => ({
      path: page.path, structuredData: [],
      head: catalogueRouteHead({ ...base, spread: legalLocation(page.slug), open: true }),
      body: <Page><LegalDocument page={page.slug} /></Page>,
    })),
    ...categories.map(category => ({
      path: category.href, structuredData: [],
      head: catalogueRouteHead({ ...base, spread: categoryLocation(category.id, allCategories), open: true }),
      body: <CategoryBody category={category} categories={allCategories} products={products.filter(product => product.category?.id === category.backendId)} />,
    })),
    ...products.map(product => {
      const category = allCategories.find(item => item.backendId === product.category?.id)
      return {
        path: productPath(product.id),
        head: catalogueRouteHead({ ...base, spread: productDetailsLocation(product.id), open: true, product }),
        structuredData: [productJsonLd(product, origin), productBreadcrumbJsonLd(product, category, origin)],
        body: <ProductBody product={product} category={category} />,
      }
    }),
  ]
}

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, '&quot;')

/** Replaces exactly one occurrence, so a template change can never silently drop route metadata. */
function replaceOnce(html: string, pattern: RegExp, replacement: string) {
  const matches = html.match(new RegExp(pattern.source, 'g'))
  if (matches?.length !== 1) throw Error(`Template must contain exactly one ${pattern.source}`)
  return html.replace(pattern, () => replacement)
}

/** Static head tags use the same selectors as applyRouteHead, which updates them in place. */
function withHead(template: string, head: RouteHead, origin: string, structuredData: readonly object[]) {
  const canonical = head.canonicalPath === null ? null : `${origin}${head.canonicalPath}`
  let html = replaceOnce(template, /<title>[^<]*<\/title>/, `<title>${escapeText(head.title)}</title>`)
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeAttribute(head.description)}" />`)
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeAttribute(head.title)}" />`)
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeAttribute(head.description)}" />`)
  const tags = [
    `<meta name="robots" content="${head.robots}" />`,
    ...(canonical ? [`<link rel="canonical" href="${escapeAttribute(canonical)}" />`, `<meta property="og:url" content="${escapeAttribute(canonical)}" />`] : []),
    ...(structuredData.length ? [`<script id="route-structured-data" type="application/ld+json">${JSON.stringify(structuredData.length === 1 ? structuredData[0] : structuredData).replace(/</g, '\\u003c')}</script>`] : []),
  ]
  return replaceOnce(html, /\n\s*<\/head>/, `\n    ${tags.join('\n    ')}\n  </head>`)
}

/** Static content replaces the template's JavaScript-only <noscript> fallback. */
function withBody(html: string, body: ReactElement) {
  const withoutFallback = replaceOnce(html, /\s*<noscript>[\s\S]*?<\/noscript>/, '')
  return replaceOnce(withoutFallback, /<div id="root"><\/div>/, `<div id="root">${renderToStaticMarkup(body)}</div>`)
}

export function renderRouteHtml(template: string, route: PrerenderedRoute, origin: string) {
  return withBody(withHead(template, route.head, origin, route.structuredData), route.body)
}

/** A static, non-indexable page for nginx to serve with HTTP 404; it does not start the app. */
export function renderNotFoundHtml(template: string, origin: string) {
  const head: RouteHead = { title: `Page not found | ${SITE_NAME}`, description: 'This page does not exist.', canonicalPath: null, robots: 'noindex,follow' }
  let html = withHead(template, head, origin, [])
  html = replaceOnce(html, /\s*<script type="module"[^>]*><\/script>/, '')
  return withBody(html, <Page><h1>Page not found</h1><p>This page does not exist. Browse the <a href="/">catalogue</a> or visit <a href="/help">Help &amp; FAQs</a>.</p></Page>)
}

export function sitemapXml(routes: readonly PrerenderedRoute[], origin: string) {
  const entries = routes.map(route => `<url><loc>${escapeAttribute(`${origin}${route.path}`)}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

/** dist-relative directory for generated files. dist/index.html stays the unchanged app shell. */
export const PRERENDER_DIRECTORY = 'prerendered'

/**
 * All generated files from one snapshot, keyed by dist-relative path. Fails when
 * the routes differ from the sitemap captured with that snapshot. Nothing here is
 * served until nginx maps public routes to prerendered/<path>/index.html.
 */
export function renderSite(snapshot: CatalogueSnapshot, template: string, origin: string): Record<string, string> {
  const routes = publicRoutes(snapshot, origin)
  const paths = routes.map(route => route.path)
  const captured = snapshot.sitemapUrls.map(url => new URL(url).pathname)
  if (new Set(paths).size !== paths.length) throw Error('Duplicate prerendered route')
  if (JSON.stringify(paths) !== JSON.stringify(captured)) throw Error('Prerendered routes differ from the sitemap captured with the catalogue snapshot')
  const files: Record<string, string> = {}
  for (const route of routes) files[`${PRERENDER_DIRECTORY}${route.path === '/' ? '' : route.path}/index.html`] = renderRouteHtml(template, route, origin)
  files[`${PRERENDER_DIRECTORY}/404.html`] = renderNotFoundHtml(template, origin)
  files[`${PRERENDER_DIRECTORY}/sitemap.xml`] = sitemapXml(routes, origin)
  return files
}
