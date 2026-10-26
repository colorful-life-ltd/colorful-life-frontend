import {sandboxCheckout} from '../../features/checkout/sandbox'
export function SandboxBanner(){
 return sandboxCheckout ? <div role="note" className="sandbox-banner">Sandbox test environment (PayPal / Stripe Test Mode) — test accounts only. No real payments or customer orders.</div> : null
}
