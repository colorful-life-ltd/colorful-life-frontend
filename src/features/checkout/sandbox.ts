// Build-time public settings only. No secret or live-provider fallback.
export const stripeSandbox = import.meta.env.VITE_PAYMENT_MODE === 'stripe-sandbox'
export const sandboxCheckout = stripeSandbox || import.meta.env.VITE_PAYMENT_MODE === 'paypal-sandbox'
// A stale 'paypal-sandbox' label (now rejected at build) still counts as test-only, so it
// keeps the Sandbox registration restriction; it never enables any payment provider.

// Customer accounts (registration and sign-in) are closed unless the owner opts in explicitly:
// Sandbox keeps its own VITE_SANDBOX_REGISTRATION_ENABLED; Production needs VITE_REGISTRATION_ENABLED=true.
// While closed, the account overlay shows only the Opening Soon announcement and sends no auth request.
// The backend enforces REGISTRATION_ENABLED independently.
export const registrationAvailable = sandboxCheckout
  ? import.meta.env.VITE_SANDBOX_REGISTRATION_ENABLED === 'true'
  : import.meta.env.VITE_REGISTRATION_ENABLED === 'true'
