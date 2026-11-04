// @vitest-environment node
// Plain JS: the app's TypeScript project has browser types only, and Vitest stubs CSS imports.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'OrderDetails.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sels: sel.split(',').map(s => s.trim().replace(/\s+/g, ' ')), body }))
const decl = (selector, prop) => rules.filter(r => r.sels.includes(selector)).map(r => new RegExp(`(?:^|;|\\s)${prop}:\\s*([^;]+)`).exec(r.body)?.[1].trim()).filter(Boolean).at(-1)
const token = name => decl('.order-status', name)
const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => { const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y); return (hi + 0.05) / (lo + 0.05) }
const PURPLE = /#66527c|#c9bcd6/i
const progressRules = rules.filter(r => r.sels.some(s => s.includes('.order-steps')))

describe('order progress colours', () => {
  it('uses the established Returns green for completed steps and segments in every journey', () => {
    expect(token('--progress-done')).toBe('#536f42')
    // The return card's own accent is the same green the progress tokens reuse.
    expect(decl('.order-status--return', 'border-left')).toContain('#536f42')
    expect(decl('.order-steps li.is-done .order-steps__dot', 'background')).toBe('var(--progress-done)')
    expect(decl('.order-steps li.is-done .order-steps__dot', 'border-color')).toBe('var(--progress-done)')
    expect(decl('.order-steps li.is-done + li.is-done::before', 'background')).toBe('var(--progress-done)')
    expect(decl('.order-steps__dot', 'color')).toBe('#fff')
  })
  it('keeps every incomplete step a hollow neutral ring joined by neutral segments', () => {
    // The ring is the only mark on an incomplete step, so it must meet WCAG 1.4.11 (3:1) on both card backgrounds.
    for (const card of ['.order-status', '.order-status--return']) expect(contrast(token('--progress-pending'), decl(card, 'background'))).toBeGreaterThanOrEqual(3)
    expect(decl('.order-steps__dot', 'background')).toBe('var(--progress-surface)')
    expect(decl('.order-steps__dot', 'border')).toBe('2px solid var(--progress-pending)')
    expect(decl('.order-steps li + li::before', 'background')).toBe('var(--progress-pending)')
    // Nothing fills the current step's dot or greens the segment leading to it.
    expect(progressRules.filter(r => r.sels.some(s => /is-current/.test(s)) && /background|border-color|box-shadow/.test(r.body))).toEqual([])
    expect(progressRules.filter(r => r.sels.some(s => /is-done \+ li(?!\.is-done)/.test(s)))).toEqual([])
  })
  it('drops the purple progress styling and per-journey overrides but keeps the exceptional red state', () => {
    expect(progressRules.filter(r => PURPLE.test(r.body))).toEqual([])
    expect(progressRules.filter(r => r.sels.some(s => s.startsWith('.order-status--return .order-steps')))).toEqual([])
    expect(decl('.order-steps li.is-problem .order-steps__dot', 'border-color')).toBe('#a1452f')
    expect(decl('.order-steps li.is-problem .order-steps__dot', 'background')).toBe('#fffaf0')
  })
})
