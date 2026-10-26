// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CloudinaryImage } from './CloudinaryImage'
import { CatalogueProduct, CatalogueProductDetails } from '../catalogue/VehiclesProductPage'
import { offer, product } from '../../features/catalogue/catalogueFixtures'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const original = 'https://res.cloudinary.com/demo-cloud/image/upload/v1792485702/colorful-life/products/14988-ab1afd82.png'
const display = original.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_768/')
const thumbnail = original.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_160/')
let root: Root | undefined, container: HTMLDivElement
async function render(element: React.ReactNode) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(element))
}
const fail = (img: HTMLImageElement) => act(async () => { img.dispatchEvent(new Event('error')) })
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = '' })

describe('CloudinaryImage fallback', () => {
  it('requests the variant, falls back to the original once, and only then reports the failure', async () => {
    const onError = vi.fn()
    await render(<CloudinaryImage src={original} variant="display" alt="Set" className="art" onError={onError} />)
    const img = container.querySelector('img')!
    expect([img.getAttribute('src'), img.getAttribute('alt'), img.className]).toEqual([display, 'Set', 'art'])
    await fail(img)
    expect(container.querySelector('img')!.getAttribute('src')).toBe(original); expect(onError).not.toHaveBeenCalled()
    await fail(container.querySelector('img')!)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('renders non-Cloudinary URLs unchanged and reports their failure directly', async () => {
    const onError = vi.fn()
    await render(<CloudinaryImage src="/feature.png" variant="thumbnail" alt="" onError={onError} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/feature.png')
    await fail(container.querySelector('img')!)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('tries the variant again for a new image after an earlier variant failed', async () => {
    await render(<CloudinaryImage src={original} variant="thumbnail" alt="" />)
    await fail(container.querySelector('img')!)
    const next = original.replace('14988-ab1afd82', '14987-7a36bc93')
    await act(async () => root!.render(<CloudinaryImage src={next} variant="thumbnail" alt="" />))
    expect(container.querySelector('img')!.getAttribute('src')).toBe(next.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_160/'))
  })
})

describe('catalogue surfaces use the shared variants', () => {
  it('catalogue cards use the display variant and keep the empty artwork state when the original fails too', async () => {
    await render(<CatalogueProduct product={product(7, [offer(7)], { catalogueArtworkUrl: original })} onViewDetails={vi.fn()} />)
    const img = container.querySelector<HTMLImageElement>('.vehicle-product__art-button img')!
    expect(img.getAttribute('src')).toBe(display)
    await fail(img)
    expect(container.querySelector('.vehicle-product__art-button img')!.getAttribute('src')).toBe(original)
    await fail(container.querySelector('.vehicle-product__art-button img')!)
    expect(container.querySelector('[data-artwork-state="empty"]')).not.toBeNull()
  })

  it('product details use the display variant for the main photograph and thumbnails for the gallery', async () => {
    const images = [{ id: 1, url: original, altText: 'Front', sortOrder: 0 }, { id: 2, url: original.replace('14988-ab1afd82', '14988-second'), altText: null, sortOrder: 1 }]
    await render(<CatalogueProductDetails product={product(8, [offer(8)], { productImages: images } as never)} selectedOfferId={8} side="left" onAddToCart={vi.fn()} />)
    expect(container.querySelector('.product-details__main-image img')!.getAttribute('src')).toBe(display)
    expect([...container.querySelectorAll('.product-details__thumbnail img')].map(img => img.getAttribute('src'))).toEqual([thumbnail, thumbnail.replace('14988-ab1afd82', '14988-second')])
  })
})
