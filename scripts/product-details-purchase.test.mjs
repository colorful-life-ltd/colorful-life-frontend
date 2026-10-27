// @vitest-environment node
// Layout contracts jsdom cannot measure: on short pages the purchase action stays in view, and the scrolling page
// shows that its details continue, without changing the book, its sizes or any text size.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const css = readFileSync(new URL('../src/components/catalogue/VehiclesProductPage.css', import.meta.url), 'utf8')

it('rests the purchase action in the page bottom margin until it scrolls into place', () => {
  expect(css).toMatch(/\.product-details__purchase \{ position: sticky; bottom: -56px; z-index: 1;[^}]*\}/)
  // Its paper backdrop is feathered on every side, so it never draws a box on the page's shading.
  expect(css).toMatch(/\.product-details__purchase::before \{[^}]*background: var\(--book-paper, #fff9e9\);[^}]*mask-composite: intersect; \}/)
})
it('keeps focused and revealed details clear of that margin', () => {
  expect(css).toMatch(/\.book-shell__content:has\(\.product-details__purchase\) \{ scroll-padding-bottom: 56px; \}/)
})
it('fades the foot of the page while the details continue below', () => {
  expect(css).toMatch(/article\.product-details::after \{ content: ''; position: sticky; bottom: -56px; display: block; height: 56px;[^}]*pointer-events: none; \}/)
})
it('changes no type size for product details', () => {
  expect(css).toMatch(/\.product-details__description \{ white-space: pre-line; font: 14px\/1\.6/)
  expect(css).toMatch(/\.product-details__title \{[^}]*font: 500 21px\/1\.3 Georgia/)
  expect(css).toMatch(/\.product-details__add \{[^}]*font: 600 16px\/1\.4/)
})
