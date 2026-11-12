// Captures the public catalogue used by build-time prerendering (scripts/prerender.mjs).
// Usage: node scripts/catalogue-snapshot.mjs https://build-and-bloom.co.uk
// Reads only the public storefront API and sitemap; never sends credentials.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const SNAPSHOT_PATH = fileURLToPath(new URL('../src/prerender/catalogue-snapshot.json', import.meta.url))

async function json(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'error' })
  if (!response.ok) throw Error(`${url} returned ${response.status}`)
  return response.json()
}

export async function captureSnapshot(origin) {
  if (!/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw Error('An https origin without a path is required')
  const categories = await json(`${origin}/api/categories`)
  const products = []
  for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
    const data = await json(`${origin}/api/products?page=${page}&pageSize=100`)
    products.push(...data.items)
    totalPages = data.pagination.totalPages
  }
  const sitemap = await fetch(`${origin}/sitemap.xml`, { redirect: 'error' })
  if (!sitemap.ok) throw Error(`sitemap returned ${sitemap.status}`)
  const sitemapUrls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  return {
    version: 1,
    origin,
    capturedAt: new Date().toISOString(),
    categories: [...categories].sort((a, b) => a.id - b.id),
    products: products.sort((a, b) => a.id - b.id),
    sitemapUrls,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = await captureSnapshot(process.argv[2] ?? 'https://build-and-bloom.co.uk')
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`Catalogue snapshot: ${snapshot.categories.length} categories, ${snapshot.products.length} products, ${snapshot.sitemapUrls.length} sitemap URLs`)
}
