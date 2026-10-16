import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliveryEstimate, estimatedTotalPence, getShippingOptions, isShippingMethod, parseOrderFinancials, parseShippingOptions, ShippingOptionsError } from './shipping'
import { financialsFixture, shippingOptionsFixture } from './shippingFixtures'

afterEach(() => vi.unstubAllGlobals())
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
// Deliberately loose shape so tests can corrupt individual backend fields.
type Mutable = { currency: unknown; methods: Array<Record<string, unknown>> }

describe('authoritative shipping catalogue', () => {
  it('accepts the exact backend Issue #182 catalogue', () => {
    expect(parseShippingOptions(clone(shippingOptionsFixture))).toEqual(shippingOptionsFixture)
  })
  it('keeps backend prices rather than approved constants (backend is authoritative)', () => {
    const changed = clone(shippingOptionsFixture); changed.methods[0].chargePence = 450
    expect(parseShippingOptions(changed)?.methods[0].chargePence).toBe(450)
  })
  it.each([
    ['unknown method code', (o: Mutable) => { o.methods[0].code = 'NEXT_DAY' }],
    ['lower-case code', (o: Mutable) => { o.methods[0].code = 'standard' }],
    ['duplicate code', (o: Mutable) => { o.methods[1].code = 'STANDARD' }],
    ['non-GBP currency', (o: Mutable) => { o.currency = 'EUR' }],
    ['empty method list', (o: Mutable) => { o.methods = [] }],
    ['fractional pence', (o: Mutable) => { o.methods[0].chargePence = 3.99 }],
    ['negative charge', (o: Mutable) => { o.methods[0].chargePence = -1 }],
    ['string charge', (o: Mutable) => { o.methods[0].chargePence = '399' }],
    ['estimate from order creation', (o: Mutable) => { o.methods[0].estimatesFrom = 'ORDER' }],
    ['inverted working days', (o: Mutable) => { o.methods[0].minWorkingDays = 6 }],
    ['zero working days', (o: Mutable) => { o.methods[1].minWorkingDays = 0 }],
    ['blank label', (o: Mutable) => { o.methods[0].method = ' ' }],
  ])('fails closed for %s', (_name, mutate) => {
    const value = clone(shippingOptionsFixture) as unknown as Mutable; mutate(value)
    expect(parseShippingOptions(value)).toBeNull()
  })
  it.each([null, undefined, [], 'GBP', { currency: 'GBP' }])('rejects non-catalogue payload %j', value => { expect(parseShippingOptions(value)).toBeNull() })
  it('accepts only the two case-sensitive method identities', () => {
    expect(isShippingMethod('STANDARD')).toBe(true); expect(isShippingMethod('EXPRESS')).toBe(true)
    for (const value of ['standard', 'Express', 'FREE', '', null, undefined, 1]) expect(isShippingMethod(value)).toBe(false)
  })
})

describe('estimate wording and display arithmetic', () => {
  it('states working-day ranges after dispatch, never a guaranteed date', () => {
    expect(deliveryEstimate(shippingOptionsFixture.methods[0])).toBe('Estimated 3–5 working days after dispatch')
    expect(deliveryEstimate(shippingOptionsFixture.methods[1])).toBe('Estimated 1–3 working days after dispatch')
    expect(deliveryEstimate({ minWorkingDays: 1, maxWorkingDays: 1 })).toBe('Estimated 1 working day after dispatch')
  })
  it('adds integer pence for the display-only estimate', () => {
    expect(estimatedTotalPence(1875, shippingOptionsFixture.methods[0])).toBe(2274)
    expect(estimatedTotalPence(1875, shippingOptionsFixture.methods[1])).toBe(2674)
  })
})

describe('persisted order financials', () => {
  it('accepts a reconciled STANDARD and EXPRESS breakdown', () => {
    expect(parseOrderFinancials(financialsFixture('25.00'))).toEqual({ currency: 'GBP', merchandiseSubtotal: '25.00', shipping: { ...shippingOptionsFixture.methods[0] }, totalAmount: '28.99' })
    expect(parseOrderFinancials(financialsFixture('25.00', 'EXPRESS'))?.totalAmount).toBe('32.99')
  })
  it('treats historical null shipping as unknown, never zero', () => {
    const parsed = parseOrderFinancials({ currency: 'GBP', merchandiseSubtotal: '20.00', shipping: null, totalAmount: '20.00' })
    expect(parsed).toEqual({ currency: 'GBP', merchandiseSubtotal: '20.00', shipping: null, totalAmount: '20.00' })
  })
  it('keeps a valid non-catalogue historical label with code null and its persisted price', () => {
    const value = { currency: 'GBP', merchandiseSubtotal: '20.00', shipping: { code: null, method: 'Old Courier', chargePence: 250, minWorkingDays: 2, maxWorkingDays: 4, estimatesFrom: 'DISPATCH' }, totalAmount: '22.50' }
    expect(parseOrderFinancials(value)?.shipping).toEqual(value.shipping)
  })
  it.each([
    ['inconsistent total', { ...financialsFixture('25.00'), totalAmount: '25.00' }],
    ['unformatted money', { ...financialsFixture('25.00'), merchandiseSubtotal: '25' }],
    ['unknown code', { ...financialsFixture('25.00'), shipping: { ...financialsFixture('25.00').shipping, code: 'FREE' } }],
    ['missing currency', { ...financialsFixture('25.00'), currency: undefined }],
    ['absent', undefined],
  ])('discards %s rather than repairing it', (_name, value) => { expect(parseOrderFinancials(value)).toBeNull() })
})

describe('public shipping options request', () => {
  it('uses an unauthenticated GET to the backend catalogue', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(shippingOptionsFixture))); vi.stubGlobal('fetch', fetcher)
    expect(await getShippingOptions()).toEqual(shippingOptionsFixture)
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/orders/shipping-options', expect.not.objectContaining({ method: 'POST' }))
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined()
  })
  it.each([
    ['old backend route (404)', () => Promise.resolve(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })), 'unavailable'],
    ['server error', () => Promise.resolve(new Response('oops', { status: 500 })), 'unavailable'],
    ['invalid catalogue', () => Promise.resolve(new Response(JSON.stringify({ currency: 'GBP', methods: [{ code: 'FREE' }] }))), 'unavailable'],
    ['network failure', () => Promise.reject(new Error('offline')), 'could not be loaded'],
  ])('fails closed on %s', async (_name, response, message) => {
    vi.stubGlobal('fetch', vi.fn(response))
    await expect(getShippingOptions()).rejects.toThrow(message)
    await expect(getShippingOptions()).rejects.toBeInstanceOf(ShippingOptionsError)
  })
})
