// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SavedAddresses } from './SavedAddresses'
import { createAddress, deleteAddress, getAddresses, updateAddress, type Address } from '../../features/account/addressApi'
const mocks = vi.hoisted(() => ({ user: { firstName: ' Jane ' as string | null, lastName: ' Smith ' as string | null } }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', user: mocks.user } }) }))
vi.mock('../../features/account/addressApi', async original => ({ ...await original<typeof import('../../features/account/addressApi')>(), getAddresses: vi.fn(), createAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const address = (id: number, shipping = true, billing = true): Address => ({ id, recipientName: `Recipient ${id}`, line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: shipping, isDefaultBilling: billing })
let root: Root
let container: HTMLDivElement
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<SavedAddresses token="jwt" />)) }
async function click(text: string, index = 0) { await act(async () => [...container.querySelectorAll('button')].filter(button => button.textContent?.includes(text))[index].click()) }
function field(label: string) { return [...container.querySelectorAll('label')].find(labelEl => labelEl.textContent === label)!.querySelector('input')! }
async function fill(label: string, value: string) { await act(async () => { const input = field(label); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) }) }
async function save() { await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
beforeEach(() => { vi.resetAllMocks(); mocks.user.firstName = ' Jane '; mocks.user.lastName = ' Smith '; vi.mocked(getAddresses).mockResolvedValue([]) })
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = '' })
describe('saved address V1 form', () => {
  it.each([['Jane', 'Smith', 'Jane Smith'], ['Jane', null, 'Jane'], [null, 'Smith', 'Smith'], [null, null, ''], ['  ', '  ', '']])('prefills only the first recipient safely (%s, %s)', async (firstName, lastName, expected) => {
    mocks.user.firstName = firstName; mocks.user.lastName = lastName
    await mount(); await click('Add address'); expect(field('Recipient name').value).toBe(expected)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(field('Country').value).toBe('United Kingdom'); expect(field('Country').readOnly).toBe(true)
  })
  it('keeps first recipient editable and uses authoritative first-address defaults', async () => {
    await mount(); await click('Add address'); await fill('Recipient name', 'Someone Else'); await fill('Address line 1', '1 Street'); await fill('City', 'London'); expect(field('Postcode').getAttribute('maxlength')).toBeNull(); await fill('Postcode', '  sw1a   1aa  ')
    vi.mocked(createAddress).mockResolvedValue(address(1)); vi.mocked(getAddresses).mockResolvedValue([address(1)])
    await save()
    expect(createAddress).toHaveBeenCalledWith('jwt', expect.objectContaining({ recipientName: 'Someone Else', country: 'United Kingdom', postcode: 'SW1A 1AA' }))
    expect(vi.mocked(createAddress).mock.calls[0][1]).not.toHaveProperty('isDefaultShipping')
    expect(vi.mocked(createAddress).mock.calls[0][1]).not.toHaveProperty('isDefaultBilling')
    expect(getAddresses).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Default Delivery'); expect(container.textContent).toContain('Default Billing')
  })
  it('starts a later recipient blank and can request independent defaults', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1)]); await mount(); await click('Add address')
    expect(field('Recipient name').value).toBe(''); expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    await fill('Recipient name', 'Delivery Person'); await fill('Address line 1', '2 Street'); await fill('City', 'London'); await fill('Postcode', 'SW1A 1AA')
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    vi.mocked(createAddress).mockResolvedValue(address(2, true, false)); vi.mocked(getAddresses).mockResolvedValue([address(1, false, true), address(2, true, false)])
    await save()
    expect(createAddress).toHaveBeenCalledWith('jwt', expect.objectContaining({ isDefaultShipping: true, isDefaultBilling: false }))
    expect(container.querySelectorAll('.saved-address__defaults')).toHaveLength(2)
    expect(container.querySelectorAll('.saved-address__defaults')[0].textContent).toBe('Default Billing')
    expect(container.querySelectorAll('.saved-address__defaults')[1].textContent).toBe('Default Delivery')
  })
  it('editing preserves saved recipient and renders legacy GB as United Kingdom', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1)]); await mount(); await click('Edit')
    expect(field('Recipient name').value).toBe('Recipient 1'); expect(field('Country').value).toBe('United Kingdom')
    expect(container.textContent).toContain('United Kingdom'); expect(container.textContent).not.toContain('null')
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(input => input.disabled)).toBe(true)
  })
  it('saves edits with the preserved recipient and supported UK API country', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1)]); vi.mocked(updateAddress).mockResolvedValue(address(1))
    await mount(); await click('Edit'); await save()
    expect(updateAddress).toHaveBeenCalledWith('jwt', 1, expect.objectContaining({ recipientName: 'Recipient 1', country: 'United Kingdom', isDefaultShipping: true, isDefaultBilling: true }))
  })
  it('does not pretend an unavailable address book is empty and permits retry', async () => {
    vi.mocked(getAddresses).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([address(1)])
    await mount(); await click('Add address'); expect(container.querySelector('form')).toBeNull()
    await click('Try loading addresses again'); await click('Add address')
    expect(field('Recipient name').value).toBe('')
  })
  it.each(['shipping', 'billing'])('refetches authoritative %s replacement without changing the other role', async role => {
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    const changed = role === 'shipping' ? address(2, true, false) : address(2, false, true)
    vi.mocked(updateAddress).mockResolvedValue(changed)
    vi.mocked(getAddresses).mockResolvedValue([role === 'shipping' ? address(1, false, true) : address(1, true, false), changed])
    await click(role === 'shipping' ? 'Make delivery default' : 'Make billing default')
    expect(updateAddress).toHaveBeenCalledWith('jwt', 2, role === 'shipping' ? { isDefaultShipping: true } : { isDefaultBilling: true })
    expect([...container.querySelectorAll('.saved-address__defaults')].filter(el => el.textContent?.includes('Default Delivery'))).toHaveLength(1)
    expect([...container.querySelectorAll('.saved-address__defaults')].filter(el => el.textContent?.includes('Default Billing'))).toHaveLength(1)
    expect(getAddresses).toHaveBeenCalledTimes(2)
  })
})

