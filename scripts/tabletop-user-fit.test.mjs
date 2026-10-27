// @vitest-environment node
// Layout contracts jsdom cannot measure: the tabletop boy peeks out from under the book on short stages instead of
// being cut off by the screen, and the sandbox banner no longer pushes the stage below the viewport.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const app = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const user = readFileSync(new URL('../src/components/catalogue/BookOwnedUser.css', import.meta.url), 'utf8')

it('fits the desktop stage under the sandbox banner instead of extending below the screen', () => {
  expect(app).toMatch(/#root:has\(> \.sandbox-banner \+ \.catalogue-stage\) \{ display: flex; flex-direction: column; height: 100svh; \}/)
  expect(app).toMatch(/#root:has\(> \.sandbox-banner \+ \.catalogue-stage\) > \.catalogue-stage \{ flex: 1 1 auto; min-height: 0; height: auto; \}/)
})
it('derives the space under the book from the shared book sizing, not a copy of it', () => {
  expect(app).toMatch(/\.catalogue-stage \{[^}]*container: catalogue-stage \/ size;/)
  expect(app).toMatch(/--space-below-book: calc\(\(100cqh \+ var\(--stage-padding-bottom, 0px\) - \(var\(--book-width\) - 48px\) \* 5 \/ 9\) \/ 2\);/)
  expect(app).toMatch(/--stage-padding-bottom: 24px;\s*padding-bottom: var\(--stage-padding-bottom\);/)
})
it('shrinks the boy to that space with a small tuck, and hides him only on very short stages', () => {
  expect(app).toMatch(/--user-width: min\(clamp\(360px, 40cqw, 520px\) \* 0\.42, \(var\(--space-below-book\) \+ 14px\) \* 270 \/ 208\);/)
  expect(user).toMatch(/\.stage-user \{ width: var\(--user-width\); \}/)
  expect(user).toMatch(/@container catalogue-stage \(max-height: 360px\) \{ \.stage-user \{ display: none; \} \}/)
})
it('keeps the guest bubble clear of the book cover without moving it on roomy stages', () => {
  expect(app).toMatch(/\.guest-cart-bubble \{ translate: 0 clamp\(0px, calc\(var\(--user-height\) \* 0\.3 \+ 100% \+ 20px - var\(--space-below-book\)\), calc\(var\(--user-height\) \* 0\.3\)\); \}/)
})
