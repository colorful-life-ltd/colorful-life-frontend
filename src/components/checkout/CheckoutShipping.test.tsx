import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkout } from './Checkout'
import { CheckoutApiError } from '../../features/checkout/api'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
import { ShippingOptionsError } from '../../features/checkout/shipping'
import { financialsFixture, shippingOptionsFixture } from '../../features/checkout/shippingFixtures'

const mocks = vi.hoisted(() => ({ addresses: vi.fn(), create: vi.fn(), read: vi.fn(), prepare: vi.fn(), recover: vi.fn(), shipping: vi.fn(), payment: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1 } } }) }))
vi.mock('../../features/account/addressApi', () => ({ getAddresses: mocks.addresses }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), createOrder: mocks.create, getOrder: mocks.read, preparePayment: mocks.prepare, recoverPayment: mocks.recover }))
vi.mock('../../features/checkout/shipping', async original => ({ ...await original<typeof import('../../features/checkout/shipping')>(), getShippingOptions: mocks.shipping }))
vi.mock('./StripePaymentForm', () => ({ StripePaymentForm: (props: { clientSecret: string }) => { mocks.payment(props.clientSecret); return <p>Stripe Payment Element</p> } }))

const addresses = [{ id: 1, recipientName: 'Delivery', line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: true, isDefaultBilling: false }, { id: 2, recipientName: 'Billing', line1: '2 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: false, isDefaultBilling: true }]
const listing = cartListing(offer(16901, { effectivePrice: '18.75' }))
const deliveryAddress = { recipientName: 'Delivery', line1: '1 Street', city: 'London', postcode: 'SW1A 1AA', countryCode: 'GB' }
const order = { id: 41, status: 'PENDING', totalAmount: '26.74', reservationExpiresAt: new Date(Date.now() + 1800000).toISOString(), payment: null, billingRecipientName: 'Billing', billingLine1: '2 Street', billingLine2: null, billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Delivery', deliveryLine1: '1 Street', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', orderItems: [{ id: 1, quantity: 1, unitPrice: '18.75', lineTotal: '18.75', conditionSnapshot: 'NEW', productListing: { id: 16901, legoProduct: { title: 'Flowers', setNumber: '123' } } }], financials: financialsFixture('18.75', 'EXPRESS') }
const ATTEMPT = 'colorful-life:checkout-attempt:1'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root, container: HTMLDivElement, cart: CartContextValue
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} /></CartContext.Provider>)) }
const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text))
async function click(text: string) { await act(async () => { const found = button(text); if (!found) throw new Error(`Button missing: ${text}`); found.click() }) }
const radio = (code: string) => container.querySelector<HTMLInputElement>(`input[name="shipping-method"][value="${code}"]`)!
async function choose(code: 'STANDARD' | 'EXPRESS') { await act(async () => radio(code).click()) }
const text = () => container.textContent ?? ''
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/checkout')
  mocks.shipping.mockResolvedValue(shippingOptionsFixture); mocks.addresses.mockResolvedValue(addresses)
  mocks.read.mockImplementation(async () => ({ ...order, paymentWindow: windowFixture(mocks.prepare.mock.calls.length ? 'CHECKOUT_RESUMABLE' : 'INITIAL_PAYMENT') }))
  mocks.prepare.mockResolvedValue('secret')
  cart = { items: [{ productListingId: 16901, listing, quantity: 1 }], isLoading: false, error: null, pendingItemIds: [], refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
})
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = '' })

