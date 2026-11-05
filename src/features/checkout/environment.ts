/** Public build configuration only. Never infer an environment from a key. */
export type PublicEnvironment = Record<string, unknown>
export interface StorefrontEnvironment {
  target: 'production' | 'sandbox'
  paymentMode: 'stripe-live' | 'stripe-sandbox'
  siteOrigin: string
  apiBase: string
  publishableKey: string
}
export function validateEnvironment(env: PublicEnvironment): StorefrontEnvironment {
  const target = env.VITE_TARGET_ENVIRONMENT
  if (target !== 'production' && target !== 'sandbox') throw Error('Explicit target environment required')
  const paymentMode = env.VITE_PAYMENT_MODE
  if (paymentMode !== (target === 'production' ? 'stripe-live' : 'stripe-sandbox')) throw Error('Payment mode and target mismatch')
  const publishableKey = env.VITE_STRIPE_PUBLISHABLE_KEY
  const pattern = target === 'production' ? /^pk_live_[A-Za-z0-9]{8,}$/ : /^pk_test_[A-Za-z0-9]{8,}$/
  if (typeof publishableKey !== 'string' || !pattern.test(publishableKey)) throw Error('Publishable key and target mismatch')
  const site = env.VITE_SITE_URL
  if (typeof site !== 'string') throw Error('Explicit public site origin required')
  let origin: URL
  try { origin = new URL(site) } catch { throw Error('Invalid public site origin') }
  if (origin.protocol !== 'https:' || origin.origin !== site || origin.username || origin.password) throw Error('Public site must be an HTTPS origin')
  if (target === 'production' && site !== 'https://build-and-bloom.co.uk') throw Error('Wrong Production site origin')
  const apiBase = env.VITE_API_BASE_URL
  if (typeof apiBase !== 'string' || !apiBase) throw Error('Explicit Backend API base required')
  if (env.VITE_API_ENVIRONMENT !== target) throw Error('Explicit API environment must match target')
  if (apiBase !== '/api') {
    let api: URL
    try { api = new URL(apiBase) } catch { throw Error('Invalid Backend API base') }
    if (![api.origin, `${api.origin}/api`].includes(apiBase) || api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || !['', '/', '/api'].includes(api.pathname) || apiBase.endsWith('/')) throw Error('API must be HTTPS origin or origin/api')
    if (target === 'production' && /(^|[.-])(sandbox|staging|localhost)([.-]|$)/i.test(api.hostname)) throw Error('Sandbox API cannot be a Production target')
  }
  if (env.VITE_PAYPAL_SANDBOX_CLIENT_ID || (target === 'production' && env.VITE_SANDBOX_REGISTRATION_ENABLED && env.VITE_SANDBOX_REGISTRATION_ENABLED !== 'false')) throw Error('Conflicting Sandbox configuration')
  const allowed = new Set(['VITE_TARGET_ENVIRONMENT', 'VITE_API_ENVIRONMENT', 'VITE_PAYMENT_MODE', 'VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_SITE_URL', 'VITE_API_BASE_URL', 'VITE_SOURCE_REVISION', 'VITE_SANDBOX_REGISTRATION_ENABLED', 'VITE_PAYPAL_SANDBOX_CLIENT_ID'])
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('VITE_') && !allowed.has(name)) throw Error('Unknown public configuration field')
    if (name.startsWith('VITE_') && /SECRET|PASSWORD|TOKEN|PRIVATE_KEY/.test(name)) throw Error('Private credential field in public configuration')
    if (name.startsWith('VITE_') && typeof value === 'string' && /\b(?:[sr]k_(?:live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) throw Error('Private credential in public configuration')
  }
  return { target, paymentMode: paymentMode as StorefrontEnvironment['paymentMode'], siteOrigin: site, apiBase, publishableKey }
}
