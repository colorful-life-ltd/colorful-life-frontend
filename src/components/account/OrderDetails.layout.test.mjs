// @vitest-environment node
// Plain JS: the app's TypeScript project has browser types only, and Vitest stubs CSS imports.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'OrderDetails.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Top-level rules, and rules inside each `@media (min-width: Npx)` block. */
function blocks() {
  const media = new Map(), top = []
  let rest = css
  for (const m of css.matchAll(/@media\s*\(([^)]*)\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) { media.set(m[1].replace(/\s+/g, ' ').trim(), m[2]); rest = rest.replace(m[0], '') }
  for (const [, sel, body] of rest.matchAll(/([^{}]+)\{([^{}]*)\}/g)) top.push({ sel: sel.trim(), body })
  const rules = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }))
  return { top, media: Object.fromEntries([...media].map(([q, t]) => [q, rules(t)])) }
}
const { top, media } = blocks()
const columns = rules => rules.filter(r => r.sel.split(',').some(s => s.trim() === '.order-detail__layout') && /grid-template-columns/.test(r.body)).map(r => /grid-template-columns:\s*([^;]+)/.exec(r.body)[1].trim())

describe('Order Details responsive layout', () => {
  it('mobile (< lg): a single column with no column template outside the desktop breakpoints', () => {
    expect(columns(top)).toEqual([])
    expect(columns(media['max-width: 600px'] ?? [])).toEqual([])
  })
  it('lg (≥ 1024px): a wider centred paper and a 55/45 two-column split', () => {
    expect(columns(media['min-width: 1024px'])).toEqual(['minmax(0, 11fr) minmax(0, 9fr)'])
    expect(media['min-width: 1024px'].some(r => r.sel === '.checkout.customer-orders--detail .checkout__paper' && /max-width:\s*1180px/.test(r.body))).toBe(true)
  })
  it('xl (≥ 1280px): a 60/40 split on a wider paper', () => {
    expect(columns(media['min-width: 1280px'])).toEqual(['minmax(0, 3fr) minmax(0, 2fr)'])
    expect(media['min-width: 1280px'].some(r => r.sel === '.checkout.customer-orders--detail .checkout__paper' && /max-width:\s*1280px/.test(r.body))).toBe(true)
  })
  it('never uses sticky positioning and keeps columns shrinkable to avoid horizontal overflow', () => {
    expect(css).not.toMatch(/position:\s*sticky/)
    expect(top.some(r => r.sel.includes('.order-detail__main') && /min-width:\s*0/.test(r.body))).toBe(true)
  })
})
