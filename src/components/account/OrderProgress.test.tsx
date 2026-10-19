// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { OrderProgress } from './OrderProgress'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
it('shows pending cancellation, uncertain refund, preparing, tracking and returns without operator notes',async()=>{
 const host=document.createElement('div'),root=createRoot(host)
 await act(async()=>root.render(<OrderProgress order={{cancellation:{state:'REQUESTED',cancelledAt:null},refunds:[{id:1,amount:'5',currency:'GBP',status:'SUCCEEDED',reviewRequired:true,createdAt:'2026-10-19T12:00:00Z',reason:'PRIVATE'}],fulfilment:{stage:'PREPARING',preparingAt:'2026-10-19T12:00:00Z',shipments:[]},orderItems:[{returns:[{id:2,quantity:1,status:'AUTHORIZED',requestedAt:'2026-10-19T12:00:00Z',inspectionNote:'PRIVATE'}]}]}}/>))
 expect(host.textContent).toContain('not yet cancelled')
 expect(host.textContent).toContain('Outcome under review')
 expect(host.textContent).not.toContain('Refund confirmed')
 expect(host.textContent).toContain('being prepared')
 expect(host.textContent).toContain('authorized')
 expect(host.textContent).not.toContain('PRIVATE')
 await act(async()=>root.unmount())
})
