import {useEffect,useRef,useState} from 'react'
import {createPayPalOrder,capturePayPalOrder,getOrder} from '../../features/checkout/api'
import {parsePaymentWindow,paymentAction} from '../../features/checkout/paymentWindow'
import {loadPayPalSandbox,type PayPalButtonsHandle,type PayPalCallbacks} from '../../features/checkout/paypalSdk'
import {sandboxClientId} from '../../features/checkout/sandbox'

export function PayPalSandboxButtons({token,orderId,onVerification,onRefresh}:{token:string;orderId:number;onVerification:()=>void;onRefresh:()=>void}){
 const host=useRef<HTMLDivElement>(null)
 const callbacks=useRef({onVerification,onRefresh})
 useEffect(()=>{callbacks.current={onVerification,onRefresh}},[onVerification,onRefresh])
 const [requested,setRequested]=useState(false)
 const [message,setMessage]=useState<string|null>(null)
 useEffect(()=>{
  if(!requested)return
  let active=true;let buttons:PayPalButtonsHandle|undefined;let expected:string|undefined;let captured:Promise<void>|undefined
  const report=(text:string)=>{if(active)setMessage(text)}
  const options:PayPalCallbacks={
   createOrder:async()=>{
    if(!active||captured)throw new Error('Refresh order status before paying again')
    const order=await getOrder(token,orderId)
    if(order.id!==orderId||order.status!=='PENDING'||parsePaymentWindow(order.paymentWindow)?.provider!=='PAYPAL'||!paymentAction(order.paymentWindow))throw new Error('Payment window changed; refresh order status')
    expected=await createPayPalOrder(token,orderId)
    if(!active)throw new Error('Checkout closed; refresh order status')
    return expected
   },
   onApprove:async(data)=>{
    if(!active||!expected||data.orderID!==expected)throw new Error('Payment identity mismatch; refresh order status')
    // One capture promise per SDK session; the server remains idempotency authority.
    captured??=(async()=>{
     report('Checking the payment with our server…')
     try{
      const order=await capturePayPalOrder(token,orderId,expected!)
      if(order.id!==orderId)throw new Error('Unexpected order')
      // Browser approval/capture response never marks an order paid. The existing
      // hook polls authoritative order state and requires actual confirmation.
      if(active)callbacks.current.onVerification()
     }catch{
      report('Payment outcome is not yet confirmed. Do not pay again; refresh order status.')
      if(active)callbacks.current.onVerification()
     }
    })()
    await captured
   },
   onCancel:()=>{report('PayPal approval was cancelled. No payment success is assumed. Refresh order status before retrying.');if(active)callbacks.current.onRefresh()},
   onError:()=>{report('PayPal could not finish. Do not pay again until you have checked order status.');if(active)callbacks.current.onRefresh()},
  }
  void loadPayPalSandbox(sandboxClientId).then(async sdk=>{
   if(!active||!host.current)return
   buttons=sdk.Buttons({...options,fundingSource:'paypal'});await buttons.render(host.current)
  }).catch(()=>report('PayPal Sandbox is unavailable. Refresh this order to try again.'))
  return()=>{active=false;void buttons?.close().catch(()=>{})}
 },[requested,token,orderId])
 return <div className="checkout__paypal"><p>PayPal Sandbox — test money only.</p>{!requested&&<button type="button" onClick={()=>setRequested(true)}>Continue with PayPal Sandbox</button>}<div ref={host}/>{message&&<p role="status">{message}</p>}</div>
}
