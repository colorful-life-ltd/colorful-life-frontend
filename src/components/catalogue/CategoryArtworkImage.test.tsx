// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { CategoryArtworkImage } from './CategoryArtworkImage'
import { categoryPresentation } from './categories'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined, container: HTMLDivElement
async function render(category: Parameters<typeof CategoryArtworkImage>[0]['category']) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(<CategoryArtworkImage category={category} />))
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = '' })

describe('category-index artwork', () => {
  it('serves WebP where supported with a PNG fallback, keeping the intrinsic size and layout', async () => {
    await render({ image: '/a/category-city.png', imageWebp: '/a/category-city.webp', imageWidth: 1536, imageHeight: 1024 })
    const picture = container.querySelector('picture')!
    expect(picture.style.display).toBe('contents')
    // 720 / 1536: the 720px files keep the originals' CSS size, so the storybook layout is unchanged.
    expect(picture.querySelector('source')?.getAttribute('srcset')).toBe('/a/category-city.webp 0.46875x')
    expect(picture.querySelector('source')?.getAttribute('type')).toBe('image/webp'); expect(picture.querySelector('source')?.style.display).toBe('none')
    const img = picture.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/a/category-city.png'); expect(img.getAttribute('srcset')).toBe('/a/category-city.png 0.46875x')
    expect([img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('decoding'), img.getAttribute('alt')]).toEqual(['1536', '1024', 'async', ''])
  })

  it('falls back to a plain image without WebP, and renders nothing without artwork', async () => {
    await render({ image: '/a/custom.png' })
    expect(container.querySelector('picture')).toBeNull(); expect(container.querySelector('img')?.getAttribute('src')).toBe('/a/custom.png'); expect(container.querySelector('img')?.hasAttribute('srcset')).toBe(false)
    await act(async () => root!.render(<CategoryArtworkImage category={{}} />))
    expect(container.innerHTML).toBe('')
  })

  it('points every curated category at the optimised artwork, never the full-size originals', () => {
    expect(categoryPresentation).toHaveLength(13)
    for (const category of categoryPresentation) {
      expect(category.image, category.id).toMatch(/optimised\/category-[a-z-]+\.png$/)
      expect(category.imageWebp, category.id).toMatch(/optimised\/category-[a-z-]+\.webp$/)
    }
  })
})
