// @vitest-environment node
// Guards the bundled category-index artwork against full-size originals returning to the bundle.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = new URL('../src/assets/categories/optimised/', import.meta.url)
const source = new URL('../artwork/categories/', import.meta.url)
const names = readdirSync(source).filter(name => /^category-.*\.png$/.test(name)).map(name => name.replace(/\.png$/, ''))
const pngSize = url => { const data = readFileSync(url); return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), alpha: data[25] === 6 } }
const webpSize = url => {
  const data = readFileSync(url)
  expect(data.toString('ascii', 0, 4)).toBe('RIFF'); expect(data.toString('ascii', 8, 12)).toBe('WEBP')
  const chunk = data.toString('ascii', 12, 16)
  if (chunk === 'VP8X') return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3), alpha: (data[20] & 0x10) !== 0 }
  throw new Error(`expected an extended (alpha) WebP, got ${chunk}`)
}

describe('optimised category artwork', () => {
  it('keeps one 720px WebP and PNG per original, preserving aspect ratio and transparency', () => {
    expect(names).toHaveLength(13)
    for (const name of names) {
      const original = pngSize(new URL(`${name}.png`, source))
      const png = pngSize(new URL(`${name}.png`, dir)), webp = webpSize(new URL(`${name}.webp`, dir))
      expect(png.width, name).toBe(720); expect(webp.width, name).toBe(720)
      expect(png.height, name).toBe(webp.height)
      expect(Math.abs(png.width / png.height - original.width / original.height), name).toBeLessThan(0.01)
      expect(png.alpha, name).toBe(true); expect(webp.alpha, name).toBe(true)
    }
  })
  it('stays within a size budget far below the originals', () => {
    for (const name of names) {
      expect(statSync(new URL(`${name}.webp`, dir)).size, name).toBeLessThan(160 * 1024)
      expect(statSync(new URL(`${name}.png`, dir)).size, name).toBeLessThan(640 * 1024)
    }
  })
})
