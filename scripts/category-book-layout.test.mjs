// @vitest-environment node
// Layout contracts jsdom cannot measure: the category book's product and opening pages choose their
// density from the page's own size, and can never overlap (they scroll inside the paper instead).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const read = path => readFileSync(new URL(`../src/components/${path}`, import.meta.url), 'utf8')
const products = read('catalogue/VehiclesProductPage.css')
const opening = read('catalogue/CategoryOpeningSpread.css')

describe('category book pages follow the page size, not the viewport width', () => {
  it('uses the BookShell page itself as the size container for product and opening pages only', () => {
    expect(products).toMatch(/\.book-shell__content:has\(> \.spread-page--vehicles, > \.spread-page--category-opening\) \{ container: book-page \/ size; \}/)
    expect(products).toMatch(/@container book-page \(max-height: 400px\) \{/)
  })
  it('no longer forces fixed 440px pages or switches to scrolling by viewport width', () => {
    for (const css of [products, opening]) expect(css).not.toMatch(/min-height: 440px/)
    expect(products).not.toMatch(/@media \(max-width: 1100px\)/)
  })
})

describe('product and opening pages cannot overlap', () => {
  it('lets the spread grow past the page so the paper scrolls, navigation included', () => {
    expect(products).toMatch(/\.spread-page--vehicles:has\(> \.vehicles-page\) \{ display: flex; flex-direction: column; height: auto; min-height: calc\(100% \+ 72px\); \}/)
    expect(opening).toMatch(/\.spread-page--category-opening\.spread-page--right \{ display: flex; flex-direction: column; height: auto; min-height: calc\(100% \+ 72px\);/)
  })
  it('keeps rows at least as tall as their text plus the artwork floor', () => {
    expect(products).toMatch(/\.vehicles-supporting-products \{[^}]*grid-template-rows: repeat\(2, minmax\(min-content, 1fr\)\)/)
    expect(products).toMatch(/\.vehicle-product__art--supporting, \.vehicle-product__art--feature \{ contain: size; \}/)
    expect(products).not.toMatch(/grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/)
  })
  it('lets short pages shrink artwork before text', () => {
    const start = products.indexOf('@container book-page (max-height: 400px)')
    const compact = products.slice(start, products.indexOf('\n}\n', start))
    expect(compact).toMatch(/min-height: 56px; margin: 0 0 -2px;/)
    expect(compact).not.toMatch(/font-size/)
  })
})
