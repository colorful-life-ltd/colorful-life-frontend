import contract from '../../../contracts/integration-v1.json'
import { expect, it } from 'vitest'
import { parseCustomerExperience } from './experience'
it('parses the versioned Backend-owned customer contract without leaking provider/operator fields',()=>{
 expect(contract.version).toBe(1)
 const result=parseCustomerExperience(contract.customerOrder)
 expect(result?.cancellation?.state).toBe('REQUESTED')
 expect(result?.refunds[0].amount).toBe('5.00')
 expect(result?.fulfilment?.stage).toBe('PREPARING')
 expect(JSON.stringify(result)).not.toMatch(/providerReference|performedByUserId|reasonNote|idempotencyKey/)
})
