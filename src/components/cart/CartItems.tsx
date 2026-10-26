import { useState } from 'react'
import { availableCartSubtotal, cartItemBlocked, checkoutQuantity, formatGbp, lineAmountPence, listingUnitPricePence, cartQuantityLimit, useCart, type CartItem } from '../../features/cart/CartContext'
import { cartCopy, cartItemMessage } from '../../features/i18n/cartCopy'
import { RemoveItemDialog } from './RemoveItemDialog'
import './CartItems.css'

export function CartItems({ items, onConfirmRemove, affectedListingId }: {
  items: CartItem[]
  affectedListingId?: number
  // Visual-task integration seam. No local deletion or backend write is implied.
  onConfirmRemove?: (item: CartItem) => void
}) {
  const copy = cartCopy()
  const [removalId, setRemovalId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const { updateQuantity, removeItem, pendingItemIds, error } = useCart()
  const removalItem = items.find(item => item.productListingId === removalId)
  return <div className="cart-items" aria-label={copy.selected}>
    {items.map(item => {
      const { productListingId, listing, quantity, allocatedQuantity, unallocatedQuantity } = item
      const blocked = cartItemBlocked(item)
      const explanation = cartItemMessage(item)
      const messageId = `cart-availability-${productListingId}`
      const limit = cartQuantityLimit(item)
      const canReduce = ['INSUFFICIENT_STOCK', 'OUT_OF_STOCK'].includes(item.availability?.status ?? '') &&
        checkoutQuantity(item) !== null && Number.isSafeInteger(limit) && limit >= 1 && quantity > limit
      const actionDescription = explanation ? messageId : (allocatedQuantity ?? 0) > 0 ? `cart-allocation-${productListingId}` : undefined
      const image = listing.legoProduct.productImages[0]
      // Quantity already reserved for the customer's own pending order is not unavailable stock: it keeps its
      // colours and explains itself, while checkout still excludes it. Only genuinely blocked lines are greyed.
      const allocatedOnly = checkoutQuantity(item) === 0
      return <article className={`cart-item${blocked ? ' cart-item--unavailable' : ''}${allocatedOnly ? ' cart-item--allocated' : ''}${affectedListingId === productListingId ? ' cart-item--affected' : ''}`} key={productListingId} data-cart-listing-id={productListingId} aria-describedby={explanation ? messageId : undefined}>
        <div className="cart-item__image">
          {image ? <img src={image.url} alt={image.altText ?? listing.legoProduct.title} /> : <span aria-hidden="true" />}
        </div>
        <div className="cart-item__copy">
          <h2>{listing.legoProduct.title}</h2>
          <p>{listing.condition === 'NEW' ? 'New' : 'New – Outer Box Damage'} · {copy.unitPrice} {formatGbp(listingUnitPricePence({ listing }))}</p>
          {(allocatedQuantity ?? 0) > 0 && <p id={`cart-allocation-${productListingId}`}>{copy.pending(allocatedQuantity!, unallocatedQuantity!, item.availability?.availableQuantity ?? listing.availableStock)}</p>}
          {explanation && <p id={messageId} className="cart-item__availability" role="status">{explanation}</p>}
          <div className="cart-item__amounts">
            <div className="cart-item__quantity" aria-label={copy.quantity(quantity)}>
              <button type="button" aria-label={copy.decrease(listing.legoProduct.title)} aria-describedby={actionDescription} disabled={quantity <= 1 || quantity - 1 > limit || limit < 1 || (item.availability?.status === 'UNAVAILABLE' && item.availability.reason !== 'CART_QUANTITY_ALLOCATED') || pendingItemIds.includes(productListingId)}
                onClick={() => void updateQuantity(productListingId, quantity - 1)}>−</button>
              <span>{copy.quantity(quantity)}</span>
              <button type="button" aria-label={copy.increase(listing.legoProduct.title)} aria-describedby={actionDescription} disabled={quantity >= limit || pendingItemIds.includes(productListingId)}
                onClick={() => void updateQuantity(productListingId, quantity + 1)}>+</button>
            </div>
            <strong>{formatGbp(lineAmountPence({ listing, quantity }))}</strong>
          </div>
          {canReduce && <button type="button" className="cart-item__reduce" aria-describedby={actionDescription} disabled={pendingItemIds.includes(productListingId)} onClick={() => void updateQuantity(productListingId, limit)}>{copy.reduce(limit)}</button>}
          <button className="cart-item__remove" type="button" aria-label={copy.removeItem(listing.legoProduct.title)} aria-describedby={actionDescription}
            onClick={() => setRemovalId(productListingId)}>{copy.remove}</button>
        </div>
      </article>
    })}
    {error && <p id="cart-items-error" className="cart-items__error" role="alert">{error}</p>}
    <div className="cart-items__total" aria-label={`${copy.subtotal} ${formatGbp(availableCartSubtotal(items))}`}>
      <span>{copy.subtotal}</span>
      <strong>{formatGbp(availableCartSubtotal(items))}</strong>
    </div>
    {removalItem && <RemoveItemDialog item={removalItem} isConfirming={confirmingId === removalItem.productListingId}
      onCancel={() => { if (confirmingId === null) setRemovalId(null) }}
      onConfirm={item => {
        setConfirmingId(item.productListingId)
        void removeItem(item.productListingId).then(success => {
          setConfirmingId(null)
          if (success) { setRemovalId(null); onConfirmRemove?.(item) }
        })
      }} />}
  </div>
}
