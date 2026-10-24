export type PayPalCallbacks = {
 createOrder: () => Promise<string>
 onApprove: (data: {orderID: string}) => Promise<void>
 onCancel: () => void
 onError: (error: unknown) => void
}
export type PayPalButtonsHandle = {render: (node: HTMLElement) => Promise<void>; close: () => Promise<void>}
export type PayPalSdk = {Buttons: (options: PayPalCallbacks & {fundingSource: string}) => PayPalButtonsHandle}
declare global {interface Window {colorfulSandboxPayPal?: PayPalSdk}}
let loading: Promise<PayPalSdk> | undefined
let loadedId: string | undefined
/** Call only after explicit payment interaction. Backend independently forbids Live. */
export function loadPayPalSandbox(clientId: string): Promise<PayPalSdk> {
 if (!/^[A-Za-z0-9_-]{8,256}$/.test(clientId)) return Promise.reject(new Error('Sandbox payments are not configured'))
 if (loading) return loadedId === clientId ? loading : Promise.reject(new Error('PayPal configuration changed; reload'))
 loadedId = clientId
 loading = new Promise((resolve,reject) => {
  if (window.colorfulSandboxPayPal) {reject(new Error('Unverified pre-existing PayPal SDK'));return}
  const script = document.createElement('script')
  const url = new URL('https://www.paypal.com/sdk/js')
  url.search = new URLSearchParams({'client-id':clientId,currency:'GBP',intent:'capture',components:'buttons','buyer-country':'GB','disable-funding':'card,credit,paylater',commit:'true'}).toString()
  script.src=url.href;script.async=true;script.dataset.namespace='colorfulSandboxPayPal'
  const timer=window.setTimeout(()=>{script.remove();reject(new Error('PayPal did not load; refresh this order'))},15000)
  script.onload=()=>{window.clearTimeout(timer);if(window.colorfulSandboxPayPal)resolve(window.colorfulSandboxPayPal);else reject(new Error('PayPal unavailable'))}
  script.onerror=()=>{window.clearTimeout(timer);script.remove();reject(new Error('PayPal unavailable; refresh this order'))}
  document.head.append(script)
 })
 return loading
}
