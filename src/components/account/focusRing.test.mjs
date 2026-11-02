// @vitest-environment node
// Plain JS: the app's TypeScript project has browser types only, and Vitest stubs CSS imports.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// Regression: the Saved Addresses scroll container clipped the left (and right) of input focus rings because its
// padding (4px) was smaller than the ring's reach (2px outline + 3px offset). Any My Account scroll container
// must pad its content by at least that reach.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'PersonalInformation.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim() === selector)?.[2] ?? ''
const px = (body, prop) => Number(new RegExp(`${prop}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(body)?.[1])

it('pads the Saved Addresses scroll container by at least the full focus-ring reach on every side', () => {
  const focus = rule('.my-account :is(button, input):focus-visible')
  const reach = Number(/outline:\s*(\d+)px/.exec(focus)?.[1]) + px(focus, 'outline-offset')
  expect(reach).toBe(5)
  const space = px(rule('.my-account'), '--account-focus-ring-space') || px(css.match(/\.my-account\s*\{[^}]*--account-focus-ring-space:[^}]*\}/)?.[0] ?? '', '--account-focus-ring-space')
  expect(space).toBeGreaterThanOrEqual(reach)
  const body = rule('.saved-addresses__body')
  expect(body).toMatch(/overflow-y:\s*auto/)
  expect(body).toMatch(/padding:\s*var\(--account-focus-ring-space\)\s*;/)
  // The negative margin keeps the layout aligned without eating into that space.
  expect(body).toMatch(/margin-inline:\s*calc\(-1 \* var\(--account-focus-ring-space\)\)/)
  // The focus indicator itself is unchanged: brand colour, never removed.
  expect(focus).toContain('#527f78')
  expect(css).not.toMatch(/:focus(-visible)?\s*\{[^}]*outline:\s*(none|0)/)
})
