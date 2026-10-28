// @vitest-environment jsdom
import indexHtml from '../../../index.html?raw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerInformationIndex, LegalDocument } from './CustomerInformation'
import { catalogueLocationFromUrl, catalogueLocationHref, legalLocation, spreadAfterAction } from '../catalogue/catalogueSpread'
import { catalogueRouteHead } from '../../features/seo/routeHead'
import { SiteFooter } from './LegalLayout'
import { PreContractSummary } from './PreContractSummary'
import { LEGAL_PAGES, isLegalPath, legalPage, type LegalSlug } from '../../features/legal/routes'
import { OWNER_DECISIONS } from '../../features/legal/ownerDecisions'
import { cancellationEmailBody, emptyCancellation } from '../../features/legal/cancellation'
import { COMPANY } from '../../features/legal/company'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
let container: HTMLDivElement
async function render(node: React.ReactNode) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(node))
  return container
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.unstubAllGlobals() })
const shippingResponse = { currency: 'GBP', methods: [
  { code: 'STANDARD', method: 'Standard Delivery', chargePence: 399, minWorkingDays: 3, maxWorkingDays: 5, estimatesFrom: 'DISPATCH' },
  { code: 'EXPRESS', method: 'Express Delivery', chargePence: 799, minWorkingDays: 1, maxWorkingDays: 3, estimatesFrom: 'DISPATCH' }] }
const LegalSpread = ({ pathname, onSelect = () => {} }: { pathname: string; onSelect?: (slug: LegalSlug) => void }) => {
  const slug = legalPage(pathname)!.slug
  return <><CustomerInformationIndex current={slug} onSelect={onSelect} /><LegalDocument page={slug} /></>
}
const stubShipping = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(shippingResponse), { status: 200 })))

