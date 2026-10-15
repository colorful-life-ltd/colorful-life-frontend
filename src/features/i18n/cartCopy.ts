import type { CartItem } from '../cart/CartContext'
import { cartItemBlocked, checkoutQuantity } from '../cart/CartContext'

const en = {
  removeTitle: 'Remove this item?', removeQuestion: 'Are you sure you want to take this out of your cart?', keep: 'Keep it',
  subtotal: 'Available-item subtotal', checkout: 'Checkout', review: 'Review your cart',
  blocked: 'Resolve the items marked below before starting a new checkout. Remove unavailable items or reduce quantities where stock allows.',
  updating: 'Wait for cart updates before checking out.',
  refresh: 'Refresh cart availability', continue: 'Continue to checkout', orders: 'View My Orders',
  conflict: 'Your order request was not accepted. Review your updated cart before starting a new checkout.',
  affected: (title: string) => `Item needing attention: ${title}`,
  listing: (id: number) => `Listing #${id}`,
  requested: (n: number) => `Requested quantity: ${n}.`,
  capacity: (n: number) => `Available for a new checkout: ${n}.`,
  unavailable: 'No longer available. Remove this item or check again later.',
  unpublished: 'This product is no longer published. Remove it or check again later.',
  inactive: 'This listing is no longer active. Remove it or check again later.',
  used: 'This outer-box-damage offer is no longer available. Remove it or check again later.',
  soldOut: 'Out of stock. Remove this item or check again after restocking.',
  insufficient: (n: number) => `Only ${n} available. Reduce the quantity or remove this item.`,
  allocated: 'Already in a pending order. Resume it in My Orders; this quantity will not be ordered again.',
  reservation: 'Inventory is temporarily unavailable. Refresh your cart or try again later.',
  quantityChanged: 'Some cart quantity is already in another pending order or has changed. Review your cart or visit My Orders before trying again.',
  invalid: 'Unable to read your cart quantities. Refresh your cart before checking out.',
  pending: (n: number, fresh: number, stock: number) => `${n} allocated to a pending order · ${fresh} requested for a new checkout · ${stock} in stock for a new checkout`,
  quantity: (n: number) => `Quantity: ${n}`,
  decrease: (name: string) => `Decrease ${name} quantity`, increase: (name: string) => `Increase ${name} quantity`,
  reduce: (n: number) => `Reduce quantity to ${n}`,
  remove: 'Remove', removeItem: (name: string) => `Remove ${name}`, unitPrice: 'Unit price',
  selected: 'Selected cart listings', freshNone: 'These items are already in pending orders.',
}
const fr: typeof en = {
  removeTitle: 'Retirer cet article ?', removeQuestion: 'Voulez-vous vraiment retirer cet article de votre panier ?', keep: 'Le garder',
  subtotal: 'Sous-total des articles disponibles', checkout: 'Passer commande', review: 'Vérifiez votre panier',
  blocked: 'Résolvez les problèmes signalés ci-dessous avant de passer une nouvelle commande. Retirez les articles indisponibles ou réduisez les quantités selon le stock.',
  updating: 'Attendez la mise à jour du panier avant de commander.',
  refresh: 'Actualiser la disponibilité du panier', continue: 'Continuer la commande', orders: 'Voir mes commandes',
  conflict: 'Votre demande de commande a été refusée. Vérifiez votre panier actualisé avant de passer une nouvelle commande.',
  affected: title => `Article à vérifier : ${title}`, listing: id => `Offre n° ${id}`,
  requested: n => `Quantité demandée : ${n}.`, capacity: n => `Disponible pour une nouvelle commande : ${n}.`,
  unavailable: 'Cet article n’est plus disponible. Retirez-le ou revenez plus tard.',
  unpublished: 'Ce produit n’est plus publié. Retirez-le ou revenez plus tard.',
  inactive: 'Cette offre n’est plus active. Retirez-la ou revenez plus tard.',
  used: 'Cette offre avec emballage abîmé n’est plus disponible. Retirez-la ou revenez plus tard.',
  soldOut: 'Rupture de stock. Retirez cet article ou revenez après le réapprovisionnement.',
  insufficient: n => `Seulement ${n} disponible(s). Réduisez la quantité ou retirez cet article.`,
  allocated: 'Déjà dans une commande en attente. Retrouvez-la dans Mes commandes ; cette quantité ne sera pas commandée à nouveau.',
  reservation: 'Le stock est temporairement indisponible. Actualisez votre panier ou réessayez plus tard.',
  quantityChanged: 'Une partie de la quantité est déjà dans une autre commande en attente ou a changé. Vérifiez votre panier ou consultez Mes commandes.',
  invalid: 'Impossible de lire les quantités du panier. Actualisez-le avant de commander.',
  pending: (n, fresh, stock) => `${n} réservé(s) pour une commande en attente · ${fresh} demandé(s) pour une nouvelle commande · ${stock} en stock pour une nouvelle commande`,
  quantity: n => `Quantité : ${n}`, decrease: name => `Réduire la quantité de ${name}`, increase: name => `Augmenter la quantité de ${name}`,
  reduce: n => `Réduire la quantité à ${n}`,
  remove: 'Retirer', removeItem: name => `Retirer ${name}`, unitPrice: 'Prix unitaire',
  selected: 'Articles du panier', freshNone: 'Ces articles sont déjà dans des commandes en attente.',
}

// The storefront has no locale provider yet. Respect the page language and
// keep all new availability copy together for future locale integration.
export function cartCopy() {
  return typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().split('-')[0] === 'fr' ? fr : en
}
export function availabilityMessage(reason?: string | null, availableQuantity = 0): string {
  const copy = cartCopy()
  switch (reason) {
    case 'PRODUCT_UNPUBLISHED': return copy.unpublished
    case 'LISTING_INACTIVE': return copy.inactive
    case 'USED_OFFER_UNAVAILABLE': return copy.used
    case 'OUT_OF_STOCK': return copy.soldOut
    case 'INSUFFICIENT_STOCK': return copy.insufficient(availableQuantity)
    case 'CART_QUANTITY_ALLOCATED': return copy.allocated
    case 'CART_QUANTITY_UNAVAILABLE': return copy.quantityChanged
    case 'INVENTORY_RESERVATION_CONFLICT': return copy.reservation
    default: return copy.unavailable
  }
}
export function cartItemMessage(item: CartItem): string | null {
  const quantity = checkoutQuantity(item)
  if (quantity === null) return cartCopy().invalid
  if (quantity === 0) return cartCopy().allocated
  if (!cartItemBlocked(item)) return null
  return availabilityMessage(item.availability?.reason ?? (item.listing.availableStock === 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK'), item.availability?.availableQuantity ?? item.listing.availableStock)
}
