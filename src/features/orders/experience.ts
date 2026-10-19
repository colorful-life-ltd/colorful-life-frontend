export type CustomerRefund = { id: number; amount: string; currency: string; status: 'SUCCEEDED'|'PROCESSING'|'FAILED'; reviewRequired: boolean; createdAt: string }
export type CustomerReturn = { id: number; quantity: number; status: string; requestedAt: string }
export type CustomerShipment = { sequence: number; carrierName: string; trackingNumber: string|null; trackingUrl: string|null; dispatchedAt: string; tracking?: { progress: string; deliveredAt: string|null } }
export type CustomerExperience = { refunds: CustomerRefund[]; cancellation: {state:'NONE'|'REQUESTED'|'CANCELLED';cancelledAt:string|null}|null; fulfilment: {stage:string|null;preparingAt:string|null;shipments:CustomerShipment[]}|null; returns: CustomerReturn[] }
const record = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))
const nullableDate = (v: unknown) => v === null || date(v)
export function safeCustomerTrackingUrl(v: unknown): string|null {
  if (typeof v !== 'string') return null
  try { const url = new URL(v); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
/** Optional during additive rollout; malformed new data is never presented as a finalized outcome. */
export function parseCustomerExperience(value: unknown): CustomerExperience|null {
  if (!record(value)) return null
  const refunds: CustomerRefund[] = [], returns: CustomerReturn[] = []
  if (value.refunds !== undefined) {
    if (!Array.isArray(value.refunds)) return null
    for (const r of value.refunds) {
      if (!record(r) || !id(r.id) || typeof r.amount!=='string' || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(r.amount) || r.currency!=='GBP' || !['SUCCEEDED','PROCESSING','FAILED'].includes(String(r.status)) || typeof r.reviewRequired!=='boolean' || !date(r.createdAt)) return null
      refunds.push({id:r.id,amount:r.amount,currency:r.currency,status:r.status as CustomerRefund['status'],reviewRequired:r.reviewRequired,createdAt:r.createdAt})
    }
  }
  let cancellation: CustomerExperience['cancellation'] = null
  if (value.cancellation !== undefined) {
    const c = value.cancellation
    if (!record(c) || !['NONE','REQUESTED','CANCELLED'].includes(String(c.state)) || !nullableDate(c.cancelledAt)) return null
    cancellation={state:c.state as NonNullable<CustomerExperience['cancellation']>['state'],cancelledAt:c.cancelledAt as string|null}
  }
  let fulfilment: CustomerExperience['fulfilment'] = null
  if (value.fulfilment !== undefined) {
    const f=value.fulfilment
    if (!record(f) || !(f.stage===null || ['CONFIRMED','PREPARING','DISPATCHED','IN_TRANSIT','DELIVERED'].includes(String(f.stage))) || !nullableDate(f.preparingAt) || !Array.isArray(f.shipments)) return null
    const shipments: CustomerShipment[]=[]
    for (const s of f.shipments) {
      if (!record(s) || !id(s.sequence) || typeof s.carrierName!=='string' || !(s.trackingNumber===null || typeof s.trackingNumber==='string') || !date(s.dispatchedAt)) return null
      let tracking: CustomerShipment['tracking']
      if (s.tracking !== undefined) {
        if (!record(s.tracking) || !['DISPATCHED','IN_TRANSIT','DELIVERED'].includes(String(s.tracking.progress)) || !nullableDate(s.tracking.deliveredAt)) return null
        tracking={progress:String(s.tracking.progress),deliveredAt:s.tracking.deliveredAt as string|null}
      }
      shipments.push({sequence:s.sequence,carrierName:s.carrierName,trackingNumber:s.trackingNumber,trackingUrl:safeCustomerTrackingUrl(s.trackingUrl),dispatchedAt:s.dispatchedAt,...(tracking?{tracking}:{})})
    }
    fulfilment={stage:f.stage as string|null,preparingAt:f.preparingAt as string|null,shipments}
  }
  if (Array.isArray(value.orderItems)) for (const item of value.orderItems) {
    if (!record(item) || item.returns===undefined) continue
    if (!Array.isArray(item.returns)) return null
    for (const r of item.returns) {
      if (!record(r) || !id(r.id) || !id(r.quantity) || !['REQUESTED','AUTHORIZED','RECEIVED','INSPECTED','COMPLETED','REJECTED','CANCELLED'].includes(String(r.status)) || !date(r.requestedAt)) return null
      returns.push({id:r.id,quantity:r.quantity,status:String(r.status),requestedAt:r.requestedAt})
    }
  }
  return {refunds,cancellation,fulfilment,returns}
}
