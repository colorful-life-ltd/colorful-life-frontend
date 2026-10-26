import {afterEach,it,expect,vi} from 'vitest'
const load=vi.hoisted(()=>vi.fn().mockResolvedValue(null))
vi.mock('@stripe/stripe-js/pure',()=>({loadStripe:load}))
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();load.mockClear()})
it.each(['stripe-sandbox','paypal-sandbox'])('rejects Live publishable keys in %s',async mode=>{
 vi.stubEnv('VITE_PAYMENT_MODE',mode);vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY','pk_live_synthetic123456')
 const {stripeForPayment}=await import('./stripeLoader');expect(stripeForPayment()).toBeNull();expect(load).not.toHaveBeenCalled()
})
it('loads only the Test key lazily and preserves Sandbox registration admission',async()=>{
 vi.stubEnv('VITE_PAYMENT_MODE','stripe-sandbox');vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY','pk_test_synthetic123456');vi.stubEnv('VITE_SANDBOX_REGISTRATION_ENABLED','false')
 const {stripeForPayment}=await import('./stripeLoader');expect(load).not.toHaveBeenCalled();await stripeForPayment();await stripeForPayment();expect(load).toHaveBeenCalledTimes(1)
 const settings=await import('./sandbox');expect(settings.sandboxCheckout).toBe(true);expect(settings.registrationAvailable).toBe(false)
})
