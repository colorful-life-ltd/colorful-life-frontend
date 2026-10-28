// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HelpCentre } from './HelpCentre'
import { FAQ_CATEGORIES } from '../../features/help/faq'
import { COMPANY } from '../../features/legal/company'
import { catalogueLocationFromUrl, catalogueLocationHref } from '../catalogue/catalogueSpread'
import { catalogueRouteHead } from '../../features/seo/routeHead'
import App from '../../App'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
  sessionStorage.clear(); history.replaceState({}, '', '/help')
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  container = document.createElement('div'); document.body.append(container)
})
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mount(element = <HelpCentre />) { root = createRoot(container); await act(async () => root!.render(element)) }
it('renders all 23 useful questions, categories and native keyboard controls', async () => {
  await mount()
  expect(container.querySelectorAll('details')).toHaveLength(23)
  const ids = FAQ_CATEGORIES.flatMap(c => [c.id, ...c.questions.map(q => q.id)])
  expect(new Set(ids).size).toBe(ids.length)
  for (const category of FAQ_CATEGORIES) {
    expect(container.querySelector(`nav a[href="#${category.id}"]`)).not.toBeNull()
    for (const q of category.questions) {
      const detail = container.querySelector(`#${q.id}`)!
      expect(detail.firstElementChild?.tagName).toBe('SUMMARY')
      expect(detail.firstElementChild?.textContent).toBe(q.question)
      expect(detail.querySelector(`a[href="/help#${q.id}"]`)).not.toBeNull()
    }
  }
})
it('opens and focuses a directly linked question on entry and hash changes', async () => {
  history.replaceState({}, '', '/help#opened-box'); await mount()
  expect(container.querySelector<HTMLDetailsElement>('#opened-box')!.open).toBe(true)
  expect(document.activeElement).toBe(container.querySelector('#opened-box summary'))
  await act(async () => { history.replaceState({}, '', '/help#return-postage'); window.dispatchEvent(new HashChangeEvent('hashchange')) })
  expect(container.querySelector<HTMLDetailsElement>('#return-postage')!.open).toBe(true)
  expect(document.activeElement).toBe(container.querySelector('#return-postage summary'))
})
it('ignores unknown and malformed hashes safely', async () => {
  history.replaceState({}, '', '/help#%E0%A4'); await mount()
  expect(container.querySelector('details[open]')).toBeNull()
})
it('reuses support configuration and preserves the approved policy boundaries', () => {
  const view = document.createElement('div'); view.innerHTML = renderToStaticMarkup(<HelpCentre />)
  const copy = view.textContent!
  for (const link of view.querySelectorAll('a[href^="mailto:"]')) expect(link.getAttribute('href')).toBe(`mailto:${COMPANY.supportEmail}`)
  for (const phrase of ['2–3 working days', 'dispatch time, not a guaranteed delivery date', 'No. It acknowledges receipt', 'dispatch confirmation email', 'direct return cost', 'no automatic refusal or deduction', 'further 14 days', '3 working days', '18 or older']) expect(copy).toContain(phrase)
  for (const claim of ['Retired Set', 'Download my data', 'refund within 3', 'Apple Pay', 'Google Pay', 'open 24', 'guaranteed next-day']) expect(copy).not.toContain(claim)
})
it('uses the existing book route and sets correct crawlable metadata', async () => {
  const location = catalogueLocationFromUrl('/help', '')
  expect(location.open).toBe(true)
  expect(catalogueLocationHref(location.spread)).toBe('/help')
  expect(catalogueRouteHead({ spread: location.spread, open: true, categories: [], categoriesReady: true })).toMatchObject({ title: 'Help & FAQs | Build & Bloom', canonicalPath: '/help', robots: 'index,follow' })
  await mount(<App />)
  expect(document.title).toBe('Help & FAQs | Build & Bloom')
  expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${window.location.origin}/help`)
  expect(container.querySelector('.customer-information [aria-current="page"]')?.getAttribute('href')).toBe('/help')
})
it.each(['.mobile-quick-controls button:first-child', '.customer-information-notebook'])('opens Help from %s without changing Account/Cart controls', async selector => {
  history.replaceState({}, '', '/'); await mount(<App />)
  expect([...container.querySelectorAll('.mobile-quick-controls button')].map(b => b.textContent)).toEqual(['Help', 'Account', 'Cart'])
  await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click())
  expect(location.pathname).toBe('/help')
  expect(container.querySelector('.help-centre')).not.toBeNull()
})
