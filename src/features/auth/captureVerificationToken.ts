// Run before React and other application modules on an initial page load.
import { captureVerificationToken } from './verificationToken'
if (typeof window !== 'undefined') captureVerificationToken()
