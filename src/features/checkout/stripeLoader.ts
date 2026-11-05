// The pure entry never injects js.stripe.com on import: Stripe (and its fraud-prevention
// cookies) loads only when a customer reaches the payment step. See the Cookie Notice.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'

import { validateEnvironment } from './environment'

let publishableKey: string | undefined
try { publishableKey = validateEnvironment(import.meta.env).publishableKey } catch { /* Fail closed before loading Stripe. */ }
let stripeLoad: Promise<Stripe | null> | null = null
/** Lazily loads Stripe.js once per page, on first use. */
export function stripeForPayment(): Promise<Stripe | null> | null {
  if (!publishableKey) return null
  stripeLoad ??= loadStripe(publishableKey!).catch(() => null)
  return stripeLoad
}
