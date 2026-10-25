// @vitest-environment node
// Plain JS: the app's TypeScript project has browser types only, and Vitest stubs CSS imports.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const rules = readdirSync(dir).filter(name => name.endsWith('.css')).flatMap(file =>
  [...readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ file, selector: selector.trim(), body })))

// Gecko (Firefox) culls a hidden back face only when the element has its own transform;
// Blink (Chrome, Edge) also culls untransformed faces inside a preserve-3d parent. Without
// a transform, Firefox painted the cover mirrored over the Welcome page while opening.
describe('3D book faces are culled in every engine', () => {
  const faces = rules.filter(rule => /backface-visibility:\s*hidden/.test(rule.body))

  it('finds the opening, closing and page-turn faces', () => {
    expect(faces.map(rule => rule.selector)).toEqual(expect.arrayContaining([
      '.opening-transition__front', '.closing-transition__front', '.catalogue-turn > .catalogue-turn__face',
    ]))
  })

  it.each(['.opening-transition__front', '.closing-transition__front'])('%s declares its own transform', selector => {
    const rule = faces.find(face => face.selector === selector)
    expect(rule.body).toMatch(/(^|;|\s)transform:\s*rotateY\(0deg\)/)
  })

  it('every hidden-backface face is transformed directly or by a more specific rule', () => {
    for (const face of faces) {
      const own = /(^|;|\s)transform:/.test(face.body)
      // The page-turn front is the only face whose transform comes from the animated parent alone;
      // its back face carries rotateY(180deg), and its turn is verified unaffected in Firefox.
      const sibling = rules.some(rule => rule.selector.startsWith(face.selector.split(' ').pop()) && /transform:/.test(rule.body))
      expect(own || sibling, `${face.file}: ${face.selector}`).toBe(true)
    }
  })
})
