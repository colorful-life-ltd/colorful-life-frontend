// @vitest-environment node
// Plain JS: the app's TypeScript project has browser types only, and Vitest stubs CSS imports.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'HomepageDiscovery.css'), 'utf8')

it('visually hides the crawl-only homepage discovery unless a keyboard user focuses inside it', () => {
  const rule = /\.homepage-discovery--crawl-only:not\(:focus-within\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  for (const declaration of ['position: absolute', 'width: 1px', 'height: 1px', 'overflow: hidden', 'clip-path: inset(50%)']) expect(rule).toContain(declaration)
  // Hidden from sighted users only; never removed from the accessibility tree or the crawlable DOM.
  expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/)
})
