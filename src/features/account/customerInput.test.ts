import {it,expect} from 'vitest'
import {customerAddressError,normalizePostcode,validPhone} from './customerInput'
it('normalises UK postcodes and rejects invalid postal, phone and overlong fields',()=>{
 const address={recipientName:'Test Buyer',line1:'1 Test Road',city:'London',postcode:'sw1a1aa',phone:'+44 7700 900123'}
 expect(customerAddressError(address)).toBeNull();expect(normalizePostcode(address.postcode)).toBe('SW1A 1AA')
 for(const patch of [{postcode:'bad'},{line1:'x'.repeat(201)},{phone:'12345'}])expect(customerAddressError({...address,...patch})).toBeTruthy()
 expect(validPhone('')).toBe(true);expect(validPhone('07700 900123')).toBe(true)
})

it.each(['  sw1a   1aa  ','sw1a\t1aa','SW1A\n1AA'])('normalises whitespace before limiting postcode length: %j',postcode=>{
 expect(customerAddressError({recipientName:'Test',line1:'1 Road',city:'London',postcode})).toBeNull()
 expect(normalizePostcode(postcode)).toBe('SW1A 1AA')
})
