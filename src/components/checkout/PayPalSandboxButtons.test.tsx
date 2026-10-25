// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {windowFixture} from '../../features/checkout/paymentWindowFixtures'
const mocks=vi.hoisted(()=>({load:vi.fn(),create:vi.fn(),capture:vi.fn(),read:vi.fn(),render:vi.fn(),close:vi.fn(),buttons:vi.fn()}))
vi.mock('../../features/checkout/sandbox',()=>({sandboxClientId:'sandbox-fixture-id',sandboxCheckout:true}))
vi.mock('../../features/checkout/paypalSdk',()=>({loadPayPalSandbox:mocks.load}))
vi.mock('../../features/checkout/api',()=>({createPayPalOrder:mocks.create,capturePayPalOrder:mocks.capture,getOrder:mocks.read}))
import {PayPalSandboxButtons} from './PayPalSandboxButtons'
let root:Root,div:HTMLDivElement
const verify=vi.fn(),refresh=vi.fn()
let options:{createOrder:()=>Promise<string>;onApprove:(x:{orderID:string})=>Promise<void>;onCancel:()=>void;onError:()=>void}
beforeEach(()=>{
 vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 div=document.createElement('div');document.body.append(div);root=createRoot(div)
 mocks.buttons.mockImplementation(x=>{options=x;return{render:mocks.render,close:mocks.close}})
 mocks.load.mockResolvedValue({Buttons:mocks.buttons});mocks.render.mockResolvedValue(undefined);mocks.close.mockResolvedValue(undefined)
 mocks.read.mockResolvedValue({id:41,status:'PENDING',paymentWindow:windowFixture('INITIAL_PAYMENT',{provider:'PAYPAL'})});mocks.create.mockResolvedValue('PP-41');mocks.capture.mockResolvedValue({id:41,status:'CONFIRMED',paymentWindow:windowFixture('PAID',{provider:'PAYPAL'})})
})
afterEach(async()=>{await act(async()=>root.unmount());div.remove()})
async function mount(){await act(async()=>root.render(<PayPalSandboxButtons token="jwt" orderId={41} onVerification={verify} onRefresh={refresh}/>))}
async function activate(){await mount();expect(mocks.load).not.toHaveBeenCalled();await act(async()=>div.querySelector('button')!.click())}
describe('PayPal Sandbox browser callbacks',()=>{
 it('loads lazily and invokes only server create/capture then authoritative verification',async()=>{
  await activate();expect(mocks.load).toHaveBeenCalledWith('sandbox-fixture-id');expect(mocks.create).not.toHaveBeenCalled()
  await act(async()=>expect(await options.createOrder()).toBe('PP-41'))
  await act(async()=>{await options.onApprove({orderID:'PP-41'});await options.onApprove({orderID:'PP-41'})})
  expect(mocks.create).toHaveBeenCalledWith('jwt',41);expect(mocks.capture).toHaveBeenCalledExactlyOnceWith('jwt',41,'PP-41');expect(verify).toHaveBeenCalledTimes(1)
 })
 it('never captures or marks success from cancellation/error',async()=>{
  await activate();await act(async()=>{options.onCancel();options.onError()});expect(mocks.capture).not.toHaveBeenCalled();expect(verify).not.toHaveBeenCalled();expect(refresh).toHaveBeenCalledTimes(2)
 })
 it('rejects changed capability and mismatched provider approval identity',async()=>{
  await activate();mocks.read.mockResolvedValue({id:41,status:'PENDING',paymentWindow:windowFixture('PROCESSING',{provider:'PAYPAL'})});await expect(options.createOrder()).rejects.toThrow();expect(mocks.create).not.toHaveBeenCalled()
  mocks.read.mockResolvedValue({id:41,status:'PENDING',paymentWindow:windowFixture('INITIAL_PAYMENT',{provider:'PAYPAL'})});await options.createOrder();await expect(options.onApprove({orderID:'wrong'})).rejects.toThrow();expect(mocks.capture).not.toHaveBeenCalled();expect(verify).not.toHaveBeenCalled()
 })
 it('uncertain capture triggers read verification and never claims success or retries capture',async()=>{
  await activate();await options.createOrder();mocks.capture.mockRejectedValue(new Error('timeout'));await act(async()=>options.onApprove({orderID:'PP-41'}));expect(verify).toHaveBeenCalledTimes(1);expect(div.textContent).toContain('not yet confirmed');expect(div.textContent).not.toContain('Payment confirmed')
 })
})
