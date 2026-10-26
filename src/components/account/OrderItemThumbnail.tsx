import { CloudinaryImage } from '../shared/CloudinaryImage'
import { useEffect, useRef, useState } from 'react'
import { orderThumbnail, type OrderThumbnail } from '../../features/orders/productThumbnails'

/** Existing catalogue photo for an ordered set, loaded once the card is visible. Sold-out sets have no public
 * catalogue entry, so they keep the neutral placeholder rather than an invented image. */
export function OrderItemThumbnail({ productId }: { productId?: number }) {
  const frame = useRef<HTMLSpanElement>(null)
  const [image, setImage] = useState<OrderThumbnail>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const node = frame.current
    if (!node || productId === undefined || !Number.isSafeInteger(productId) || productId <= 0 || typeof IntersectionObserver === 'undefined') return
    let active = true
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      void orderThumbnail(productId).then(result => { if (active) setImage(result) })
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => { active = false; observer.disconnect() }
  }, [productId])
  // Decorative: the product name is always shown beside it.
  return <span ref={frame} className="order-card__thumb" aria-hidden="true">
    {image && !failed && <CloudinaryImage src={image.url} variant="thumbnail" alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>
}
