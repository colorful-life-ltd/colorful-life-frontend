// Build-time public settings only. No secret or live-provider fallback.
export const stripeSandbox = import.meta.env.VITE_PAYMENT_MODE === 'stripe-sandbox'
export const sandboxCheckout = stripeSandbox || import.meta.env.VITE_PAYMENT_MODE === 'paypal-sandbox'
// Treat stale Sandbox builds as test-only; they cannot load a live Stripe key.

// Explicit owner-controlled Sandbox opt-in; production registration is unchanged.
export const registrationAvailable = !sandboxCheckout || import.meta.env.VITE_SANDBOX_REGISTRATION_ENABLED === 'true'
