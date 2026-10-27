// @vitest-environment node
// Layout contracts jsdom cannot measure: responsive order cards and the quiet basket confirmation.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const read = path => readFileSync(new URL(`../src/components/${path}`, import.meta.url), 'utf8')

describe('compact order history layout', () => {
  const css = read('account/CustomerOrders.css')
  const mobile = css.slice(css.indexOf('@media (max-width: 600px)'))
  it('stacks metadata and the action on narrow screens', () => {
    expect(mobile).toMatch(/\.order-card__meta \{[^}]*grid-template-columns: 1fr/)
    expect(mobile).toMatch(/\.order-card__details \{[^}]*width: 100%/)
    expect(mobile).toMatch(/\.order-card__facts \{[^}]*display: grid/)
  })
  it('lets long names wrap instead of overflowing horizontally', () => {
    expect(css).toMatch(/\.order-card__item-name \{[^}]*overflow-wrap: anywhere/)
    expect(css).toMatch(/\.order-card__items li \{[^}]*min-width: 0/)
    expect(css).toMatch(/\.order-card > article \{[^}]*overflow: hidden/)
    expect(css).not.toMatch(/width: (?:[7-9]\d{2}|\d{4,})px/)
  })
})

describe('"Added to your basket!" confirmation styling', () => {
  const details = read('catalogue/VehiclesProductPage.css')
  const cart = read('catalogue/BookOwnedCart.css')
  it('reserves its line and uses the muted forest green', () => {
    expect(details).toMatch(/\.product-details__added \{[^}]*color: #4d644f/)
    expect(details).toMatch(/\.product-details__added\[data-reserved="true"\] \{ min-height: 1em; \}/)
  })
  it('fades in and out over three seconds, and holds still under reduced motion', () => {
    expect(details).toMatch(/\.product-details__added > span \{[^}]*animation: product-details-added 3s/)
    expect(details).toMatch(/@keyframes product-details-added \{ 0% \{ opacity: 0; \}[^@]*100% \{ opacity: 0; \} \}/)
    expect(details).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.product-details__added > span \{ animation: none; \} \}/)
  })
  it('no longer renders a floating toast; the live region is visually hidden', () => {
    expect(cart).not.toMatch(/\.cart-add-feedback[^{]*\{[^}]*position: fixed/)
    expect(cart).toMatch(/\.cart-add-feedback \{[^}]*clip: rect\(0 0 0 0\)/)
  })
})
