// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import shell from '../../index.html?raw'
import snapshotJson from './catalogue-snapshot.json?raw'
import { sellableOffers } from '../features/catalogue/api'
import { applyRouteHead } from '../features/seo/documentHead'
import { isPrivatePath } from '../features/seo/routeHead'
import { publicRoutes, renderSite, type CatalogueSnapshot } from './site'

const ORIGIN = 'https://build-and-bloom.co.uk'
const snapshot = JSON.parse(snapshotJson) as CatalogueSnapshot
const files = renderSite(snapshot, shell, ORIGIN)
const routes = publicRoutes(snapshot, ORIGIN)
const fileFor = (path: string) => files[`prerendered${path === '/' ? '' : path}/index.html`]
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const pages = routes.map(route => ({ route, doc: parse(fileFor(route.path)) }))
const text = (doc: Document) => doc.getElementById('root')!.textContent!.replace(/\s+/g, ' ').trim()

describe('prerendered public routes', () => {
  it('covers exactly the URLs of the sitemap captured with the catalogue snapshot', () => {
    expect(routes.map(route => `${ORIGIN}${route.path}`)).toEqual(snapshot.sitemapUrls)
    const published = snapshot.products.filter(product => product.isPublished !== false)
    expect(routes.filter(route => route.path.startsWith('/products/'))).toHaveLength(published.length)
    expect(routes.filter(route => route.path.startsWith('/categories/'))).toHaveLength(new Set(published.map(product => product.category?.id)).size)
    expect(routes.filter(route => route.path === '/help' || route.path.startsWith('/legal/'))).toHaveLength(7)
    for (const route of routes) expect(fileFor(route.path), route.path).toBeDefined()
  })

  it('emits a sitemap from the same snapshot', () => {
    const locs = [...files['prerendered/sitemap.xml'].matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
    expect(locs).toEqual(snapshot.sitemapUrls)
  })

  it('gives every page one unique title, description, robots, canonical and og:url in the initial HTML', () => {
    for (const { route, doc } of pages) {
      for (const selector of ['title', 'meta[name="description"]', 'meta[name="robots"]', 'link[rel="canonical"]', 'meta[property="og:url"]', 'meta[property="og:title"]', 'meta[property="og:description"]']) {
        expect(doc.querySelectorAll(selector), `${route.path} ${selector}`).toHaveLength(1)
      }
      expect(doc.title).toBe(route.head.title)
      expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${ORIGIN}${route.path}`)
      expect(doc.querySelector('meta[property="og:url"]')!.getAttribute('content')).toBe(`${ORIGIN}${route.path}`)
      expect(doc.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('index,follow')
    }
    expect(new Set(pages.map(({ doc }) => doc.title)).size).toBe(routes.length)
    expect(new Set(pages.map(({ doc }) => text(doc))).size).toBe(routes.length)
  })

  it('puts route-specific visible content in #root before any JavaScript runs', () => {
    for (const { route, doc } of pages) {
      expect(doc.querySelectorAll('h1'), route.path).toHaveLength(1)
      expect(doc.querySelector('noscript'), route.path).toBeNull()
      expect(text(doc).length, route.path).toBeGreaterThan(200)
    }
  })

  it('reproduces product facts from the catalogue without inventing price, stock or reviews', () => {
    for (const product of snapshot.products) {
      const doc = parse(fileFor(`/products/${product.id}`))
      const [ld, breadcrumb] = JSON.parse(doc.getElementById('route-structured-data')!.textContent!)
      expect(doc.querySelector('h1')!.textContent).toBe(product.title)
      expect(text(doc)).toContain(`LEGO® set ${product.setNumber}`)
      expect(ld).toMatchObject({ '@type': 'Product', name: product.title, sku: product.setNumber, url: `${ORIGIN}/products/${product.id}` })
      expect(ld).not.toHaveProperty('aggregateRating')
      expect(ld).not.toHaveProperty('review')
      const sellable = sellableOffers(product)
      if (sellable.length) {
        expect(ld.offers.map((offer: { price: string }) => offer.price)).toEqual(sellable.map(offer => offer.effectivePrice))
        expect(text(doc)).toMatch(/£\d+\.\d{2}/)
      } else {
        expect(ld.offers).toEqual({ '@type': 'Offer', availability: 'https://schema.org/OutOfStock', url: `${ORIGIN}/products/${product.id}` })
        expect(text(doc)).not.toMatch(/£\d/)
      }
      expect(breadcrumb['@type']).toBe('BreadcrumbList')
    }
  })

  it('never prerenders private or unknown routes, and serves unknown routes a non-indexable 404 page', () => {
    for (const route of routes) expect(isPrivatePath(route.path), route.path).toBe(false)
    for (const path of ['/checkout', '/account', '/account/orders', '/verify-email', '/reset-password', '/products/99999999', '/categories/no-such']) {
      expect(fileFor(path), path).toBeUndefined()
    }
    const notFound = parse(files['prerendered/404.html'])
    expect(notFound.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('noindex,follow')
    expect(notFound.querySelector('link[rel="canonical"]')).toBeNull()
    expect(notFound.querySelector('script[type="module"]')).toBeNull()
    expect(Object.keys(files).every(name => name.startsWith('prerendered/'))).toBe(true)
  })

  it('rejects a snapshot whose routes differ from its captured sitemap', () => {
    expect(() => renderSite({ ...snapshot, sitemapUrls: snapshot.sitemapUrls.slice(1) }, shell, ORIGIN)).toThrow(/differ/)
  })
})

describe('browser behaviour on a prerendered page', () => {
  it('updates the static head in place and replaces the static content when the app mounts', async () => {
    const route = routes.find(item => item.path.startsWith('/products/'))!
    const doc = parse(fileFor(route.path))
    document.head.innerHTML = doc.head.innerHTML
    document.body.innerHTML = doc.body.innerHTML
    applyRouteHead(route.head, route.structuredData)
    for (const selector of ['meta[name="description"]', 'meta[name="robots"]', 'link[rel="canonical"]', 'meta[property="og:url"]', '#route-structured-data']) {
      expect(document.head.querySelectorAll(selector), selector).toHaveLength(1)
    }
    // Without VITE_SITE_URL the client falls back to the serving origin; the one existing tag is updated.
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${window.location.origin}${route.path}`)
    const container = document.getElementById('root')!
    expect(container.querySelector('h1')).not.toBeNull()
    const root = createRoot(container)
    await act(async () => root.render(<p>Mounted application</p>))
    expect(container.innerHTML).toBe('<p>Mounted application</p>')
    root.unmount()
  })
})