describe('explicit delivery method selection', () => {
  it('shows both backend methods with charges and after-dispatch estimates, with nothing preselected', async () => {
    await mount()
    const legend = container.querySelector('fieldset legend')
    expect(legend?.textContent).toBe('Choose how your order is delivered')
    for (const [code, label, charge, estimate] of [['STANDARD', 'Standard Delivery', '£3.99', 'Estimated 3–5 working days after dispatch'], ['EXPRESS', 'Express Delivery', '£7.99', 'Estimated 1–3 working days after dispatch']]) {
      const option = radio(code).closest('label')!
      expect(option.textContent).toContain(label); expect(option.textContent).toContain(charge); expect(option.textContent).toContain(estimate)
      expect(radio(code).checked).toBe(false)
      expect(document.getElementById(radio(code).getAttribute('aria-describedby')!)?.textContent).toBe(estimate)
    }
    expect(text()).toContain('not guaranteed delivery dates')
    expect(container.querySelector('.checkout__shipping-option--selected')).toBeNull()
    expect(text()).toContain('Choose a delivery method'); expect(text()).toContain('Shown after you choose delivery')
  })
  it('requires an explicit choice: a create attempt without one is blocked with an accessible message', async () => {
    await mount()
    expect(button('Create order')?.disabled).toBe(false)
    await click('Create order')
    expect(mocks.create).not.toHaveBeenCalled(); expect(sessionStorage.getItem(ATTEMPT)).toBeNull()
    const fieldset = container.querySelector('fieldset')!
    // Invalid state lives on the radio controls; fieldset/legend grouping is unchanged.
    expect(fieldset.hasAttribute('aria-invalid')).toBe(false)
    expect(fieldset.getAttribute('aria-describedby')).toBe('checkout-shipping-note')
    for (const code of ['STANDARD', 'EXPRESS']) {
      expect(radio(code).getAttribute('aria-invalid')).toBe('true')
      expect(radio(code).getAttribute('aria-describedby')?.split(' ')).toEqual([`shipping-estimate-${code}`, 'checkout-shipping-required'])
    }
    expect(container.querySelector('#checkout-shipping-required')?.getAttribute('role')).toBe('alert')
    expect(text()).toContain('Choose Standard or Express delivery before creating your order.')
    expect(document.activeElement).toBe(radio('STANDARD'))
    await choose('EXPRESS')
    expect(container.querySelector('#checkout-shipping-required')).toBeNull()
    for (const code of ['STANDARD', 'EXPRESS']) { expect(radio(code).hasAttribute('aria-invalid')).toBe(false); expect(radio(code).getAttribute('aria-describedby')).toBe(`shipping-estimate-${code}`) }
  })
  it.each([['STANDARD', '£3.99', '£22.74'], ['EXPRESS', '£7.99', '£26.74']] as const)('%s: highlights the choice, estimates the total and submits only method identity', async (code, charge, total) => {
    mocks.create.mockResolvedValue({ id: 41 })
    await mount(); await choose(code)
    expect(radio(code).checked).toBe(true)
    expect(radio(code).closest('label')?.classList.contains('checkout__shipping-option--selected')).toBe(true)
    expect(text()).toContain('Merchandise subtotal£18.75'); expect(text()).toContain(`Delivery${code === 'STANDARD' ? 'Standard' : 'Express'} Delivery · ${charge}`); expect(text()).toContain(`Estimated total${total}`)
    await click('Create order')
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('jwt', { shippingMethod: code, items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress }, expect.any(String))
    const sent = mocks.create.mock.calls[0][1]
    expect(Object.keys(sent).sort()).toEqual(['deliveryAddress', 'items', 'shippingMethod'])
    expect(JSON.stringify(sent)).not.toMatch(/charge|total|amount|price|cost/i)
  })
  it('displays backend prices rather than built-in values', async () => {
    const repriced = JSON.parse(JSON.stringify(shippingOptionsFixture)); repriced.methods[0].chargePence = 450
    mocks.shipping.mockResolvedValue(repriced)
    await mount(); await choose('STANDARD')
    expect(radio('STANDARD').closest('label')?.textContent).toContain('£4.50'); expect(text()).toContain('Estimated total£23.25')
    expect(text()).not.toContain('£3.99')
  })
  it('blocks duplicate creation clicks while a request is in flight', async () => {
    let resolve!: (value: { id: number }) => void
    mocks.create.mockImplementation(() => new Promise(done => { resolve = done }))
    await mount(); await choose('STANDARD')
    await act(async () => { button('Create order')!.click(); button('Reserving')?.click() })
    await act(async () => { button('Reserving')?.click() })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ id: 41 }))
  })
})

describe('shipping catalogue availability', () => {
  it.each([
    ['loading failure', new ShippingOptionsError('Delivery options could not be loaded. Check your connection and try again.')],
    ['invalid or old-backend response', new ShippingOptionsError('Delivery options are unavailable right now, so orders cannot be created. Please try again shortly.')],
  ])('never creates a merchandise-only order after %s, and recovers on explicit retry', async (_name, error) => {
    mocks.shipping.mockRejectedValueOnce(error)
    await mount()
    expect(text()).toContain(error.message)
    expect(container.querySelectorAll('input[name="shipping-method"]')).toHaveLength(0)
    expect(button('Create order')?.disabled).toBe(true)
    await click('Create order'); expect(mocks.create).not.toHaveBeenCalled()
    await click('Try loading delivery options again')
    expect(mocks.shipping).toHaveBeenCalledTimes(2); expect(radio('STANDARD').checked).toBe(false)
    expect(button('Create order')?.disabled).toBe(false)
  })
  it('shows a loading state and keeps creation unavailable until the catalogue arrives', async () => {
    let release!: (value: typeof shippingOptionsFixture) => void
    mocks.shipping.mockImplementation(() => new Promise(done => { release = done }))
    await mount()
    expect(text()).toContain('Loading delivery options…'); expect(button('Create order')?.disabled).toBe(true)
    await act(async () => release(shippingOptionsFixture))
    expect(button('Create order')?.disabled).toBe(false); expect(radio('EXPRESS').checked).toBe(false)
  })
})

