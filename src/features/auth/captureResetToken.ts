// Imported first by main.tsx so the reset token leaves the URL before any other
// module (for example Stripe.js) can issue a request carrying it as a referrer.
import { captureResetToken } from './passwordReset'

if (typeof window !== 'undefined') captureResetToken()
