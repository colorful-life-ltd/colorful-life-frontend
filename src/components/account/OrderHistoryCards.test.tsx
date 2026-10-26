// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, getCurrentUser } from '../../features/auth/api'
import { windowFixture } from '../../features/checkout/paymentWindowFixtures'
import type { PaymentWindow } from '../../features/checkout/paymentWindow'
import { CustomerOrders } from './CustomerOrders'
import { resetOrderThumbnailCache } from '../../features/orders/productThumbnails'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const line = (id: number, title: string, quantity = 1, productId: number | null = 700 + id) => ({ id, quantity, unitPrice: '10.00', lineTotal: `${10 * quantity}.00`, conditionSnapshot: 'NEW', productListing: { id: 900 + id, legoProduct: { ...(productId === null ? {} : { id: productId }), title, setNumber: `${1000 + id}` } } })
const order = (overrides: Record<string, unknown> = {}) => ({ id: 41, status: 'CONFIRMED', totalAmount: '28.49', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', shippingCarrier: null, trackingNumber: null, dispatchedAt: null, completedAt: null,
  orderItems: [line(1, 'Flower Bouquet', 2)], paymentWindow: windowFixture('PAID', { provider: 'PAYPAL' }),
  financials: { currency: 'GBP', merchandiseSubtotal: '20.50', shipping: { code: 'EXPRESS', method: 'Express Delivery', chargePence: 799, minWorkingDays: 1, maxWorkingDays: 3, estimatesFrom: 'DISPATCH' }, totalAmount: '28.49' }, ...overrides })

let root: Root, container: HTMLDivElement, fetcher: ReturnType<typeof vi.fn>, observed: Element[]
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
function serve(orders: unknown[], products: Record<number, unknown> = {}) {
  fetcher.mockImplementation((url: string) => {
    if (url === '/api/orders') return json(orders)
    const match = /^\/api\/products\/by-product\/(\d+)$/.exec(url)
    if (match) return Object.hasOwn(products, match[1]) ? json(products[Number(match[1])]) : json({ error: 'not found' }, 404)
    throw new Error(`Unexpected request ${url}`)
  })
}
async function mount() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CustomerOrders path="/account/orders" onAccount={vi.fn()} onAuthenticate={vi.fn()} /></AuthProvider>))
}
const cards = () => [...container.querySelectorAll<HTMLElement>('.order-card')]
const fact = (card: Element, name: string) => [...card.querySelectorAll('.order-card__facts > div')].find(row => row.querySelector('dt')?.textContent === name)?.querySelector('dd')?.textContent
const product = (id: number, images: { url: string; sortOrder: number }[]) => ({ id, isRetired: false, setNumber: '1001', title: 'Flower Bouquet', description: null, theme: 'Botanical', ageRecommendation: null, pieceCount: null, category: null, catalogueArtworkUrl: null, catalogueArtworkPublicId: null,
  productImages: images.map((image, index) => ({ id: index + 1, altText: null, ...image })), isFeatureProduct: false, offers: [] })
