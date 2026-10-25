// Build-time public settings only. No secret or live-provider fallback.
export const sandboxCheckout = import.meta.env.VITE_PAYMENT_MODE === 'paypal-sandbox'
export const sandboxClientId = import.meta.env.VITE_PAYPAL_SANDBOX_CLIENT_ID ?? ''

// Explicit owner-controlled Sandbox opt-in; production registration is unchanged.
export const registrationAvailable = !sandboxCheckout || import.meta.env.VITE_SANDBOX_REGISTRATION_ENABLED === 'true'