describe('saved request, idempotency and recovery', () => {
  it('replays the exact saved method and key after refresh, and locks the selector', async () => {
    const saved = { key: 'saved-key', input: { shippingMethod: 'EXPRESS', items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress } }
    sessionStorage.setItem(ATTEMPT, JSON.stringify(saved))
    mocks.create.mockResolvedValue({ id: 41 })
    await mount()
    expect(radio('EXPRESS').checked).toBe(true); expect(radio('STANDARD').checked).toBe(false)
    expect(container.querySelector('fieldset')?.disabled).toBe(true)
    expect(text()).toContain('keeps its original delivery method'); expect(text()).toContain('delivery address and delivery method')
    expect(text()).toContain('Estimated totalConfirmed when your order is reserved'); expect(text()).not.toContain('Shown after you choose delivery')
    await act(async () => radio('STANDARD').click()) // A disabled control cannot reprice the saved request.
    await click('Retry saved order request')
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('jwt', saved.input, 'saved-key')
  })
  it('persists the selected method in the saved request before sending, and keeps it after a lost response', async () => {
    mocks.create.mockRejectedValue(new Error('Connection interrupted.'))
    await mount(); await choose('EXPRESS'); await click('Create order')
    const saved = JSON.parse(sessionStorage.getItem(ATTEMPT)!)
    expect(saved.input.shippingMethod).toBe('EXPRESS'); expect(mocks.create.mock.calls[0][2]).toBe(saved.key)
    await act(async () => root.unmount()); await mount()
    expect(radio('EXPRESS').checked).toBe(true); expect(container.querySelector('fieldset')?.disabled).toBe(true)
    await click('Retry saved order request')
    expect(mocks.create).toHaveBeenLastCalledWith('jwt', saved.input, saved.key)
  })
  it('never replays a pre-shipping saved request with an invented method', async () => {
    sessionStorage.setItem(ATTEMPT, JSON.stringify({ key: 'legacy-key', input: { items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress } }))
    await mount()
    expect(text()).toContain('made before delivery options were introduced'); expect(text()).toContain('check My Orders')
    expect(button('Retry saved order request')?.disabled).toBe(true)
    expect(text()).not.toContain('Retry first if the previous response was lost')
    await click('Retry saved order request')
    expect(mocks.create).not.toHaveBeenCalled(); expect(JSON.parse(sessionStorage.getItem(ATTEMPT)!).key).toBe('legacy-key')
    expect(button('View My Orders')).toBeTruthy(); expect(button('Leave saved checkout')).toBeTruthy()
  })
  it('retires a definite 400 validation rejection for explicit review and never auto-resubmits', async () => {
    mocks.create.mockRejectedValueOnce(new CheckoutApiError(400, undefined, 'shippingMethod'))
    await mount(); await choose('STANDARD'); await click('Create order')
    expect(text()).toContain('Please choose Standard or Express delivery and try again. No order was created.')
    expect(sessionStorage.getItem(ATTEMPT)).toBeNull(); expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(text()).not.toContain('Retry saved order request')
    const firstKey = mocks.create.mock.calls[0][2]
    mocks.create.mockResolvedValue({ id: 41 })
    await click('Create order')
    expect(mocks.create).toHaveBeenCalledTimes(2); expect(mocks.create.mock.calls[1][2]).not.toBe(firstKey)
  })
  it('keeps a saved request and its key when a replay is rejected with 400, and sends the customer to My Orders', async () => {
    // A later backend may reject a previously valid method; validation precedes the idempotency lookup,
    // so an earlier ambiguous send of this request may already have created an order.
    const saved = { key: 'replay-key', input: { shippingMethod: 'EXPRESS', items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress } }
    sessionStorage.setItem(ATTEMPT, JSON.stringify(saved))
    mocks.create.mockRejectedValue(new CheckoutApiError(400, undefined, 'shippingMethod'))
    await mount(); await click('Retry saved order request')
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('jwt', saved.input, 'replay-key')
    expect(JSON.parse(sessionStorage.getItem(ATTEMPT)!)).toEqual({ ...saved, rejection: 'REPLAY_REJECTED' })
    expect(text()).toContain('an earlier attempt may already have created an order'); expect(text()).toContain('Check My Orders before starting a new checkout')
    expect(button('Retry saved order request')?.disabled).toBe(true); expect(button('View My Orders')).toBeTruthy()
    expect(radio('EXPRESS').checked).toBe(true); expect(container.querySelector('fieldset')?.disabled).toBe(true)
    await click('Retry saved order request'); expect(mocks.create).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount()); await mount() // Refresh keeps recovery-only state; nothing is sent.
    expect(text()).toContain('An order may already exist from this saved checkout request'); expect(button('Retry saved order request')?.disabled).toBe(true)
    await click('Retry saved order request'); expect(mocks.create).toHaveBeenCalledTimes(1)
    await click('Leave saved checkout'); expect(sessionStorage.getItem(ATTEMPT)).toBeNull(); expect(mocks.create).toHaveBeenCalledTimes(1)
  })
  it('stops on an idempotency conflict without retrying or creating another order', async () => {
    const saved = { key: 'conflict-key', input: { shippingMethod: 'STANDARD', items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress } }
    sessionStorage.setItem(ATTEMPT, JSON.stringify(saved))
    mocks.create.mockRejectedValue(new CheckoutApiError(409, 'ORDER_IDEMPOTENCY_MISMATCH'))
    await mount(); await click('Retry saved order request')
    expect(text()).toContain('This checkout request changed'); expect(text()).toContain('Return to storefront and review cart')
    expect(button('Retry saved order request')).toBeUndefined(); expect(button('Create order')).toBeUndefined()
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })
})

