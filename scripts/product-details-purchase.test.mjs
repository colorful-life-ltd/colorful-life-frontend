// @vitest-environment node
// Layout contracts jsdom cannot measure: on short pages the purchase action stays in view, and the scrolling page
// shows that its details continue, without changing the book, its sizes, its scroll height or any text size.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const css = readFileSync(new URL('../src/components/catalogue/VehiclesProductPage.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/components/BookShell.css', import.meta.url), 'utf8')

it('names the page padding once in BookShell and keeps its 56px value', () => {
  expect(shell).toMatch(/\.book-shell \{[^}]*--page-padding-block: 56px;/)
  expect(shell.match(/padding: var\(--page-padding-block\) 60px;/g)).toHaveLength(2)
  // The purchase and fade rules read the variable (56px only as its fallback), never a copy of the value.
  const rules = css.slice(css.indexOf('/* The page scrolls inside the paper.'), css.indexOf('.vehicles-page__message'))
  expect(rules.replaceAll('var(--page-padding-block, 56px)', '')).not.toMatch(/56px/)
})
it('rests the purchase action in the page bottom margin until it scrolls into place', () => {
  expect(css).toMatch(/\.product-details__purchase \{ position: sticky; bottom: calc\(-1 \* var\(--page-padding-block, 56px\)\); z-index: 1;/)
  // Its paper backdrop is feathered on every side, so it never draws a box on the page's shading.
  expect(css).toMatch(/\.product-details__purchase::before \{[^}]*background: var\(--book-paper, #fff9e9\);[^}]*mask-composite: intersect; \}/)
})
it('keeps the resting button\'s focus ring (4px offset + 2px) inside the page without moving the layout', () => {
  expect(css).toMatch(/\.product-details__add:focus-visible \{ outline: 2px solid #326993; outline-offset: 4px;/)
  expect(css).toMatch(/\.product-details__purchase \{[^}]*margin: 0 -10px -8px; padding: 0 10px 8px; \}/)
  expect(css).toMatch(/\.product-details__add \{ scroll-margin-bottom: 8px; \}/)
})
it('keeps focused and revealed details clear of that margin', () => {
  expect(css).toMatch(/\.book-shell__content:has\(\.product-details__purchase\) \{ scroll-padding-bottom: var\(--page-padding-block, 56px\); \}/)
})
it('fades the foot of the page inside its padding, adding no scrollable height', () => {
  expect(css).toMatch(/article\.product-details::after \{ content: ''; position: sticky; bottom: calc\(-1 \* var\(--page-padding-block, 56px\)\); display: block; height: var\(--page-padding-block, 56px\); margin: 0 -26px calc\(-1 \* var\(--page-padding-block, 56px\)\);[^}]*pointer-events: none;\s*mask-image: linear-gradient\(to right,/)
  // The stock line's margin used to collapse into the description's; without it the details keep their height.
  expect(css).toMatch(/\.product-details__stock \{ margin-bottom: 0; \}/)
})
it('changes no type size for product details', () => {
  expect(css).toMatch(/\.product-details__description \{ white-space: pre-line; font: 14px\/1\.6/)
  expect(css).toMatch(/\.product-details__title \{[^}]*font: 500 21px\/1\.3 Georgia/)
  expect(css).toMatch(/\.product-details__add \{[^}]*font: 600 16px\/1\.4/)
})
