// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { YourData } from './YourData'
import { AccountView } from './AccountForms'
import { CatalogueProductDetails } from '../catalogue/VehiclesProductPage'
import { offer, product } from '../../features/catalogue/catalogueFixtures'
import { COMPANY } from '../../features/legal/company'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mount(node: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(node)); return container
}
const type = async (input: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

describe('Your data', () => {
  it('offers email access requests without an unsupported download action or request', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ exportVersion: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const view = await mount(<YourData token="token" onDeleted={vi.fn()} />)
    expect([...view.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Delete my account'])
    expect(view.querySelector(`a[href="mailto:${COMPANY.supportEmail}"]`)?.textContent).toBe(COMPANY.supportEmail)
    await type(view.querySelector('input[type="password"]')!, 'Secret1!pass')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(view.textContent).not.toContain('Your email address and name are removed from them')
  })

  it('guards implicit form submission until both password and confirmation are provided', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const onDeleted = vi.fn()
    const view = await mount(<YourData token="token" onDeleted={onDeleted} />)
    const form = view.querySelector('form')!
    expect(form.getAttribute('aria-label')).toBe('Delete your account')
    expect(view.querySelector('button')?.type).toBe('submit')
    const submit = async () => act(async () => {
      const event = new Event('submit', { bubbles: true, cancelable: true })
      form.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })
    await submit()
    await act(async () => view.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await submit() // confirmation without a password is also insufficient
    await act(async () => view.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await type(view.querySelector('input[type="password"]')!, 'Secret1!pass')
    await submit() // password without confirmation must never delete
    expect(fetchSpy).not.toHaveBeenCalled()
    await act(async () => view.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await submit() // implicit Enter submission uses this same guarded handler
    await submit() // an additional submission while busy must not duplicate it
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/users\/me$/)
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(String(init.body))).toEqual({ password: 'Secret1!pass' })
    expect(onDeleted).toHaveBeenCalledOnce()
  })

  it('deletes only after explicit confirmation, then signs out', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const onDeleted = vi.fn()
    const view = await mount(<YourData token="token" onDeleted={onDeleted} />)
    const remove = [...view.querySelectorAll('button')].find(b => b.textContent === 'Delete my account')!
    await type(view.querySelector('input[type="password"]')!, 'Secret1!pass')
    expect(remove.disabled).toBe(true)
    await act(async () => view.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await act(async () => remove.click())
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/users\/me$/); expect(init.method).toBe('DELETE')
    expect(onDeleted).toHaveBeenCalledOnce()
  })
})

describe('pre-purchase disclosures', () => {
  it('links the terms and privacy policy when creating an account', () => {
    const markup = renderToStaticMarkup(<AccountView mode="create" onModeChange={vi.fn()} />)
    expect(markup).toContain('href="/legal/terms"'); expect(markup).toContain('href="/legal/privacy"')
  })

  it('shows age guidance and manufacturer safety warnings before adding to cart', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const item = { ...product(5, [offer(51, { legoProductId: 5 })]), ageRecommendation: '6', safetyWarnings: 'WARNING: CHOKING HAZARD – Small parts. Not for children under 3 years.' }
    const markup = renderToStaticMarkup(<CatalogueProductDetails product={item} selectedOfferId={51} side="right" onAddToCart={vi.fn()} />)
    expect(markup).toContain('Ages 6+')
    expect(markup).toContain('CHOKING HAZARD')
    expect(markup).not.toContain('href="/legal/delivery-returns"')
  })
})
