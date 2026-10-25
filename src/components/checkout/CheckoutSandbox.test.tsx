// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi} from 'vitest'
import {windowFixture} from '../../features/checkout/paymentWindowFixtures'
import {CartContext,type CartContextValue} from '../../features/cart/CartContext'
const mocks=vi.hoisted(()=>({read:vi.fn(),create:vi.fn(),capture:vi.fn(),stripe:vi.fn(),recover:vi.fn(),load:vi.fn(),buttons:vi.fn(),close:vi.fn(),render:vi.fn()}))
vi.mock('../../features/auth/AuthProvider',()=>({useAuth:()=>({state:{status:'authenticated',token:'jwt',user:{id:1}}})}))
vi.mock('../../features/checkout/sandbox',()=>({sandboxCheckout:true,sandboxClientId:'synthetic-sandbox-client'}))
vi.mock('../../features/checkout/paypalSdk',()=>({loadPayPalSandbox:mocks.load}))
vi.mock('../../features/checkout/api',async original=>({...await original<typeof import('../../features/checkout/api')>(),getOrder:mocks.read,createPayPalOrder:mocks.create,capturePayPalOrder:mocks.capture,preparePayment:mocks.stripe,recoverPayment:mocks.recover}))
import {Checkout} from './Checkout'
it('owner Sandbox browser approval verifies server state through the real checkout hook without Stripe',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});history.replaceState({},'', '/checkout/orders/41')
 const order={id:41,status:'PENDING',totalAmount:'1.00',payment:null,reservationExpiresAt:null,billingRecipientName:'Fixture',billingLine1:'Fixture',billingCity:'London',billingPostcode:'SW1A 1AA',billingCountryCode:'GB',deliveryRecipientName:'Fixture',deliveryLine1:'Fixture',deliveryCity:'London',deliveryPostcode:'SW1A 1AA',deliveryCountryCode:'GB',orderItems:[],financials:null,paymentWindow:windowFixture('INITIAL_PAYMENT',{provider:'PAYPAL'})}
 mocks.read.mockResolvedValue(order);mocks.create.mockResolvedValue('PP-41');mocks.render.mockResolvedValue(undefined);mocks.close.mockResolvedValue(undefined)
 type Options={createOrder:()=>Promise<string>;onApprove:(v:{orderID:string})=>Promise<void>}
 let options:Options|undefined
 mocks.buttons.mockImplementation((x:Options)=>{options=x;return{render:mocks.render,close:mocks.close}});mocks.load.mockResolvedValue({Buttons:mocks.buttons})
 const cart={items:[],isLoading:false,error:null,pendingItemIds:[],refreshCart:vi.fn().mockResolvedValue(undefined),addListing:vi.fn(),updateQuantity:vi.fn(),removeItem:vi.fn()} as CartContextValue
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 try{
  await act(async()=>root.render(<CartContext.Provider value={cart}><Checkout onAccount={()=>{}}/></CartContext.Provider>))
  expect(mocks.load).not.toHaveBeenCalled();expect(node.textContent).not.toContain('Payment confirmed')
  await act(async()=>{const button=[...node.querySelectorAll('button')].find(x=>x.textContent?.includes('Continue with PayPal Sandbox'));expect(button).toBeDefined();button!.click()})
  await act(async()=>{expect(await options!.createOrder()).toBe('PP-41')})
  const confirmed={...order,status:'CONFIRMED',payment:{status:'SUCCEEDED',paidAt:'2026-10-24T12:00:00.000Z'},paymentWindow:windowFixture('PAID',{provider:'PAYPAL'})}
  mocks.capture.mockImplementation(async()=>{mocks.read.mockResolvedValue(confirmed);return confirmed})
  await act(async()=>{await options!.onApprove({orderID:'PP-41'})})
  expect(node.textContent).toContain('Payment confirmed');expect(cart.refreshCart).toHaveBeenCalledTimes(1);expect(mocks.stripe).not.toHaveBeenCalled();expect(mocks.recover).not.toHaveBeenCalled()
 }finally{await act(async()=>root.unmount());node.remove();history.replaceState({},'','/')}
})
