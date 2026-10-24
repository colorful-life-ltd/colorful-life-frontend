import {it,expect} from 'vitest'
import fixture from '../../../contracts/payment-window-v1.json'
import {parsePaymentWindow,paymentMessage,paymentActionLabel} from './paymentWindow'
it('accepts shared provider-aware windows and preserves provider-specific presentation',()=>{
 for(const w of fixture.windows){expect(parsePaymentWindow(w)?.provider).toBe('PAYPAL');expect(parsePaymentWindow({...w,provider:'UNKNOWN'})).toBeNull()}
 expect(paymentMessage(fixture.windows[1])).toContain('PayPal');expect(paymentActionLabel(fixture.windows[1])).toContain('PayPal')
})
it('manual payments retain identity but cannot grant a browser payment action',()=>{
 expect(parsePaymentWindow({...fixture.windows[3],provider:'MANUAL'})?.provider).toBe('MANUAL')
 expect(parsePaymentWindow({...fixture.windows[0],provider:'MANUAL'})).toBeNull()
})
