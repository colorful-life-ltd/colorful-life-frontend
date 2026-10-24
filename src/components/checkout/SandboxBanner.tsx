import {sandboxCheckout} from '../../features/checkout/sandbox'
export function SandboxBanner(){
 return sandboxCheckout ? <div role="note" className="sandbox-banner">PayPal Sandbox test environment — test accounts only. No real payments or customer orders.</div> : null
}
