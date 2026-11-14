// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteAccount } from './DeleteAccount'
import { AccountView } from './AccountForms'
import { CatalogueProductDetails } from '../catalogue/VehiclesProductPage'
import { offer, product } from '../../features/catalogue/catalogueFixtures'
import { COMPANY } from '../../features/legal/company'
// Exercises the open-registration form (Production now defaults to closed; see RegistrationClosedDialog.test.tsx).
vi.mock('../../features/checkout/sandbox', async original => ({ ...await original<typeof import('../../features/checkout/sandbox')>(), registrationAvailable: true }))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mount(node: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(node)); return container
}
const type = async (input: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

const dialog = () => document.querySelector<HTMLDialogElement>('dialog.confirm-dialog')
const button = (root: ParentNode, name: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === name)
const confirmButton = () => dialog()!.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!
const click = async (element: HTMLElement) => act(async () => element.click())
// A real click focuses the opener first; jsdom's click() does not.
const openDialog = async (view: HTMLElement) => { const opener = button(view, 'Delete account')!; opener.focus(); await click(opener); expect(dialog()?.open).toBe(true) }
const fillReady = async (password = 'Secret1!pass') => {
  await type(dialog()!.querySelector('input[type="password"]')!, password)
  await click(dialog()!.querySelector<HTMLInputElement>('input[type="checkbox"]')!)
}

describe('Delete account', () => {
  it('replaces the large card with a small settings row that keeps the data-access route', async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const view = await mount(<DeleteAccount token="token" onDeleted={vi.fn()} />)
    expect(view.querySelector('.my-account__panel')).toBeNull()
    expect(view.querySelector('input')).toBeNull()
    expect([...view.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Delete account'])
    expect(view.querySelector(`a[href="mailto:${COMPANY.supportEmail}"]`)?.textContent).toBe(COMPANY.supportEmail)
    expect(view.querySelector('a[href="/legal/privacy"]')).not.toBeNull()
    expect(dialog()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('explains permanence and legal retention, and keeps Delete unavailable until password and confirmation are both given', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchSpy)
    const view = await mount(<DeleteAccount token="token" onDeleted={vi.fn()} />)
    await openDialog(view)
    expect(dialog()!.textContent).toContain('This cannot be undone.')
    expect(dialog()!.textContent).toContain('Necessary order, payment and invoice records are retained')
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    await click(confirmButton())
    await type(dialog()!.querySelector('input[type="password"]')!, 'Secret1!pass')
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    await click(confirmButton()) // password without confirmation must never delete
    const form = dialog()!.querySelector('form')!
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) // implicit Enter
    await type(dialog()!.querySelector('input[type="password"]')!, '')
    await click(dialog()!.querySelector<HTMLInputElement>('input[type="checkbox"]')!)
    await click(confirmButton()) // confirmation without a password is also insufficient
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('cancel and Escape close safely without a request, and reopening starts empty', async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const view = await mount(<DeleteAccount token="token" onDeleted={vi.fn()} />)
    await openDialog(view)
    await fillReady()
    await click(button(dialog()!, 'Cancel')!)
    expect(dialog()).toBeNull()
    expect(document.activeElement?.textContent).toBe('Delete account')
    await openDialog(view)
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('')
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false)
    await act(async () => { dialog()!.dispatchEvent(new Event('cancel', { cancelable: true })) }) // Escape
    expect(dialog()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('deletes once with the password, ignores duplicates while busy, then signs out', async () => {
    let finish!: (response: Response) => void
    const fetchSpy = vi.fn(() => new Promise<Response>(resolve => { finish = resolve })); vi.stubGlobal('fetch', fetchSpy)
    const onDeleted = vi.fn()
    const view = await mount(<DeleteAccount token="token" onDeleted={onDeleted} />)
    await openDialog(view)
    await fillReady()
    expect(confirmButton().getAttribute('aria-disabled')).toBe('false')
    await click(confirmButton())
    expect(confirmButton().textContent).toBe('Deleting…')
    await click(confirmButton())
    await click(button(dialog()!, 'Cancel')!) // cannot cancel mid-request
    expect(dialog()?.open).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/users\/me$/)
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(String(init.body))).toEqual({ password: 'Secret1!pass' })
    await act(async () => finish(new Response(null, { status: 204 })))
    expect(onDeleted).toHaveBeenCalledOnce()
  })

  it('keeps the dialog open on a wrong password, clears it, deletes nothing and allows a retry', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'REAUTHENTICATION_REQUIRED' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const onDeleted = vi.fn()
    const view = await mount(<DeleteAccount token="token" onDeleted={onDeleted} />)
    await openDialog(view)
    await fillReady('Wrong1!pass')
    await click(confirmButton())
    expect(dialog()?.open).toBe(true)
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe('That password is not correct. Nothing was deleted.')
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('')
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    expect(onDeleted).not.toHaveBeenCalled()
    await type(dialog()!.querySelector('input[type="password"]')!, 'Secret1!pass')
    await click(confirmButton())
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(onDeleted).toHaveBeenCalledOnce()
  })

  it('reports rate limiting and other failures without deleting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })))
    const onDeleted = vi.fn()
    const view = await mount(<DeleteAccount token="token" onDeleted={onDeleted} />)
    await openDialog(view)
    await fillReady()
    await click(confirmButton())
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe('Too many attempts. Please wait a few minutes and try again. Nothing was deleted.')
    await click(confirmButton())
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe('Something went wrong. Please try again, or email us. Nothing was deleted.')
    expect(onDeleted).not.toHaveBeenCalled()
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
