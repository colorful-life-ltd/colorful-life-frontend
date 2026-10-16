import { apiBase } from '../auth/api'
import { formatGbp, priceToPence } from '../cart/CartContext'

export const shippingMethodCodes = ['STANDARD', 'EXPRESS'] as const
export type ShippingMethodCode = typeof shippingMethodCodes[number]
export type ShippingOption = { code: ShippingMethodCode; method: string; chargePence: number; minWorkingDays: number; maxWorkingDays: number; estimatesFrom: 'DISPATCH' }
export type ShippingOptions = { currency: 'GBP'; methods: ShippingOption[] }
/** Persisted delivery snapshot. code is null for a valid historical label outside today's catalogue. */
export type OrderShipping = Omit<ShippingOption, 'code'> & { code: ShippingMethodCode | null }
/** Public order money projection. shipping null means UNKNOWN, never free. */
export type OrderFinancials = { currency: 'GBP'; merchandiseSubtotal: string; shipping: OrderShipping | null; totalAmount: string }

export const isShippingMethod = (value: unknown): value is ShippingMethodCode =>
  typeof value === 'string' && (shippingMethodCodes as readonly string[]).includes(value)

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const workingDays = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 365
const pence = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0
const money = (value: unknown): value is string => typeof value === 'string' && /^\d+\.\d{2}$/.test(value)

function parseDelivery(value: unknown): Omit<ShippingOption, 'code'> | null {
  const v = record(value)
  if (!v || typeof v.method !== 'string' || !v.method.trim() || !pence(v.chargePence) || !workingDays(v.minWorkingDays) || !workingDays(v.maxWorkingDays)
    || (v.maxWorkingDays as number) < (v.minWorkingDays as number) || v.estimatesFrom !== 'DISPATCH') return null
  return { method: v.method, chargePence: v.chargePence as number, minWorkingDays: v.minWorkingDays as number, maxWorkingDays: v.maxWorkingDays as number, estimatesFrom: 'DISPATCH' }
}

/** Reject anything that is not the authoritative GBP catalogue. Prices are never invented locally. */
export function parseShippingOptions(value: unknown): ShippingOptions | null {
  const v = record(value)
  if (!v || v.currency !== 'GBP' || !Array.isArray(v.methods) || v.methods.length === 0) return null
  const methods: ShippingOption[] = []
  for (const item of v.methods) {
    const code = record(item)?.code; const delivery = parseDelivery(item)
    if (!isShippingMethod(code) || !delivery || methods.some(method => method.code === code)) return null
    methods.push({ code, ...delivery })
  }
  return { currency: 'GBP', methods }
}

/** Invalid or financially inconsistent breakdowns are discarded rather than repaired. */
export function parseOrderFinancials(value: unknown): OrderFinancials | null {
  const v = record(value)
  if (!v || v.currency !== 'GBP' || !money(v.merchandiseSubtotal) || !money(v.totalAmount)) return null
  if (v.shipping === null) return { currency: 'GBP', merchandiseSubtotal: v.merchandiseSubtotal, shipping: null, totalAmount: v.totalAmount }
  const delivery = parseDelivery(v.shipping); const code = record(v.shipping)?.code
  if (!delivery || !(code === null || isShippingMethod(code))) return null
  if (priceToPence(v.merchandiseSubtotal) + delivery.chargePence !== priceToPence(v.totalAmount)) return null
  return { currency: 'GBP', merchandiseSubtotal: v.merchandiseSubtotal, shipping: { code, ...delivery }, totalAmount: v.totalAmount }
}

export class ShippingOptionsError extends Error {}
export async function getShippingOptions(): Promise<ShippingOptions> {
  let response: Response
  try { response = await fetch(`${apiBase()}/orders/shipping-options`, { signal: AbortSignal.timeout(10000) }) }
  catch { throw new ShippingOptionsError('Delivery options could not be loaded. Check your connection and try again.') }
  const body = response.ok ? await response.json().catch(() => null) : null
  const options = parseShippingOptions(body)
  if (!options) throw new ShippingOptionsError('Delivery options are unavailable right now, so orders cannot be created. Please try again shortly.')
  return options
}

export const deliveryEstimate = (option: Pick<ShippingOption, 'minWorkingDays' | 'maxWorkingDays'>) => option.minWorkingDays === option.maxWorkingDays
  ? `Estimated ${option.minWorkingDays} working ${option.minWorkingDays === 1 ? 'day' : 'days'} after dispatch`
  : `Estimated ${option.minWorkingDays}–${option.maxWorkingDays} working days after dispatch`
export const shippingCharge = (option: Pick<ShippingOption, 'chargePence'>) => formatGbp(option.chargePence)
/** Display-only estimate before reservation; the created order's persisted total is authoritative. */
export const estimatedTotalPence = (merchandisePence: number, option: Pick<ShippingOption, 'chargePence'>) => merchandisePence + option.chargePence
