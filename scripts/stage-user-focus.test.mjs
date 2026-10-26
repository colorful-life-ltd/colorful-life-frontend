// @vitest-environment node
// The character's box is taller than its artwork, so a box outline showed an empty cream rectangle above the boy.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const css = readFileSync(new URL('../src/components/catalogue/BookOwnedUser.css', import.meta.url), 'utf8')

it('traces the character illustration for keyboard focus instead of outlining its box', () => {
  expect(css).toMatch(/\.stage-user:focus-visible \{ outline: none; \}/)
  expect(css).toMatch(/\.stage-user:focus-visible img \{ filter: drop-shadow\([^}]*#fff3c9/)
  expect(css).not.toMatch(/\.stage-user:focus-visible \{[^}]*outline: 3px solid #fff3c9/)
})
it('keeps a visible outline in forced-colours mode, where filters may not render', () => {
  expect(css).toMatch(/@media \(forced-colors: active\) \{ \.stage-user:focus-visible \{ outline: 3px solid CanvasText/)
})
it('leaves the layout box that anchors the speech bubble unchanged', () => {
  expect(css).toMatch(/\.stage-user \{[^}]*aspect-ratio: 270 \/ 378/)
  expect(css).toMatch(/\.stage-user img \{[^}]*object-position: bottom center/)
})
