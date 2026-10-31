import {it,expect} from 'vitest'
import fixture from '../../../contracts/payment-window-v1.json'
import {parsePaymentWindow,paymentMessage,paymentActionLabel,paymentAction,canRecoverPayment} from './paymentWindow'
it('retains shared wire-contract parsing but never offers unsupported payment actions',()=>{
 for(const w of fixture.windows){expect(parsePaymentWindow(w)?.provider).toBe('PAYPAL');expect(parsePaymentWindow({...w,provider:'UNKNOWN'})).toBeNull()}
 for(const w of fixture.windows){expect(paymentAction(w)).toBeNull();expect(canRecoverPayment(w)).toBe(false);expect(paymentMessage(w)).not.toContain('PayPal');expect(paymentActionLabel(w)).toBe('Payment unavailable')}
})
it('manual payments retain identity but cannot grant a browser payment action',()=>{
 expect(parsePaymentWindow({...fixture.windows[3],provider:'MANUAL'})?.provider).toBe('MANUAL')
 expect(parsePaymentWindow({...fixture.windows[0],provider:'MANUAL'})).toBeNull()
})