const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  vi.resetAllMocks(); resetOrderThumbnailCache(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); history.replaceState({}, '', '/account/orders')
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'test@example.com', firstName: null, lastName: null, phone: null })
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); observed = []
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('compact order history cards', () => {
  it('shows date, total and order number in the header, and status, items, payment and delivery in the body', async () => {
    serve([order()]); await mount()
    const [card] = cards()
    expect(card.querySelector('.order-card__meta')?.textContent).toBe('Order placed1 Oct 2026Total£28.492 itemsOrder #41View order details')
    expect(card.querySelector('.order-card__status')?.textContent).toBe('Confirmed')
    expect(card.querySelector('.order-card__items')?.textContent).toBe('Flower BouquetSet 1001 · Qty 2')
    expect(fact(card, 'Payment')).toBe('Paid · PayPal'); expect(fact(card, 'Delivery')).toBe('Express Delivery')
  })

  it('keeps returns guidance, progress text, charges and addresses off the list', async () => {
    serve([order({ fulfilment: { stage: 'DISPATCHED', preparingAt: null, shipments: [{ sequence: 1, carrierName: 'Royal Mail', trackingNumber: 'RM123', trackingUrl: null, dispatchedAt: '2026-10-02T09:00:00Z' }] }, status: 'DISPATCHED', dispatchedAt: '2026-10-02T09:00:00Z', trackingNumber: 'RM123' })]); await mount()
    const text = container.textContent!
    for (const absent of ['To arrange a return', 'Need to return something', 'Delivery progress', 'RM123', 'Royal Mail', '£7.99', 'Payment has been recorded']) expect(text).not.toContain(absent)
    expect(cards()[0].querySelector('.order-card__status')?.textContent).toBe('Dispatched · Dispatched 2 Oct 2026')
    expect(fact(cards()[0], 'Delivery')).toBe('Express Delivery · Dispatched')
  })

  it('summarises multi-product orders with the first three products and a count of the rest', async () => {
    serve([order({ orderItems: [line(1, 'Rose', 1), line(2, 'Tulip', 2), line(3, 'Daisy', 1), line(4, 'Lily', 3), line(5, 'Orchid', 1)] })]); await mount()
    const [card] = cards()
    expect([...card.querySelectorAll('.order-card__item-name')].map(node => node.textContent)).toEqual(['Rose', 'Tulip', 'Daisy'])
    expect(card.querySelector('.order-card__more')?.textContent).toBe('+2 more products in this order')
    expect(card.querySelector('.order-card__meta')?.textContent).toContain('8 items')
  })

  it('says "1 more product" in the singular and shows no count for three or fewer products', async () => {
    serve([order({ id: 2, orderItems: [line(1, 'A'), line(2, 'B'), line(3, 'C'), line(4, 'D')] }), order({ id: 1, orderItems: [line(1, 'A'), line(2, 'B'), line(3, 'C')] })]); await mount()
    expect(cards()[0].querySelector('.order-card__more')?.textContent).toBe('+1 more product in this order')
    expect(cards()[1].querySelector('.order-card__more')).toBeNull()
  })

  it.each<[PaymentWindow['state'], Partial<PaymentWindow>, string]>([
    ['PAID', { provider: 'STRIPE' }, 'Paid · Stripe'],
    ['INITIAL_PAYMENT', {}, 'Awaiting payment · Stripe'],
    ['CHECKOUT_RESUMABLE', { provider: 'PAYPAL' }, 'Checkout can be resumed · PayPal'],
    ['PROCESSING', {}, 'Payment processing · Stripe'],
    ['OUTCOME_UNRESOLVED', {}, 'Payment outcome unresolved · Stripe'],
    ['RETRY_AVAILABLE', {}, 'Unpaid · replacement payment available · Stripe'],
    ['RETRY_REQUIRES_PROVIDER_CHECK', {}, 'Payment check required · Stripe'],
    ['NOT_PAYABLE', {}, 'Not payable · Stripe'],
    ['NOT_PAYABLE', { paymentOutcome: 'UNRESOLVED' }, 'Payment outcome unresolved · Stripe'],
    ['PAID', { provider: 'MANUAL' }, 'Paid'],
  ])('labels a %s window (%o) from the order’s own payment window', async (state, overrides, label) => {
    serve([order({ status: state === 'PAID' ? 'CONFIRMED' : 'PENDING', paymentWindow: windowFixture(state, overrides) })]); await mount()
    expect(fact(cards()[0], 'Payment')).toBe(label)
  })

  it('never infers payment from compatibility fields when the window is missing or invalid', async () => {
    serve([order({ id: 2, paymentWindow: null, payment: { status: 'SUCCEEDED', paidAt: null } }), order({ id: 1, paymentWindow: { state: 'PAID' } })]); await mount()
    expect(cards().map(card => fact(card, 'Payment'))).toEqual(['Payment status unavailable', 'Payment status unavailable'])
  })

  it('shows real fulfilment stages, omits the redundant confirmed stage and never invents delivery data', async () => {
    const stage = (value: string | null) => ({ stage: value, preparingAt: null, shipments: [] })
    serve([order({ id: 4, fulfilment: stage('PREPARING') }), order({ id: 3, fulfilment: stage('CONFIRMED') }), order({ id: 2, fulfilment: stage('IN_TRANSIT') }),
      order({ id: 1, financials: { currency: 'GBP', merchandiseSubtotal: '20.50', shipping: null, totalAmount: '20.50' }, totalAmount: '20.50' })]); await mount()
    expect(cards().map(card => fact(card, 'Delivery'))).toEqual(['Express Delivery · Preparing', 'Express Delivery', 'Express Delivery · In transit', 'Delivery details unavailable'])
    expect(container.textContent).not.toMatch(/£0\.00|Free|Arriving|Delivered/)
  })

  it('shows the empty state without a list', async () => {
    serve([]); await mount()
    expect(container.querySelector('.order-history')).toBeNull()
    expect(container.querySelector('.order-history__empty')?.textContent).toBe('You haven’t placed any orders yet.')
  })

  it('exposes each card as a labelled article whose action names its order', async () => {
    serve([order({ id: 42 }), order()]); await mount()
    expect(container.querySelector('ol.order-history')?.getAttribute('aria-label')).toBe('Your orders, newest first')
    for (const card of cards()) {
      const article = card.querySelector('article')!, heading = article.querySelector('h2')!, action = article.querySelector('button')!
      expect(article.getAttribute('aria-labelledby')).toBe(heading.id)
      expect(action.textContent).toBe('View order details'); expect(action.getAttribute('aria-describedby')).toBe(heading.id)
    }
    await act(async () => cards()[1].querySelector('button')!.click())
    expect(location.pathname).toBe('/account/orders/41')
  })
})

describe('order item thumbnails', () => {
  function observeImmediately() {
    vi.stubGlobal('IntersectionObserver', class {
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) { this.callback = callback }
      observe(node: Element) { observed.push(node); this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver) }
      disconnect() {}
    })
  }
  it('reuses the first catalogue product image once a card is visible', async () => {
    observeImmediately()
    serve([order()], { 701: product(701, [{ url: 'https://res.cloudinary.com/x/second.jpg', sortOrder: 2 }, { url: 'https://res.cloudinary.com/x/first.jpg', sortOrder: 1 }]) }); await mount(); await settle()
    const image = container.querySelector<HTMLImageElement>('.order-card__thumb img')!
    expect(image.getAttribute('src')).toBe('https://res.cloudinary.com/x/first.jpg'); expect(image.alt).toBe('')
    expect(container.querySelector('.order-card__thumb')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the placeholder for sold-out products and requests each product only once', async () => {
    observeImmediately()
    serve([order({ id: 2, orderItems: [line(1, 'Rose')] }), order({ id: 1, orderItems: [line(1, 'Rose')] })]); await mount(); await settle()
    expect(container.querySelector('.order-card__thumb img')).toBeNull()
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('/api/products/'))).toHaveLength(1)
  })

  it('makes no product requests without visibility support or a product ID', async () => {
    serve([order()]); await mount()
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/orders'])
    observeImmediately(); await act(async () => root.unmount()); document.body.innerHTML = ''
    serve([order({ orderItems: [line(1, 'Rose', 1, null)] })]); await mount(); await settle()
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('/api/products/'))).toHaveLength(0)
  })
})

