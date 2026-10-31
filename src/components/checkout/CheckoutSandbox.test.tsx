// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi} from 'vitest'
import {windowFixture} from '../../features/checkout/paymentWindowFixtures'
const mocks=vi.hoisted(()=>({read:vi.fn(),create:vi.fn(),capture:vi.fn(),stripe:vi.fn(),recover:vi.fn(),load:vi.fn(),buttons:vi.fn(),close:vi.fn(),render:vi.fn()}))
vi.mock('../../features/auth/AuthProvider',()=>({useAuth:()=>({state:{status:'authenticated',token:'jwt',user:{id:1}}})}))
vi.mock('../../features/checkout/sandbox',()=>({sandboxCheckout:true,sandboxClientId:'synthetic-sandbox-client'}))
vi.mock('../../features/checkout/api',async original=>({...await original<typeof import('../../features/checkout/api')>(),getOrder:mocks.read,preparePayment:mocks.stripe,recoverPayment:mocks.recover}))
import {Checkout} from './Checkout'
it('does not offer unsupported payment providers even when the server advertises permission',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});history.replaceState({},'', '/checkout/orders/41')
 const order={billingRecipientName:'Test',billingLine1:'1 Test Road',billingCity:'London',billingPostcode:'SW1A 1AA',billingCountryCode:'GB',deliveryRecipientName:'Test',deliveryLine1:'1 Test Road',deliveryCity:'London',deliveryPostcode:'SW1A 1AA',deliveryCountryCode:'GB',id:41,status:'PENDING',totalAmount:'1.00',payment:null,orderItems:[],paymentWindow:windowFixture('INITIAL_PAYMENT',{provider:'PAYPAL'})}
 mocks.read.mockResolvedValue(order)
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 try{
  await act(async()=>root.render(<Checkout onAccount={()=>{}}/>))
  expect(node.textContent).not.toContain('PayPal');expect(node.textContent).not.toContain('Continue to secure payment')
  expect(mocks.stripe).not.toHaveBeenCalled();expect(mocks.recover).not.toHaveBeenCalled()
  expect(document.querySelector('script[src*="paypal.com"]')).toBeNull()
 }finally{await act(async()=>root.unmount());node.remove();history.replaceState({},'','/')}
})

it('uses the existing Stripe preparation flow for a new Test order in Sandbox',async()=>{
 vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});history.replaceState({},'', '/checkout/orders/42')
 mocks.read.mockResolvedValue({billingRecipientName:'Test',billingLine1:'1 Test Road',billingCity:'London',billingPostcode:'SW1A 1AA',billingCountryCode:'GB',deliveryRecipientName:'Test',deliveryLine1:'1 Test Road',deliveryCity:'London',deliveryPostcode:'SW1A 1AA',deliveryCountryCode:'GB',id:42,status:'PENDING',totalAmount:'1.00',payment:null,orderItems:[],paymentWindow:windowFixture('INITIAL_PAYMENT')});mocks.stripe.mockRejectedValue(new Error('synthetic setup failure'))
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 try {
  await act(async()=>root.render(<Checkout onAccount={()=>{}}/>))
  await act(async()=>{[...node.querySelectorAll('button')].find(b=>b.textContent==='Continue to secure payment')!.click()})
  expect(mocks.stripe).toHaveBeenCalledWith('jwt',42);expect(mocks.load).not.toHaveBeenCalled();expect(mocks.capture).not.toHaveBeenCalled()
 } finally {await act(async()=>root.unmount());node.remove();history.replaceState({},'','/')}
})