describe('legal pages', () => {
  it.each(LEGAL_PAGES)('renders $title with the company identity and contact details', async page => {
    stubShipping()
    const view = await render(<LegalSpread pathname={page.path} />)
    expect(view.querySelector('#legal-document-title')?.textContent).toBe(page.title)
    expect(view.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(page.path)
    const text = view.textContent ?? ''
    for (const value of [COMPANY.legalName, COMPANY.registrationNumber, 'Bolton-Upon-Dearne', 'S63 8NS', COMPANY.supportEmail, 'England and Wales'])
      expect(text).toContain(value)
  })

  it('reads every legal URL as a spread of the open book, returning to Contents', () => {
    for (const page of LEGAL_PAGES) {
      const location = catalogueLocationFromUrl(page.path, '')
      expect(location).toEqual({ spread: legalLocation(page.slug), open: true, leafletSide: null })
      expect(catalogueLocationHref(location.spread)).toBe(page.path)
      expect(spreadAfterAction(location.spread, 'backward')).toBe('front-matter')
      expect(catalogueRouteHead({ spread: location.spread, open: true, categories: [], categoriesReady: true })).toEqual({ title: `${page.title} | Build & Bloom`, description: page.description, canonicalPath: page.path, robots: 'index,follow' })
    }
  })

  it('turns to another document from the Customer Information page with a plain click only', async () => {
    const onSelect = vi.fn()
    const view = await render(<CustomerInformationIndex current="terms" onSelect={onSelect} />)
    const privacy = view.querySelector<HTMLAnchorElement>('a[href="/legal/privacy"]')!
    await act(async () => privacy.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(onSelect).toHaveBeenCalledWith('privacy')
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    await act(async () => privacy.dispatchEvent(modified))
    expect(modified.defaultPrevented).toBe(false)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('recognises legal paths, including a trailing slash, and nothing else', () => {
    expect(isLegalPath('/legal/terms/')).toBe(true)
    expect(isLegalPath('/legal/unknown')).toBe(false)
    expect(isLegalPath('/checkout')).toBe(false)
  })

  it('shows every open owner decision as a visible placeholder on at least one page', async () => {
    stubShipping()
    const used = new Set<string>()
    for (const page of LEGAL_PAGES) {
      const view = await render(<LegalSpread pathname={page.path} />)
      view.querySelectorAll('[data-owner-decision]').forEach(node => {
        used.add(node.getAttribute('data-owner-decision')!)
        expect(node.textContent).toMatch(/^\[Owner decision required: /)
      })
      await act(async () => root!.unmount()); root = null
    }
    expect([...used].sort()).toEqual(Object.keys(OWNER_DECISIONS).sort())
  })

  it('takes delivery charges and estimates from the backend, never from page copy', async () => {
    stubShipping()
    const view = await render(<LegalSpread pathname="/legal/delivery-returns" />)
    await act(async () => { await Promise.resolve() })
    expect(view.querySelector('table')?.classList.contains('delivery-options-table')).toBe(true)
    const table = view.querySelector('table')?.textContent ?? ''
    expect(table).toContain('Standard Delivery'); expect(table).toContain('£3.99'); expect(table).toContain('Estimated 3–5 working days after dispatch')
    expect(view.textContent).toContain('within 14 days of the day you, or someone you name (other than the carrier), receive the goods')
  })

  it('keeps the statutory faulty-goods rights separate from the right to cancel', async () => {
    const view = await render(<LegalSpread pathname="/legal/terms" />)
    expect(view.textContent).toContain('Consumer Rights Act 2015')
    expect(view.textContent).toContain('within 30 days of delivery you can reject them for a full refund')
    expect(view.textContent).toContain('does not sponsor, authorise or endorse this site')
  })

  it('assembles the model cancellation form entirely in the browser', async () => {
    const body = cancellationEmailBody({ ...emptyCancellation, goods: 'Set 77245', order: '1234', name: 'A Customer' })
    expect(body).toContain('I hereby give notice that I cancel my contract of sale of the following goods:')
    expect(body).toContain('Set 77245 (order number 1234)')
    expect(body).toContain(COMPANY.supportEmail)
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const view = await render(<LegalSpread pathname="/legal/cancellation-form" />)
    const link = view.querySelector<HTMLAnchorElement>('a[href^="mailto:"].legal-form__button')!
    expect(link.href.startsWith(`mailto:${COMPANY.supportEmail}?subject=Cancellation`)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('discloses the trading name and company details in the site footer', async () => {
    const view = await render(<SiteFooter />)
    expect(view.textContent).toContain('Build & Bloom is a trading name of Colorful Life Ltd, a company registered in England and Wales (company number 08097729). Registered office: 3 Hawthorne Drive, Bolton-Upon-Dearne, Rotherham, England, S63 8NS.')
    expect([...view.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(expect.arrayContaining(['/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/delivery-returns', `mailto:${COMPANY.supportEmail}`]))
  })

  it('states the seller, terms, cancellation right and payment obligation at checkout', async () => {
    const order = await render(<PreContractSummary stage="order" />)
    expect(order.textContent).toContain('You are buying from Colorful Life Ltd')
    expect(order.querySelector('a[href="/legal/terms"]')).not.toBeNull()
    expect(order.textContent).toContain('cancellation notice within 14 days')
    await act(async () => root!.unmount()); root = null
    const payment = await render(<PreContractSummary stage="payment" />)
    expect(payment.textContent).toContain('Selecting Pay now places your order with an obligation to pay')
  })

  it('loads no third-party scripts, fonts or trackers from the page shell', () => {
    const html = indexHtml
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i)
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i)
    expect(html).not.toMatch(/googletagmanager|google-analytics|fonts\.googleapis|facebook|hotjar/i)
  })
})

describe('Stripe loading', () => {
  it('does not load Stripe.js until the payment step asks for it, then loads it once', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_lazy')
    const loadStripe = vi.fn(() => Promise.resolve(null))
    vi.doMock('@stripe/stripe-js/pure', () => ({ loadStripe }))
    vi.doMock('@stripe/stripe-js', () => { throw new Error('the side-effect entry must never be imported') })
    await import('../checkout/Checkout')
    expect(loadStripe).not.toHaveBeenCalled()
    const { stripeForPayment } = await import('../../features/checkout/stripeLoader')
    void stripeForPayment(); void stripeForPayment()
    expect(loadStripe).toHaveBeenCalledTimes(1)
    vi.doUnmock('@stripe/stripe-js/pure'); vi.doUnmock('@stripe/stripe-js'); vi.unstubAllEnvs()
  })
})
