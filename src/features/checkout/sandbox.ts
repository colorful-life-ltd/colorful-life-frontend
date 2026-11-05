// Build-time public settings only. No secret or live-provider fallback.
export const stripeSandbox = import.meta.env.VITE_PAYMENT_MODE === 'stripe-sandbox'
export const sandboxCheckout = stripeSandbox || import.meta.env.VITE_PAYMENT_MODE === 'paypal-sandbox'
// A stale 'paypal-sandbox' label (now rejected at build) still counts as test-only, so it
// keeps the Sandbox registration restriction; it never enables any payment provider.

// Explicit owner-controlled Sandbox opt-in; production registration is unchanged.
export const registrationAvailable = !sandboxCheckout || import.meta.env.VITE_SANDBOX_REGISTRATION_ENABLED === 'true'
