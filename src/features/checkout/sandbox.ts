// Build-time public settings only. No secret or live-provider fallback.
export const sandboxCheckout = import.meta.env.VITE_PAYMENT_MODE === 'paypal-sandbox'
export const sandboxClientId = import.meta.env.VITE_PAYPAL_SANDBOX_CLIENT_ID ?? ''