describe('persisted order financials and payment regression', () => {
  it('shows the backend breakdown after creation and starts Stripe for the existing order only', async () => {
    history.replaceState({}, '', '/checkout/orders/41')
    mocks.shipping.mockResolvedValue({ ...shippingOptionsFixture, methods: shippingOptionsFixture.methods.map(m => ({ ...m, chargePence: 1 })) })
    await mount()
    expect(mocks.shipping).not.toHaveBeenCalled(); expect(container.querySelector('input[name="shipping-method"]')).toBeNull()
    const breakdown = container.querySelector('dl[aria-label="Order price breakdown"]')!
    expect(breakdown.textContent).toContain('Merchandise subtotal£18.75'); expect(breakdown.textContent).toContain('Express Delivery · £7.99')
    expect(breakdown.textContent).toContain('Estimated 1–3 working days after dispatch'); expect(breakdown.textContent).toContain('Order total£26.74')
    await click('Continue to secure payment')
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith('jwt', 41); expect(mocks.payment).toHaveBeenCalledWith('secret')
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('shows the persisted total, not a recomputed catalogue price', async () => {
    history.replaceState({}, '', '/checkout/orders/41')
    mocks.read.mockResolvedValue({ ...order, paymentWindow: windowFixture(), totalAmount: '30.00', financials: { currency: 'GBP', merchandiseSubtotal: '25.00', shipping: { code: 'STANDARD', method: 'Standard Delivery', chargePence: 500, minWorkingDays: 3, maxWorkingDays: 5, estimatesFrom: 'DISPATCH' }, totalAmount: '30.00' } })
    await mount()
    expect(text()).toContain('Standard Delivery · £5.00'); expect(text()).toContain('Order total£30.00'); expect(text()).not.toContain('£3.99')
  })
  it('treats historical null shipping as unknown, never free', async () => {
    history.replaceState({}, '', '/checkout/orders/41')
    mocks.read.mockResolvedValue({ ...order, paymentWindow: windowFixture(), totalAmount: '18.75', financials: { currency: 'GBP', merchandiseSubtotal: '18.75', shipping: null, totalAmount: '18.75' } })
    await mount()
    expect(text()).toContain('Delivery details unavailable'); expect(text()).toContain('does not mean delivery was free')
    expect(text()).not.toMatch(/£0\.00|Free delivery|Standard Delivery|Express Delivery/)
  })
  it('falls back to the order total when no valid breakdown exists', async () => {
    history.replaceState({}, '', '/checkout/orders/41')
    mocks.read.mockResolvedValue({ ...order, paymentWindow: windowFixture(), totalAmount: '20.50', financials: undefined })
    await mount()
    expect(text()).toContain('A detailed price breakdown is unavailable'); expect(text()).toContain('Order total £20.50'); expect(text()).not.toContain('£0.00')
  })
})
