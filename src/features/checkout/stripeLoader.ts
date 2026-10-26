// The pure entry never injects js.stripe.com on import: Stripe (and its fraud-prevention
// cookies) loads only when a customer reaches the payment step. See the Cookie Notice.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const sandbox = ['stripe-sandbox', 'paypal-sandbox'].includes(import.meta.env.VITE_PAYMENT_MODE)
const configured = Boolean(publishableKey && (sandbox ? /^pk_test_[A-Za-z0-9]+$/ : /^pk_(test|live)_\S+$/).test(publishableKey))
let stripeLoad: Promise<Stripe | null> | null = null
/** Lazily loads Stripe.js once per page, on first use. */
export function stripeForPayment(): Promise<Stripe | null> | null {
  if (!configured) return null
  stripeLoad ??= loadStripe(publishableKey!).catch(() => null)
  return stripeLoad
}
