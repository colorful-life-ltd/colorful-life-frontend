import { expect, it } from 'vitest'
import { parseCustomerExperience, safeCustomerTrackingUrl } from './experience'
import { productAvailabilityLabel, sellableOffers } from '../catalogue/api'
import { offer } from '../catalogue/catalogueFixtures'
const refund={id:3,amount:'5.00',currency:'GBP',status:'SUCCEEDED',reviewRequired:false,createdAt:'2026-10-19T12:00:00Z'}
it('accepts the minimal Backend external refund projection without actor/provider details',()=>{
 expect(parseCustomerExperience({refunds:[{...refund,performedByUserId:null,reason:'PRIVATE'}]})).toMatchObject({refunds:[refund]})
 expect(JSON.stringify(parseCustomerExperience({refunds:[{...refund,providerReference:'SECRET'}]}))).not.toContain('SECRET')
})
it('keeps uncertain refunds distinct from paid refunds and fails closed on malformed financial data',()=>{
 expect(parseCustomerExperience({refunds:[{...refund,reviewRequired:true}]} )?.refunds[0].reviewRequired).toBe(true)
 for(const patch of [{amount:'NaN'},{amount:'-5'},{amount:'5.001'},{currency:'USD'},{status:'UNKNOWN'},{reviewRequired:'false'}]) expect(parseCustomerExperience({refunds:[{...refund,...patch}]})).toBeNull()
})
it('parses Preparing/delivery progress and safe links without trusting raw events or javascript URLs',()=>{
 const source={fulfilment:{stage:'IN_TRANSIT',preparingAt:null,shipments:[{sequence:1,carrierName:'Royal Mail',trackingNumber:'AB123456789GB',trackingUrl:'https://www.royalmail.com/track-your-item',dispatchedAt:refund.createdAt,tracking:{progress:'IN_TRANSIT',deliveredAt:null}}]}}
 expect(parseCustomerExperience(source)?.fulfilment?.stage).toBe('IN_TRANSIT')
 for (const url of ['javascript:alert(1)','http://example.test','https://user:pass@example.test',{}]) expect(safeCustomerTrackingUrl(url)).toBeNull()
 expect(parseCustomerExperience({...source,fulfilment:{...source.fulfilment,stage:'UNVERIFIED_DELIVERED'}})).toBeNull()
})
it('supports cancellation request and withdrawal summaries and minimal return history',()=>{
 expect(parseCustomerExperience({cancellation:{state:'REQUESTED',cancelledAt:null}})?.cancellation?.state).toBe('REQUESTED')
 expect(parseCustomerExperience({cancellation:{state:'NONE',cancelledAt:null}})?.cancellation?.state).toBe('NONE')
 expect(parseCustomerExperience({orderItems:[{returns:[{id:1,quantity:1,status:'INSPECTED',requestedAt:refund.createdAt,inspectionNote:'PRIVATE'}]}]})?.returns).toEqual([{id:1,quantity:1,status:'INSPECTED',requestedAt:refund.createdAt}])
})
it('only explicit administrator policy supplies restock/discontinued labels; neither enables backorders',()=>{
 const empty={offers:[]}
 expect(productAvailabilityLabel(empty)).toBe('Sold Out')
 expect(productAvailabilityLabel({...empty,availabilityState:'MORE_ON_THE_WAY'})).toBe('More on the Way')
 expect(sellableOffers({...empty,availabilityState:'MORE_ON_THE_WAY'})).toEqual([])
 const stocked={offers:[offer(1)],availabilityState:'DISCONTINUED' as const}
 expect(productAvailabilityLabel(stocked)).toBe('Discontinued')
 expect(sellableOffers(stocked)).toEqual([])
 expect(sellableOffers({...stocked,isPublished:false,availabilityState:'STANDARD'})).toEqual([])
})