describe('branded delete confirmation', () => {
  const dialog = () => document.querySelector<HTMLDialogElement>('dialog.confirm-dialog')
  const dialogButton = (name: string) => [...(dialog()?.querySelectorAll('button') ?? [])].find(b => b.textContent === name)!
  const deleteButtons = () => [...container.querySelectorAll<HTMLButtonElement>('.saved-address__delete')]
  const key = (target: Element, init: KeyboardEventInit) => act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })) })
  beforeEach(() => {
    // jsdom has no top layer; record the modal state the component asks for.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    vi.spyOn(window, 'confirm')
  })
  it('opens without deleting, names the address and explains the default consequence', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    deleteButtons()[0].focus()
    await act(async () => deleteButtons()[0].click())
    expect(window.confirm).not.toHaveBeenCalled()
    expect(deleteAddress).not.toHaveBeenCalled()
    expect(dialog()?.hasAttribute('open')).toBe(true)
    expect(dialog()?.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog()!.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete this address?')
    const description = document.getElementById(dialog()!.getAttribute('aria-describedby')!)!.textContent
    expect(description).toContain('Recipient 1')
    expect(description).toContain('This is your default delivery and billing address. Recipient 2, 1 Street will become the new default delivery and billing address.')
    expect(description).toContain('Existing orders will not change.')
    expect(document.activeElement).toBe(dialogButton('Cancel'))
    expect(dialogButton('Delete address')).toBeTruthy()
  })
  it('explains when no default would remain, and omits default text for a non-default address', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1)]); await mount()
    await act(async () => deleteButtons()[0].click())
    expect(dialog()?.textContent).toContain('You will have no saved default address.')
    await act(async () => dialogButton('Cancel').click())
    await act(async () => root.unmount()); container.remove()
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    await act(async () => deleteButtons()[1].click())
    expect(dialog()?.textContent).not.toContain('default')
  })
  it('cancels with Cancel or Escape, restores focus and never lets Escape reach the enclosing modal', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    const outer = vi.fn(); document.addEventListener('keydown', outer)
    try {
      deleteButtons()[1].focus(); await act(async () => deleteButtons()[1].click())
      await act(async () => dialogButton('Cancel').click())
      expect(dialog()).toBeNull(); expect(document.activeElement).toBe(deleteButtons()[1])
      deleteButtons()[1].focus(); await act(async () => deleteButtons()[1].click())
      await key(dialog()!, { key: 'Escape' })
      await act(async () => { dialog()!.dispatchEvent(new Event('cancel', { cancelable: true })) })
      expect(dialog()).toBeNull(); expect(document.activeElement).toBe(deleteButtons()[1])
      expect(outer).not.toHaveBeenCalled()
      expect(deleteAddress).not.toHaveBeenCalled()
    } finally { document.removeEventListener('keydown', outer) }
  })
  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1)]); await mount()
    await act(async () => deleteButtons()[0].click())
    dialogButton('Delete address').focus(); await key(dialogButton('Delete address'), { key: 'Tab' })
    expect(document.activeElement).toBe(dialogButton('Cancel'))
    await key(dialogButton('Cancel'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(dialogButton('Delete address'))
  })
  it('deletes once, blocks duplicates and Escape while busy, then closes, reloads and moves focus to a safe control', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    let finish!: () => void
    vi.mocked(deleteAddress).mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    await act(async () => deleteButtons()[0].click())
    dialogButton('Delete address').focus()
    await act(async () => dialogButton('Delete address').click())
    expect(dialogButton('Deleting…').getAttribute('aria-disabled')).toBe('true')
    expect(dialogButton('Cancel').getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(dialogButton('Deleting…'))
    await act(async () => dialogButton('Deleting…').click())
    await act(async () => { dialog()!.dispatchEvent(new Event('cancel', { cancelable: true })) })
    expect(dialog()).not.toBeNull()
    expect(deleteAddress).toHaveBeenCalledTimes(1); expect(deleteAddress).toHaveBeenCalledWith('jwt', 1)
    vi.mocked(getAddresses).mockResolvedValue([address(2)])
    await act(async () => finish())
    expect(dialog()).toBeNull()
    expect(container.textContent).not.toContain('Recipient 1')
    expect(document.activeElement?.textContent).toContain('Add address')
  })
  it('keeps the dialog open with an announced error after a failure and allows a safe retry', async () => {
    vi.mocked(getAddresses).mockResolvedValue([address(1), address(2, false, false)]); await mount()
    vi.mocked(deleteAddress).mockRejectedValueOnce(new Error('Address service unavailable'))
    await act(async () => deleteButtons()[0].click())
    await act(async () => dialogButton('Delete address').click())
    const error = dialog()!.querySelector('[role="alert"]')!
    expect(error.textContent).toBe('Address service unavailable Nothing was deleted; you can try again.')
    expect(dialog()!.getAttribute('aria-describedby')).toContain(error.id)
    expect(dialogButton('Delete address').getAttribute('aria-disabled')).toBe('false')
    expect(container.querySelector('.my-account__error')).toBeNull()
    vi.mocked(deleteAddress).mockResolvedValueOnce(undefined); vi.mocked(getAddresses).mockResolvedValue([address(2)])
    await act(async () => dialogButton('Delete address').click())
    expect(deleteAddress).toHaveBeenCalledTimes(2)
    expect(dialog()).toBeNull()
  })
})
