import { getCatalogueProduct } from '../catalogue/api'

export type OrderThumbnail = { url: string } | null
// One public catalogue read per product per page load, one at a time, so a long history stays within the API rate limit.
const cache = new Map<number, Promise<OrderThumbnail>>()
let queue: Promise<unknown> = Promise.resolve()
export function orderThumbnail(productId: number): Promise<OrderThumbnail> {
  let pending = cache.get(productId)
  if (!pending) {
    pending = queue.then(() => getCatalogueProduct(productId)).then(product => {
      const image = product?.productImages.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]
      return image ? { url: image.url } : null
    }, () => null)
    queue = pending
    cache.set(productId, pending)
  }
  return pending
}
export function resetOrderThumbnailCache() { cache.clear(); queue = Promise.resolve() }
