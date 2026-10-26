import { createContext, useContext } from 'react'

/** The latest committed add-to-cart, shared with the product page that shows the visual confirmation.
 * `count` changes on every success so the confirmation restarts; failed or blocked adds never change it. */
export type CartAddFeedback = { count: number; visible: boolean; listingId: number | null }
export const CartAddFeedbackContext = createContext<CartAddFeedback>({ count: 0, visible: false, listingId: null })
export const useCartAddFeedback = () => useContext(CartAddFeedbackContext)
export const CART_ADD_MESSAGE = 'Added to your basket!'
